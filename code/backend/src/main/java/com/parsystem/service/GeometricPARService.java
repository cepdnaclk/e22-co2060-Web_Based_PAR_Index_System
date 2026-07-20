package com.parsystem.service;

import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.LandmarkPoint;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.PARScore;
import com.parsystem.repository.LandmarkPointRepository;
import com.parsystem.repository.OrthoCaseRepository;
import com.parsystem.repository.PARScoreRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.vecmath.Point3d;
import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Calculates the PAR index automatically from stored 3D landmark points.
 *
 * REQUIREMENT 1 — PAR Score Calculation Integrity:
 *   - Validate ALL required landmark point names before ANY geometry
 *   - Throw ValidationException with missing point names if any absent
 *   - After calculation, validate every output is within clinical range
 *   - If ANY component is outside range: do NOT save, throw ValidationException
 *   - Log at WARNING level every auto-calculate trigger (auditable clinical trail)
 *
 * British PAR weighting:
 *   upperAnterior × 1   lowerAnterior × 1
 *   buccalLeft    × 1   buccalRight   × 1
 *   overjet       × 6   overbite      × 2   centreline × 4
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class GeometricPARService {

    private final LandmarkPointRepository landmarkRepo;
    private final OrthoCaseRepository     caseRepo;
    private final PARScoreRepository      parScoreRepo;
    private final AuditService            auditService;

    // REQUIREMENT 1: Minimum required landmark sets
    //
    // BUG FIX: R1Mid, R1Low, and LCover were missing from these lists even
    // though calculateOverjetScore()/calculateOverbiteScore() below read them
    // directly. A landmark set could pass validateRequiredLandmarks() while
    // missing all three, and overjet/overbite — PAR's two highest-weighted
    // components (x6 and x2) — would then silently compute as 0 every time,
    // since 0 is itself a valid value in both output ranges and so was never
    // caught by validateOutputRanges() either. The frontend's LANDMARK_DEFS
    // (LandmarkPanel.jsx) already prompts the clinician for all three points,
    // so this is purely a backend validation gap, not a frontend mismatch.
    private static final List<String> REQUIRED_UPPER = List.of(
            "R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid",
            "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"
    );
    private static final List<String> REQUIRED_LOWER = List.of(
            "R3M", "R3D", "R2M", "R2D", "R1M", "R1D", "R1Mid", "R1Low",
            "L1M", "L1D", "L2M", "L2D", "L3M", "L3D"
    );
    private static final List<String> REQUIRED_BUCCAL = List.of(
            "RU6", "RL6", "LU6", "LL6", "LCover"
    );

    // REQUIREMENT 1: Clinical output ranges
    //
    // BUG FIX: buccalLeft/buccalRight were capped at 5, but each buccal score
    // is the sum of three sub-scores computed below — AnteroPosterior (0-2) +
    // Transverse (0-4) + Vertical (0-1) — whose maximum is 7, matching the
    // PARScore entity's own @Max(7) constraint. A genuinely severe buccal
    // segment discrepancy (6 or 7) was being rejected here as "outside
    // clinical range" even though it was a valid, correctly computed score.
    private static final Map<String, int[]> CLINICAL_RANGES = Map.of(
            "upperAnterior", new int[]{0, 10},
            "lowerAnterior", new int[]{0, 10},
            "buccalLeft",    new int[]{0, 7},
            "buccalRight",   new int[]{0, 7},
            "overjet",       new int[]{0, 5},
            "overbite",      new int[]{0, 4},
            "centreline",    new int[]{0, 2},
            "totalWeighted", new int[]{0, 100}
    );

    // ── Public entry-point ─────────────────────────────────────────────────

    @Transactional
    public LandmarkDto.AutoScoreResponse calculateAndSave(Long caseId,
                                                          com.parsystem.entity.User performer) {

        OrthoCase orthoCase = caseRepo.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot recalculate a finalised case.");
        }

        List<LandmarkPoint> all = landmarkRepo
                .findByOrthoCaseIdOrderBySlotAscPointNameAsc(caseId);

        long count = all.size();

        // Build lookup maps per slot
        Map<String, Point3d> upper  = toMap(all, LandmarkPoint.Slot.UPPER);
        Map<String, Point3d> lower  = toMap(all, LandmarkPoint.Slot.LOWER);
        Map<String, Point3d> buccal = toMap(all, LandmarkPoint.Slot.BUCCAL);

        // REQUIREMENT 1: Validate ALL required landmarks before calculating
        validateRequiredLandmarks(caseId, upper, lower, buccal);

        // REQUIREMENT 1: Log at WARNING level every auto-calculate trigger
        log.warn("AUTO_CALCULATE_PAR triggered: caseId={} userId={} landmarkCount={}",
                caseId, performer.getId(), count);

        // ── Calculate each component ──────────────────────────────────────
        int upperAnteriorRaw = calculateAnteriorSegmentScore(upper);
        int lowerAnteriorRaw = calculateAnteriorSegmentScore(lower);
        int overjetRaw       = calculateOverjetScore(upper, buccal);
        int overbiteRaw      = calculateOverbiteScore(upper, lower);
        int centrelineRaw    = calculateCentrelineScore(upper, lower);

        int buccalRightAP  = calculateBuccalAnteroPosterior(upper, lower, "R");
        int buccalRightTrs = calculateBuccalTransverse(upper, lower, "R");
        int buccalRightVrt = calculateBuccalVertical(upper, lower, "R");
        int buccalLeftAP   = calculateBuccalAnteroPosterior(upper, lower, "L");
        int buccalLeftTrs  = calculateBuccalTransverse(upper, lower, "L");
        int buccalLeftVrt  = calculateBuccalVertical(upper, lower, "L");

        int buccalRightRaw = buccalRightAP + buccalRightTrs + buccalRightVrt;
        int buccalLeftRaw  = buccalLeftAP  + buccalLeftTrs  + buccalLeftVrt;

        // ── Apply British PAR weights ─────────────────────────────────────
        int upperAnteriorW  = upperAnteriorRaw * PARScore.W_UPPER_ANTERIOR;
        int lowerAnteriorW  = lowerAnteriorRaw * PARScore.W_LOWER_ANTERIOR;
        int overjetW        = overjetRaw       * PARScore.W_OVERJET;
        int overbiteW       = overbiteRaw      * PARScore.W_OVERBITE;
        int centrelineW     = centrelineRaw    * PARScore.W_CENTRELINE;
        int buccalLeftW     = buccalLeftRaw    * PARScore.W_BUCCAL_LEFT;
        int buccalRightW    = buccalRightRaw   * PARScore.W_BUCCAL_RIGHT;

        int totalWeighted = upperAnteriorW + lowerAnteriorW
                          + overjetW + overbiteW + centrelineW
                          + buccalLeftW + buccalRightW;

        // REQUIREMENT 1: Log WARNING with all component values (auditable trail)
        log.warn("PAR_COMPONENTS: caseId={} userId={} landmarks={} " +
                 "upperAnterior={} lowerAnterior={} buccalLeft={} buccalRight={} " +
                 "overjet={} overbite={} centreline={} totalWeighted={}",
                caseId, performer.getId(), count,
                upperAnteriorRaw, lowerAnteriorRaw, buccalLeftRaw, buccalRightRaw,
                overjetRaw, overbiteRaw, centrelineRaw, totalWeighted);

        // REQUIREMENT 1: Validate every output is within clinical range
        // Do NOT save — throw with component name and out-of-range value
        validateOutputRanges(caseId, performer,
                upperAnteriorRaw, lowerAnteriorRaw, buccalLeftRaw, buccalRightRaw,
                overjetRaw, overbiteRaw, centrelineRaw, totalWeighted);

        // ── Persist into par_scores ───────────────────────────────────────
        PARScore score = parScoreRepo.findByOrthoCaseId(caseId).orElse(new PARScore());
        score.setOrthoCase(orthoCase);
        score.setUpperAnterior(upperAnteriorRaw);
        score.setLowerAnterior(lowerAnteriorRaw);
        score.setBuccalLeft(buccalLeftRaw);
        score.setBuccalRight(buccalRightRaw);
        score.setOverjet(overjetRaw);
        score.setOverbite(overbiteRaw);
        score.setCentreline(centrelineRaw);
        score.setTotalWeighted(totalWeighted);
        score.setScoreSource("AUTO_LANDMARK");
        score.setCalculatedAt(LocalDateTime.now());

        // REQUIREMENT 2: POST-treatment classification uses ONLY pre_case_id
        String classification = null;
        if (orthoCase.getStage() == OrthoCase.Stage.POST) {
            classification = classifyPostTreatment(orthoCase, totalWeighted);
        }
        score.setClassification(classification);
        parScoreRepo.save(score);

        auditService.log(performer, "AUTO_CALCULATE_PAR", "OrthoCase", caseId,
                "geometric; landmarks=" + count + "; weighted=" + totalWeighted);

        log.info("Auto PAR for case {}: total={} classification={}", caseId, totalWeighted, classification);

        return LandmarkDto.AutoScoreResponse.builder()
                .upperAnteriorRaw(upperAnteriorRaw)
                .lowerAnteriorRaw(lowerAnteriorRaw)
                .overjetRaw(overjetRaw)
                .overbiteRaw(overbiteRaw)
                .centrelineRaw(centrelineRaw)
                .buccalLeftRaw(buccalLeftRaw)
                .buccalRightRaw(buccalRightRaw)
                .upperAnteriorWeighted(upperAnteriorW)
                .lowerAnteriorWeighted(lowerAnteriorW)
                .overjetWeighted(overjetW)
                .overbiteWeighted(overbiteW)
                .centrelineWeighted(centrelineW)
                .buccalLeftWeighted(buccalLeftW)
                .buccalRightWeighted(buccalRightW)
                .totalWeighted(totalWeighted)
                .classification(classification)
                .landmarksUsed((int) count)
                .message("PAR score calculated from " + count + " 3D landmark points.")
                .build();
    }

    // ── REQUIREMENT 1: Landmark validation ───────────────────────────────

    private void validateRequiredLandmarks(Long caseId,
                                           Map<String, Point3d> upper,
                                           Map<String, Point3d> lower,
                                           Map<String, Point3d> buccal) {
        List<String> missing = new ArrayList<>();

        for (String name : REQUIRED_UPPER) {
            if (!upper.containsKey(name)) missing.add("UPPER:" + name);
        }
        for (String name : REQUIRED_LOWER) {
            if (!lower.containsKey(name)) missing.add("LOWER:" + name);
        }
        for (String name : REQUIRED_BUCCAL) {
            if (!buccal.containsKey(name)) missing.add("BUCCAL:" + name);
        }

        if (!missing.isEmpty()) {
            String detail = "Missing required landmarks: " + String.join(", ", missing);
            log.warn("PAR_VALIDATION: caseId={} {}", caseId, detail);
            throw new IllegalArgumentException(detail);
        }
    }

    /**
     * REQUIREMENT 1: Validate every output component is within clinical range.
     * If ANY component is outside range: do NOT save, throw with component name and value.
     * Audit log PAR_VALIDATION_FAILED.
     */
    private void validateOutputRanges(Long caseId, com.parsystem.entity.User performer,
                                       int upperAnterior, int lowerAnterior,
                                       int buccalLeft, int buccalRight,
                                       int overjet, int overbite,
                                       int centreline, int totalWeighted) {
        Map<String, Integer> components = new LinkedHashMap<>();
        components.put("upperAnterior", upperAnterior);
        components.put("lowerAnterior", lowerAnterior);
        components.put("buccalLeft",    buccalLeft);
        components.put("buccalRight",   buccalRight);
        components.put("overjet",       overjet);
        components.put("overbite",      overbite);
        components.put("centreline",    centreline);
        components.put("totalWeighted", totalWeighted);

        for (Map.Entry<String, Integer> entry : components.entrySet()) {
            String name  = entry.getKey();
            int    value = entry.getValue();
            int[]  range = CLINICAL_RANGES.get(name);
            if (range == null) continue;

            if (value < range[0] || value > range[1]) {
                String detail = "component=" + name + " value=" + value +
                                " expected=" + range[0] + "-" + range[1];
                // REQUIREMENT 11: Audit log PAR_VALIDATION_FAILED
                auditService.log(performer, "PAR_VALIDATION_FAILED", "OrthoCase", caseId, detail);
                log.warn("PAR_VALIDATION_FAILED: caseId={} {}", caseId, detail);
                throw new IllegalArgumentException(
                        "PAR component '" + name + "' value " + value +
                        " is outside clinical range [" + range[0] + ", " + range[1] + "]. " +
                        "Score not saved — please re-check landmark placement.");
            }
        }
    }

    // ── Geometric calculation methods ──────────────────────────────────────

    private int calculateAnteriorSegmentScore(Map<String, Point3d> pts) {
        String[][] pairs = {
            {"R3M", "R2D"},
            {"R2M", "R1D"},
            {"R1M", "L1M"},
            {"L1D", "L2M"},
            {"L2D", "L3M"}
        };
        int total = 0;
        for (String[] pair : pairs) {
            Point3d p1 = pts.get(pair[0]);
            Point3d p2 = pts.get(pair[1]);
            if (p1 != null && p2 != null) {
                total += distanceScore(p1.distance(p2));
            }
        }
        return total;
    }

    private int calculateOverjetScore(Map<String, Point3d> upper, Map<String, Point3d> buccal) {
        Point3d upperIncisor = upper.get("R1Mid");
        Point3d lowerCover   = buccal.get("LCover");

        if (upperIncisor == null || lowerCover == null) {
            log.warn("Missing R1Mid or LCover for overjet calculation");
            return 0;
        }

        double dist = Math.abs(upperIncisor.y - lowerCover.y);

        if (dist <= 3.0) return 0;
        if (dist <= 5.0) return 1;
        if (dist <= 7.0) return 2;
        if (dist <= 9.0) return 3;
        return 4;
    }

    private int calculateOverbiteScore(Map<String, Point3d> upper, Map<String, Point3d> lower) {
        Point3d upperMid  = upper.get("R1Mid");
        Point3d lowerMid  = lower.get("R1Mid");
        Point3d lowerLow  = lower.get("R1Low");

        if (upperMid == null || lowerMid == null || lowerLow == null) {
            log.warn("Missing points for overbite calculation");
            return 0;
        }

        double lowerHeight    = Math.abs(lowerMid.z - lowerLow.z);
        double verticalOffset = upperMid.z - lowerMid.z;

        if (verticalOffset > 0) {
            if (verticalOffset <= 1.0) return 1;
            if (verticalOffset <= 2.0) return 2;
            if (verticalOffset <= 4.0) return 3;
            return 4;
        }

        if (lowerHeight > 0) {
            double coverage = Math.abs(verticalOffset) / lowerHeight;
            if (coverage < 1.0 / 3.0) return 0;
            if (coverage < 2.0 / 3.0) return 1;
            if (coverage < 1.0)       return 2;
            return 3;
        }
        return 0;
    }

    private int calculateCentrelineScore(Map<String, Point3d> upper, Map<String, Point3d> lower) {
        Point3d uL1M = upper.get("L1M");
        Point3d uR1M = upper.get("R1M");
        Point3d lL1M = lower.get("L1M");
        Point3d lR1M = lower.get("R1M");
        Point3d lR1D = lower.get("R1D");

        if (uL1M == null || uR1M == null || lL1M == null || lR1M == null || lR1D == null) {
            log.warn("Missing points for centreline calculation");
            return 0;
        }

        Point3d upperMid = new Point3d((uL1M.x + uR1M.x) / 2.0,
                                       (uL1M.y + uR1M.y) / 2.0,
                                       (uL1M.z + uR1M.z) / 2.0);
        Point3d lowerMid = new Point3d((lL1M.x + lR1M.x) / 2.0,
                                       (lL1M.y + lR1M.y) / 2.0,
                                       (lL1M.z + lR1M.z) / 2.0);

        double discrepancy  = Math.abs(upperMid.x - lowerMid.x);
        double incisorWidth = lR1M.distance(lR1D);

        if (incisorWidth == 0) return 0;

        if (discrepancy <= 0.25 * incisorWidth) return 0;
        if (discrepancy <= 0.50 * incisorWidth) return 1;
        return 2;
    }

    private int calculateBuccalAnteroPosterior(Map<String, Point3d> upper,
                                               Map<String, Point3d> lower,
                                               String side) {
        Point3d upperCusp   = upper.get(side + "6MB");
        Point3d lowerGroove = lower.get(side + "6GB");
        Point3d lowerMesial = lower.get(side + "6M");

        if (upperCusp == null || lowerGroove == null || lowerMesial == null) return 0;

        double discrepancy   = Math.abs(upperCusp.y - lowerGroove.y);
        double halfUnitWidth = lowerMesial.distance(lowerGroove);

        if (discrepancy < (halfUnitWidth / 2.0)) return 0;
        if (discrepancy < halfUnitWidth)          return 1;
        return 2;
    }

    /**
     * British PAR transverse buccal occlusion scoring (Richmond et al. 1992):
     *   0 = no crossbite
     *   1 = crossbite tendency
     *   2 = single tooth in crossbite
     *   3 = more than one tooth in crossbite
     *   4 = more than one tooth in scissor bite
     * Crossbite and scissor bite are opposite-direction displacements from
     * the same neutral zone, not two ends of one linear scale: crossbite is
     * the lower buccal cusp sitting BUCCAL/lateral to the upper buccal cusp;
     * scissor bite is the lower buccal cusp sitting LINGUAL/medial to the
     * upper lingual cusp — the opposite direction, past the upper arch
     * entirely. (See StatPearls "Posterior Crossbite" for this definition.)
     *
     * BUG FIX: the previous version tested the score-2 (crossbite) and
     * score-1 (tendency) thresholds on OPPOSITE sides of the midline for the
     * same side parameter — e.g. for "R" it checked l6MB.x > upperBound for
     * score 2, but l6MB.x <= lowerBound for score 1. Those two conditions
     * can't both describe displacement in the same direction, so depending
     * on where the tooth actually sat, the method could report "tendency"
     * when the tooth had moved further than the "single tooth in crossbite"
     * threshold on the other side, or vice versa. This version always
     * resolves "outward" (away from the midline, the crossbite direction)
     * the same way for both sides, using a coordinate convention where
     * increasing x = toward the patient's right (same convention already
     * used in calculateCentrelineScore above): outward is +x for the right
     * side and -x for the left side.
     *
     * KNOWN LIMITATION (flagged, not invented around): score 3
     * ("> 1 tooth in crossbite") is still unreachable from this method,
     * because it only has cusp positions for the first molar. The clinical
     * criterion is a per-tooth qualitative count across the whole buccal
     * segment (canine to last molar present), which this landmark set
     * doesn't capture — extending it correctly would need crossbite
     * detection on every tooth in the segment, not just R6MB/L6MB. Until
     * that exists, this method can only express a 4-level result
     * (0, 1, 2, 4) and cannot distinguish "single tooth" from "more than
     * one tooth" in crossbite. The scissor-bite threshold (l6GB ± d) is
     * carried over unchanged from the original implementation — it wasn't
     * part of the directional bug, and there's no clinical source in hand
     * specifying where exactly "tendency toward scissor bite" should end
     * and "scissor bite" should begin, so it isn't re-derived here.
     */
    private int calculateBuccalTransverse(Map<String, Point3d> upper,
                                          Map<String, Point3d> lower,
                                          String side) {
        Point3d u6MB = upper.get(side + "6MB");
        Point3d u6MP = upper.get(side + "6MP");
        Point3d u6DB = upper.get(side + "6DB");
        Point3d u6DP = upper.get(side + "6DP");
        Point3d u6GB = upper.get(side + "6GB");
        Point3d l6MB = lower.get(side + "6MB");
        Point3d l6GB = lower.get(side + "6GB");

        if (u6MB == null || u6MP == null || u6DB == null || u6DP == null
                || u6GB == null || l6MB == null || l6GB == null) {
            log.warn("Missing buccal transverse points for side {}", side);
            return 0;
        }

        double upperMidX = (u6MB.x + u6MP.x + u6DB.x + u6DP.x) / 4.0;
        double d = 0.25 * Math.abs(upperMidX - u6GB.x);
        double lowerBound = upperMidX - (3 * d);
        double upperBound = upperMidX + (3 * d);

        boolean isRightSide = "R".equals(side);
        // outBound = the boundary on the crossbite (outward) side of the
        // neutral zone. For the right side, "outward" is +x, so outBound is
        // the upper bound; for the left side, "outward" is -x, so outBound
        // is the lower bound. This mirrors correctly instead of mixing bounds.
        double outBound = isRightSide ? upperBound : lowerBound;

        if (l6MB.x >= lowerBound && l6MB.x <= upperBound) return 0; // neutral zone

        boolean displacedOutward = isRightSide ? (l6MB.x > outBound) : (l6MB.x < outBound);
        if (displacedOutward) {
            double outwardDistance = Math.abs(l6MB.x - outBound);
            return (outwardDistance <= d) ? 1 : 2; // tendency, then single-tooth crossbite
        }

        // Otherwise displaced inward, past the opposing lingual cusp territory
        double scissorLimit = isRightSide ? (l6GB.x - d) : (l6GB.x + d);
        boolean pastScissorLimit = isRightSide ? (l6MB.x < scissorLimit) : (l6MB.x > scissorLimit);
        return pastScissorLimit ? 4 : 1;
    }

    private int calculateBuccalVertical(Map<String, Point3d> upper,
                                        Map<String, Point3d> lower,
                                        String side) {
        int openBiteCount = 0;

        Point3d u6MB = upper.get(side + "6MB"), u6MP = upper.get(side + "6MP"),
                u6DB = upper.get(side + "6DB"), u6DP = upper.get(side + "6DP");
        Point3d l6MB = lower.get(side + "6MB"), l6MP = lower.get(side + "6MP"),
                l6DB = lower.get(side + "6DB"), l6DP = lower.get(side + "6DP");

        if (u6MB != null && u6MP != null && u6DB != null && u6DP != null
                && l6MB != null && l6MP != null && l6DB != null && l6DP != null) {
            double uY = (u6MB.y + u6MP.y + u6DB.y + u6DP.y) / 4.0;
            double lY = (l6MB.y + l6MP.y + l6DB.y + l6DP.y) / 4.0;
            if ((uY - lY) > 2.0) openBiteCount++;
        }

        Point3d u5BT = upper.get(side + "5BT"), u5PT = upper.get(side + "5PT");
        Point3d l5BT = lower.get(side + "5BT"), l5PT = lower.get(side + "5PT");
        if (u5BT != null && u5PT != null && l5BT != null && l5PT != null) {
            double uY = (u5BT.y + u5PT.y) / 2.0;
            double lY = (l5BT.y + l5PT.y) / 2.0;
            if ((uY - lY) > 2.0) openBiteCount++;
        }

        Point3d u4BT = upper.get(side + "4BT"), u4PT = upper.get(side + "4PT");
        Point3d l4BT = lower.get(side + "4BT"), l4PT = lower.get(side + "4PT");
        if (u4BT != null && u4PT != null && l4BT != null && l4PT != null) {
            double uY = (u4BT.y + u4PT.y) / 2.0;
            double lY = (l4BT.y + l4PT.y) / 2.0;
            if ((uY - lY) > 2.0) openBiteCount++;
        }

        return (openBiteCount >= 2) ? 1 : 0;
    }

    // ── Helpers ────────────────────────────────────────────────────────────

    private int distanceScore(double dist) {
        if (dist <= 1.0) return 0;
        if (dist <= 2.0) return 1;
        if (dist <= 4.0) return 2;
        if (dist <= 8.0) return 3;
        return 4;
    }

    private Map<String, Point3d> toMap(List<LandmarkPoint> all, LandmarkPoint.Slot slot) {
        return all.stream()
                  .filter(p -> p.getSlot() == slot)
                  .collect(Collectors.toMap(
                      LandmarkPoint::getPointName,
                      p -> new Point3d(p.getX(), p.getY(), p.getZ()),
                      (a, b) -> a
                  ));
    }

    /**
     * REQUIREMENT 2: PAR classification ONLY uses the explicitly linked PRE case
     * via pre_case_id — NEVER uses "find any PRE case for this patient".
     * Throws IllegalStateException if preCase.parScore is null.
     */
    private String classifyPostTreatment(OrthoCase postCase, int postScore) {
        // REQUIREMENT 2: Use explicitly linked preCase via pre_case_id only
        OrthoCase preCase = postCase.getPreCase();

        if (preCase == null) {
            log.warn("POST case {} has no pre_case_id linked — classification unavailable", postCase.getId());
            return "No Pre-Treatment Reference";
        }

        PARScore preParScore = preCase.getParScore();

        // REQUIREMENT 2: Throw if preCase.parScore is null — do not classify with missing baseline
        if (preParScore == null) {
            throw new IllegalStateException(
                    "PRE case #" + preCase.getId() + " has no PAR score recorded. " +
                    "Cannot classify without a baseline score.");
        }

        int pre = preParScore.getTotalWeighted();
        if (pre == 0) return "No Different or Worse";

        double reductionPct = ((double)(pre - postScore) / pre) * 100.0;
        int    pointDiff    = pre - postScore;

        if (reductionPct >= 30 && pointDiff >= 22) return "Greatly Improved";
        if (reductionPct >= 30)                    return "Improved";
        return "No Different or Worse";
    }
}