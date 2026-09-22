package com.parsystem.service;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.PARScore;
import com.parsystem.entity.User;
import com.parsystem.repository.OrthoCaseRepository;
import com.parsystem.repository.PARScoreRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PARCalculatorServiceTest {

    @Mock private OrthoCaseRepository caseRepository;
    @Mock private PARScoreRepository parScoreRepository;
    @Mock private AuditService auditService;

    private PARCalculatorService parCalculatorService;
    private User performer;

    @BeforeEach
    void setUp() {
        parCalculatorService = new PARCalculatorService(caseRepository, parScoreRepository, auditService);
        performer = User.builder().id(1L).role(User.Role.ORTHODONTIST).build();
    }

    private PARScoreDto.CalculateRequest requestWith(
            int upperAnterior, int lowerAnterior, int buccalLeft, int buccalRight,
            int overjet, int overbite, int centreline) {
        PARScoreDto.CalculateRequest req = new PARScoreDto.CalculateRequest();
        req.setUpperAnterior(upperAnterior);
        req.setLowerAnterior(lowerAnterior);
        req.setBuccalLeft(buccalLeft);
        req.setBuccalRight(buccalRight);
        req.setOverjet(overjet);
        req.setOverbite(overbite);
        req.setCentreline(centreline);
        return req;
    }

    @Test
    void calculateStoresWeightedTotalAndMarksSourceAsManual() {
        OrthoCase nonFinalisedCase = OrthoCase.builder().id(2L).stage(OrthoCase.Stage.PRE).isFinalized(false).build();
        when(caseRepository.findById(2L)).thenReturn(Optional.of(nonFinalisedCase));
        when(parScoreRepository.findByOrthoCaseId(2L)).thenReturn(Optional.empty());
        when(parScoreRepository.save(any(PARScore.class))).thenAnswer(inv -> inv.getArgument(0));

        PARScoreDto.CalculateRequest req = requestWith(2, 3, 1, 4, 2, 3, 1);

        PARScore result = parCalculatorService.calculate(2L, req, performer);

        assertEquals(32, result.getTotalWeighted());
        assertEquals("MANUAL", result.getScoreSource());
        assertNotNull(result.getCalculatedAt());
        // PRE-stage cases are never classified.
        assertNull(result.getClassification());
        verify(auditService).log(eq(performer), eq("CALCULATE_PAR"), eq("OrthoCase"), eq(2L), anyString());
    }

    @Test
    void calculateRejectsRecalculationOfAFinalisedCase() {
        OrthoCase finalised = OrthoCase.builder().id(3L).stage(OrthoCase.Stage.PRE).isFinalized(true).build();
        when(caseRepository.findById(3L)).thenReturn(Optional.of(finalised));

        PARScoreDto.CalculateRequest req = requestWith(0, 0, 0, 0, 0, 0, 0);

        assertThrows(IllegalStateException.class,
                () -> parCalculatorService.calculate(3L, req, performer));
        verify(parScoreRepository, never()).save(any());
    }

    @Test
    void calculateThrowsWhenCaseDoesNotExist() {
        when(caseRepository.findById(99L)).thenReturn(Optional.empty());
        PARScoreDto.CalculateRequest req = requestWith(0, 0, 0, 0, 0, 0, 0);

        assertThrows(IllegalArgumentException.class,
                () -> parCalculatorService.calculate(99L, req, performer));
    }

    @Test
    void postTreatmentCaseIsClassifiedGreatlyImprovedWhenReductionIsLargeEnough() {
        PARScore preScore = PARScore.builder().totalWeighted(50).build();
        OrthoCase preCase = OrthoCase.builder().id(10L).parScore(preScore).build();
        OrthoCase postCase = OrthoCase.builder()
                .id(11L).stage(OrthoCase.Stage.POST).isFinalized(false).preCase(preCase)
                .build();

        when(caseRepository.findById(11L)).thenReturn(Optional.of(postCase));
        when(parScoreRepository.findByOrthoCaseId(11L)).thenReturn(Optional.empty());
        when(parScoreRepository.save(any(PARScore.class))).thenAnswer(inv -> inv.getArgument(0));

        // Post score of 10: reduction = (50-10)/50 = 80% (>=30%), point diff = 40 (>=22)
        PARScoreDto.CalculateRequest req = requestWith(1, 1, 1, 1, 1, 0, 0);
        // total = 1+1+1+1+6+0+0 = 10
        PARScore result = parCalculatorService.calculate(11L, req, performer);

        assertEquals(10, result.getTotalWeighted());
        assertEquals("Greatly Improved", result.getClassification());
    }

    @Test
    void postTreatmentCaseWithNoPreCaseGetsNoReferenceClassification() {
        OrthoCase postCase = OrthoCase.builder()
                .id(12L).stage(OrthoCase.Stage.POST).isFinalized(false).preCase(null)
                .build();

        when(caseRepository.findById(12L)).thenReturn(Optional.of(postCase));
        when(parScoreRepository.findByOrthoCaseId(12L)).thenReturn(Optional.empty());
        when(parScoreRepository.save(any(PARScore.class))).thenAnswer(inv -> inv.getArgument(0));

        PARScoreDto.CalculateRequest req = requestWith(0, 0, 0, 0, 0, 0, 0);
        PARScore result = parCalculatorService.calculate(12L, req, performer);

        assertEquals("No Pre-Treatment Reference", result.getClassification());
    }

    @Test
    void postTreatmentClassificationThrowsWhenPreCaseHasNoScoreYet() {
        OrthoCase preCase = OrthoCase.builder().id(20L).parScore(null).build();
        OrthoCase postCase = OrthoCase.builder()
                .id(21L).stage(OrthoCase.Stage.POST).isFinalized(false).preCase(preCase)
                .build();

        when(caseRepository.findById(21L)).thenReturn(Optional.of(postCase));
        when(parScoreRepository.findByOrthoCaseId(21L)).thenReturn(Optional.empty());

        PARScoreDto.CalculateRequest req = requestWith(0, 0, 0, 0, 0, 0, 0);

        assertThrows(IllegalStateException.class,
                () -> parCalculatorService.calculate(21L, req, performer));
    }

    @Test
    void calculateFromMlUsesRoundedPredictedScoreAndZeroesComponents() {
        OrthoCase orthoCase = OrthoCase.builder()
                .id(30L).stage(OrthoCase.Stage.PRE).isFinalized(false).mlPredictedScore(27.6f)
                .build();

        when(caseRepository.findById(30L)).thenReturn(Optional.of(orthoCase));
        when(parScoreRepository.findByOrthoCaseId(30L)).thenReturn(Optional.empty());
        when(parScoreRepository.save(any(PARScore.class))).thenAnswer(inv -> inv.getArgument(0));

        PARScore result = parCalculatorService.calculateFromML(30L, performer);

        assertEquals(28, result.getTotalWeighted()); // Math.round(27.6) = 28
        assertEquals("ML", result.getScoreSource());
        assertEquals(0, result.getOverjet());
        verify(auditService).log(eq(performer), eq("CALCULATE_PAR_FROM_ML"), eq("OrthoCase"), eq(30L), anyString());
    }

    @Test
    void calculateFromMlThrowsWhenNoPredictionExists() {
        OrthoCase orthoCase = OrthoCase.builder()
                .id(31L).stage(OrthoCase.Stage.PRE).isFinalized(false).mlPredictedScore(null)
                .build();
        when(caseRepository.findById(31L)).thenReturn(Optional.of(orthoCase));

        assertThrows(IllegalStateException.class,
                () -> parCalculatorService.calculateFromML(31L, performer));
        verify(parScoreRepository, never()).save(any());
    }

    @Test
    void calculateFromMlRejectsFinalisedCase() {
        OrthoCase orthoCase = OrthoCase.builder()
                .id(32L).stage(OrthoCase.Stage.PRE).isFinalized(true).mlPredictedScore(15f)
                .build();
        when(caseRepository.findById(32L)).thenReturn(Optional.of(orthoCase));

        assertThrows(IllegalStateException.class,
                () -> parCalculatorService.calculateFromML(32L, performer));
    }
}
