package com.parsystem.service;

import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.LandmarkPoint;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.PARScore;
import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.repository.LandmarkPointRepository;
import com.parsystem.repository.OrthoCaseRepository;
import com.parsystem.repository.PARScoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Tests exercise GeometricPARService.calculateAndSave(...) end to end with
 * mocked repositories, using real LandmarkPoint geometry so the actual
 * distance/threshold math in the service runs unmodified.
 *
 * Landmark naming/required sets are taken directly from the production
 * REQUIRED_UPPER / REQUIRED_LOWER / REQUIRED_BUCCAL lists in
 * GeometricPARService â€” 13 upper + 14 lower + 5 buccal points.
 *
 * NOTE (observation, not a bug fix): REQUIRED_BUCCAL enforces the presence
 * of "RU6", "RL6", "LU6", "LL6" and "LCover", but only "LCover" is ever read
 * by the scoring methods (overjet). RU6/RL6/LU6/LL6 are validated as
 * mandatory input yet have no effect on any score. This looks like dead
 * validation / a naming mismatch with the buccal molar points the buccal
 * AP/transverse/vertical methods actually read (e.g. "R6MB", "R6GB", "R6M"),
 * which are NOT in any required list and are silently optional (missing
 * ones just score 0). Flagging this per the "explain before changing
 * production code" rule â€” not fixed here since it wasn't asked for and
 * changing REQUIRED_BUCCAL or the buccal method lookups would be a
 * behavioural change to production code.
 */
@ExtendWith(MockitoExtension.class)
class GeometricPARServiceTest {

    @Mock private LandmarkPointRepository landmarkRepo;
    @Mock private OrthoCaseRepository caseRepo;
    @Mock private PARScoreRepository parScoreRepo;
    @Mock private AuditService auditService;

    @InjectMocks private GeometricPARService geometricPARService;

    private User performer;
    private static final Long CASE_ID = 1L;

    @BeforeEach
    void setUp() {
        performer = User.builder().id(9L).role(User.Role.ORTHODONTIST).build();
    }

    // ---- landmark-set builders -------------------------------------------------

    private LandmarkPoint pt(LandmarkPoint.Slot slot, String name, double x, double y, double z) {
        return LandmarkPoint.builder().slot(slot).pointName(name).x(x).y(y).z(z).build();
    }

    /** The full REQUIRED_UPPER + REQUIRED_LOWER + REQUIRED_BUCCAL set, all at the origin. */
    private List<LandmarkPoint> baselineLandmarks() {
        List<LandmarkPoint> points = new ArrayList<>();
        String[] upperNames = {"R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid",
                "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"};
        String[] lowerNames = {"R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid", "R1Low",
                "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"};
        String[] buccalNames = {"RU6", "RL6", "LU6", "LL6", "LCover"};

        for (String name : upperNames) points.add(pt(LandmarkPoint.Slot.UPPER, name, 0, 0, 0));
        for (String name : lowerNames) points.add(pt(LandmarkPoint.Slot.LOWER, name, 0, 0, 0));
        for (String name : buccalNames) points.add(pt(LandmarkPoint.Slot.BUCCAL, name, 0, 0, 0));
        return points;
    }

    /** Replaces one point (by slot+name) in a baseline set with a new coordinate. */
    private void override(List<LandmarkPoint> points, LandmarkPoint.Slot slot, String name,
                           double x, double y, double z) {
        points.removeIf(p -> p.getSlot() == slot && p.getPointName().equals(name));
        points.add(pt(slot, name, x, y, z));
    }

    private OrthoCase preCase(Long id) {
        Patient patient = Patient.builder().id(2L).build();
        return OrthoCase.builder().id(id).patient(patient).stage(OrthoCase.Stage.PRE)
                .isFinalized(false).build();
    }

    private OrthoCase caseWithId(Long id, OrthoCase.Stage stage) {
        Patient patient = Patient.builder().id(2L).build();
        return OrthoCase.builder().id(id).patient(patient).stage(stage).isFinalized(false).build();
    }

    // ---- guard clauses ----------------------------------------------------

    @Test
    void throwsWhenCaseNotFound() {
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> geometricPARService.calculateAndSave(CASE_ID, performer));

        assertTrue(ex.getMessage().contains("Case not found"));
        verifyNoInteractions(landmarkRepo, parScoreRepo);
    }

    @Test
    void throwsWhenCaseIsFinalized() {
        OrthoCase finalizedCase = OrthoCase.builder().id(CASE_ID)
                .patient(Patient.builder().id(2L).build())
                .stage(OrthoCase.Stage.PRE).isFinalized(true).build();
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(finalizedCase));

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> geometricPARService.calculateAndSave(CASE_ID, performer));

        assertTrue(ex.getMessage().contains("Cannot recalculate a finalised case"));
        verifyNoInteractions(landmarkRepo, parScoreRepo);
    }

    @Test
    void throwsWhenARequiredLandmarkIsMissing() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        List<LandmarkPoint> points = baselineLandmarks();
        points.removeIf(p -> p.getSlot() == LandmarkPoint.Slot.UPPER && p.getPointName().equals("L3M"));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> geometricPARService.calculateAndSave(CASE_ID, performer));

        assertTrue(ex.getMessage().contains("Missing required landmarks"));
        assertTrue(ex.getMessage().contains("UPPER:L3M"));
        verifyNoInteractions(parScoreRepo);
    }

    // ---- valid input / zero-distance boundary -----------------------------

    @Test
    void allLandmarksCoincidentProducesAllZeroScores() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals(0, response.getUpperAnteriorRaw());
        assertEquals(0, response.getLowerAnteriorRaw());
        assertEquals(0, response.getOverjetRaw());
        assertEquals(0, response.getOverbiteRaw());
        assertEquals(0, response.getCentrelineRaw());
        assertEquals(0, response.getBuccalLeftRaw());
        assertEquals(0, response.getBuccalRightRaw());
        assertEquals(0, response.getTotalWeighted());
        assertNull(response.getClassification(), "PRE-stage cases are never classified");
        assertEquals(32, response.getLandmarksUsed());
        verify(parScoreRepo).save(any(PARScore.class));
    }

    // ---- individual component geometry -------------------------------------

    @Test
    void anteriorSegmentScoreIsCappedAtNine() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        // Push every upper anterior pair to a distance > 8mm (raw distanceScore 4 each);
        // 5 pairs x 4 = 20, which the service clamps to a max of 9.
        List<LandmarkPoint> points = baselineLandmarks();
        override(points, LandmarkPoint.Slot.UPPER, "R3M", 0, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "R2D", 9, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "R2M", 0, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "R1D", 9, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "R1M", 0, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "L1M", 9, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "L1D", 0, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "L2M", 9, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "L2D", 0, 0, 0);
        override(points, LandmarkPoint.Slot.UPPER, "L3M", 9, 0, 0);
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals(9, response.getUpperAnteriorRaw());
        assertEquals(9, response.getUpperAnteriorWeighted()); // x1
        // incisorWidth (lower R1M-R1D) is still 0 in this fixture, so centreline
        // short-circuits to 0 regardless of the upper L1M/R1M shift used above.
        assertEquals(0, response.getCentrelineRaw());
        assertEquals(9, response.getTotalWeighted());
    }

    @Test
    void overjetScoredFromR1MidToLCoverDistance() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        // dist = |4 - 0| = 4mm -> band (3, 5] -> raw score 1
        List<LandmarkPoint> points = baselineLandmarks();
        override(points, LandmarkPoint.Slot.UPPER, "R1Mid", 0, 4, 0);
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals(1, response.getOverjetRaw());
        assertEquals(6, response.getOverjetWeighted()); // x6
        assertEquals(0, response.getOverbiteRaw(), "z-axis untouched, overbite unaffected");
        assertEquals(6, response.getTotalWeighted());
    }

    @Test
    void overbiteScoredFromVerticalOffsetWhenUpperCoversLower() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        // verticalOffset = upperMid.z - lowerMid.z = 3 - 0 = 3 -> band (2, 4] -> raw score 3
        List<LandmarkPoint> points = baselineLandmarks();
        override(points, LandmarkPoint.Slot.UPPER, "R1Mid", 0, 0, 3);
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals(3, response.getOverbiteRaw());
        assertEquals(6, response.getOverbiteWeighted()); // x2
        assertEquals(0, response.getOverjetRaw(), "y-axis untouched, overjet unaffected");
        assertEquals(6, response.getTotalWeighted());
    }

    @Test
    void centrelineAndAnteriorScoresInteractThroughSharedLandmarks() {
        // upper.L1M and lower.R1D feed both the anterior-segment pairs and the
        // centreline calculation, since both reuse the same required points.
        // This test documents that interaction with a hand-verified result
        // rather than assuming the two scores are independent.
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        List<LandmarkPoint> points = baselineLandmarks();
        // upper R1M-L1M pair distance = 3mm -> distanceScore 2 -> upperAnteriorRaw = 2
        override(points, LandmarkPoint.Slot.UPPER, "L1M", 3, 0, 0);
        // lower R2M-R1D pair distance = 4mm -> distanceScore 2 -> lowerAnteriorRaw = 2
        override(points, LandmarkPoint.Slot.LOWER, "R1D", 4, 0, 0);
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        // upperMid.x = (3+0)/2 = 1.5, lowerMid.x = 0, discrepancy = 1.5
        // incisorWidth = lower R1M-R1D distance = 4; thresholds 1.0 and 2.0
        // 1.0 < 1.5 <= 2.0 -> centreline raw score 1
        assertEquals(2, response.getUpperAnteriorRaw());
        assertEquals(2, response.getLowerAnteriorRaw());
        assertEquals(1, response.getCentrelineRaw());
        assertEquals(4, response.getCentrelineWeighted()); // x4
        assertEquals(2 + 2 + 4, response.getTotalWeighted());
    }

    @Test
    void buccalAnteroPosteriorScoredWhenOptionalMolarLandmarksPresent() {
        // R6MB/R6GB/R6M are not in any REQUIRED_* list, so they're absent from
        // baselineLandmarks(); this test adds them to exercise the AP scoring
        // path (calculateBuccalAnteroPosterior) directly.
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));

        List<LandmarkPoint> points = baselineLandmarks();
        points.add(pt(LandmarkPoint.Slot.UPPER, "R6MB", 0, 10, 0));
        points.add(pt(LandmarkPoint.Slot.LOWER, "R6GB", 0, 0, 0));
        points.add(pt(LandmarkPoint.Slot.LOWER, "R6M", 0, 4, 0));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID)).thenReturn(points);
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        // discrepancy = |10-0| = 10, halfUnitWidth = |4-0| = 4; 10 >= 4 -> AP raw score 2
        // transverse/vertical stay 0 (their required point quads are absent)
        assertEquals(2, response.getBuccalRightRaw());
        assertEquals(2, response.getBuccalRightWeighted()); // x1
        assertEquals(0, response.getBuccalLeftRaw());
        assertEquals(2, response.getTotalWeighted());
    }

    // ---- POST-treatment classification -------------------------------------

    @Test
    void postCaseWithNoPreCaseGetsNoReferenceClassification() {
        OrthoCase postCase = caseWithId(CASE_ID, OrthoCase.Stage.POST); // preCase left null
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(postCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals("No Pre-Treatment Reference", response.getClassification());
    }

    @Test
    void postCaseWithPreCaseButNoParScoreThrows() {
        OrthoCase pre = preCase(2L); // no parScore attached
        OrthoCase postCase = OrthoCase.builder().id(CASE_ID)
                .patient(Patient.builder().id(2L).build())
                .stage(OrthoCase.Stage.POST).isFinalized(false).preCase(pre).build();
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(postCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        // calculateAndSave() fetches/builds the PARScore row (line ~117) before it
        // reaches classification (line ~131), so findByOrthoCaseId IS called on this
        // path — only the later save() must not happen. Must stub it so the real
        // Optional.orElse(...) chain doesn't NPE before the exception we're testing.
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> geometricPARService.calculateAndSave(CASE_ID, performer));

        assertTrue(ex.getMessage().contains("has no PAR score recorded"));
        verify(parScoreRepo, never()).save(any());
    }

    @Test
    void postCaseWithZeroPreScoreIsNoDifferentOrWorse() {
        PARScore preScore = PARScore.builder().totalWeighted(0).build();
        OrthoCase pre = preCase(2L);
        pre.setParScore(preScore);
        OrthoCase postCase = OrthoCase.builder().id(CASE_ID)
                .patient(Patient.builder().id(2L).build())
                .stage(OrthoCase.Stage.POST).isFinalized(false).preCase(pre).build();
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(postCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals("No Different or Worse", response.getClassification());
    }

    @Test
    void postCaseWithLargeReductionIsGreatlyImproved() {
        // post score is 0 (baseline landmarks); pre = 50 -> 100% reduction, 50-point drop
        // -> reductionPct >= 30 AND pointDiff >= 22 -> "Greatly Improved"
        PARScore preScore = PARScore.builder().totalWeighted(50).build();
        OrthoCase pre = preCase(2L);
        pre.setParScore(preScore);
        OrthoCase postCase = OrthoCase.builder().id(CASE_ID)
                .patient(Patient.builder().id(2L).build())
                .stage(OrthoCase.Stage.POST).isFinalized(false).preCase(pre).build();
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(postCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals("Greatly Improved", response.getClassification());
    }

    @Test
    void postCaseWithHighPercentageButSmallPointDropIsImproved() {
        // post score is 0 (baseline landmarks); pre = 10 -> 100% reduction but only a
        // 10-point drop (< 22) -> falls short of "Greatly Improved", lands on "Improved"
        PARScore preScore = PARScore.builder().totalWeighted(10).build();
        OrthoCase pre = preCase(2L);
        pre.setParScore(preScore);
        OrthoCase postCase = OrthoCase.builder().id(CASE_ID)
                .patient(Patient.builder().id(2L).build())
                .stage(OrthoCase.Stage.POST).isFinalized(false).preCase(pre).build();
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(postCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.empty());

        LandmarkDto.AutoScoreResponse response = geometricPARService.calculateAndSave(CASE_ID, performer);

        assertEquals("Improved", response.getClassification());
    }

    // ---- persistence plumbing ------------------------------------------------

    @Test
    void reusesExistingParScoreRowInsteadOfCreatingANewOne() {
        OrthoCase orthoCase = caseWithId(CASE_ID, OrthoCase.Stage.PRE);
        when(caseRepo.findById(CASE_ID)).thenReturn(Optional.of(orthoCase));
        when(landmarkRepo.findByOrthoCaseIdOrderBySlotAscPointNameAsc(CASE_ID))
                .thenReturn(baselineLandmarks());

        PARScore existing = PARScore.builder().id(77L).build();
        when(parScoreRepo.findByOrthoCaseId(CASE_ID)).thenReturn(Optional.of(existing));

        geometricPARService.calculateAndSave(CASE_ID, performer);

        verify(parScoreRepo).save(existing);
        assertEquals(0, existing.getTotalWeighted());
        assertEquals("AUTO_LANDMARK", existing.getScoreSource());
    }
}
