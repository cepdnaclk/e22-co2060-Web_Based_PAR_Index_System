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
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Calculates the PAR index automatically from stored 3D landmark points.
 *
 * Algorithm ported from the senior reference backend (ParScoreService),
 * adapted to work with the current system's OrthoCase / LandmarkPoint model.
 * No ML code is included.
 *
 * British PAR weighting scheme:
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

    // ── Public entry-point ─────────────────────────────────────────────────

    /**
     * Reads all stored landmarks for {@code caseId}, computes every PAR
     * component geometrically, saves the result in {@code par_scores}, and
     * returns a rich {@link LandmarkDto.AutoScoreResponse}.
     */
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
        log.debug("Auto-calculating PAR for case {} using {} landmark points", caseId, count);

        // Build lookup maps per slot
        Map<String, Point3d> upper  = toMap(all, LandmarkPoint.Slot.UPPER);
        Map<String, Point3d> lower  = toMap(all, LandmarkPoint.Slot.LOWER);
        Map<String, Point3d> buccal = toMap(all, LandmarkPoint.Slot.BUCCAL);

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

        // ── Persist into par_scores (same table as manual entry) ──────────
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
        score.setCalculatedAt(LocalDateTime.now());

        // Post-treatment classification
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

    // ── Geometric calculation methods (ported from senior ParScoreService) ─

    /**
     * Anterior segment score: sum of gap scores across 5 contact-point pairs.
     * Works for both upper and lower arch — just pass the relevant map.
     */
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

    /** Overjet: horizontal gap between upper incisor tip and lower incisor cover. */
    private int calculateOverjetScore(Map<String, Point3d> upper, Map<String, Point3d> buccal) {
        Point3d upperIncisor = upper.get("R1Mid");
        Point3d lowerCover   = buccal.get("LCover");

        if (upperIncisor == null || lowerCover == null) {
            log.warn("Missing R1Mid or LCover for overjet calculation");
            return 0;
        }

        double dist = Math.abs(upperIncisor.y - lowerCover.y);
        log.debug("Overjet distance: {}", dist);

        if (dist <= 3.0) return 0;
        if (dist <= 5.0) return 1;
        if (dist <= 7.0) return 2;
        if (dist <= 9.0) return 3;
        return 4;
    }

    /** Overbite: vertical coverage of lower incisor by upper incisor. */
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

        // Open bite (upper above lower tip)
        if (verticalOffset > 0) {
            if (verticalOffset <= 1.0) return 1;
            if (verticalOffset <= 2.0) return 2;
            if (verticalOffset <= 4.0) return 3;
            return 4;
        }

        // Overbite (upper covers lower)
        if (lowerHeight > 0) {
            double coverage = Math.abs(verticalOffset) / lowerHeight;
            if (coverage < 1.0 / 3.0) return 0;
            if (coverage < 2.0 / 3.0) return 1;
            if (coverage < 1.0)       return 2;
            return 3;
        }
        return 0;
    }

    /** Centreline: transverse midline discrepancy between upper and lower arches. */
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

        double discrepancy     = Math.abs(upperMid.x - lowerMid.x);
        double incisorWidth    = lR1M.distance(lR1D);

        if (incisorWidth == 0) return 0;

        if (discrepancy <= 0.25 * incisorWidth) return 0;
        if (discrepancy <= 0.50 * incisorWidth) return 1;
        return 2;
    }

    /** Buccal occlusion — antero-posterior component for one side. */
    private int calculateBuccalAnteroPosterior(Map<String, Point3d> upper,
                                               Map<String, Point3d> lower,
                                               String side) {
        Point3d upperCusp  = upper.get(side + "6MB");
        Point3d lowerGroove = lower.get(side + "6GB");
        Point3d lowerMesial = lower.get(side + "6M");

        if (upperCusp == null || lowerGroove == null || lowerMesial == null) return 0;

        double discrepancy  = Math.abs(upperCusp.y - lowerGroove.y);
        double halfUnitWidth = lowerMesial.distance(lowerGroove);

        if (discrepancy < (halfUnitWidth / 2.0)) return 0;
        if (discrepancy < halfUnitWidth)          return 1;
        return 2;
    }

    /** Buccal occlusion — transverse (crossbite) component for one side. */
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

        // Full crossbite
        if ("L".equals(side) && l6MB.x < lowerBound) return 2;
        if ("R".equals(side) && l6MB.x > upperBound)  return 2;

        // No crossbite
        if (l6MB.x >= lowerBound && l6MB.x <= upperBound) return 0;

        // Tendency
        if ("L".equals(side)) {
            if (l6MB.x >= upperBound && l6MB.x <= l6GB.x + d) return 1;
        } else {
            if (l6MB.x <= lowerBound && l6MB.x >= l6GB.x - d)  return 1;
        }

        return 4; // Scissor bite
    }

    /** Buccal occlusion — vertical (open bite) component for one side. */
    private int calculateBuccalVertical(Map<String, Point3d> upper,
                                        Map<String, Point3d> lower,
                                        String side) {
        int openBiteCount = 0;

        // 6th tooth
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

        // 5th tooth
        Point3d u5BT = upper.get(side + "5BT"), u5PT = upper.get(side + "5PT");
        Point3d l5BT = lower.get(side + "5BT"), l5PT = lower.get(side + "5PT");
        if (u5BT != null && u5PT != null && l5BT != null && l5PT != null) {
            double uY = (u5BT.y + u5PT.y) / 2.0;
            double lY = (l5BT.y + l5PT.y) / 2.0;
            if ((uY - lY) > 2.0) openBiteCount++;
        }

        // 4th tooth
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

    /** Distance (mm) → raw PAR score for anterior contact-point gaps. */
    private int distanceScore(double dist) {
        if (dist <= 1.0) return 0;
        if (dist <= 2.0) return 1;
        if (dist <= 4.0) return 2;
        if (dist <= 8.0) return 3;
        return 4;
    }

    /** Build a name→Point3d lookup for one slot. */
    private Map<String, Point3d> toMap(List<LandmarkPoint> all, LandmarkPoint.Slot slot) {
        return all.stream()
                  .filter(p -> p.getSlot() == slot)
                  .collect(Collectors.toMap(
                      LandmarkPoint::getPointName,
                      p -> new Point3d(p.getX(), p.getY(), p.getZ()),
                      (a, b) -> a  // keep first on duplicates
                  ));
    }

    /**
     * British standard post-treatment outcome classification.
     *   >= 30% reduction AND >= 22 point decrease → Greatly Improved
     *   >= 30% reduction                          → Improved
     *   otherwise                                 → No Different or Worse
     */
    private String classifyPostTreatment(OrthoCase postCase, int postScore) {
        Optional<PARScore> preOpt = caseRepo
                .findByPatientId(postCase.getPatient().getId())
                .stream()
                .filter(c -> c.getStage() == OrthoCase.Stage.PRE && c.getParScore() != null)
                .map(OrthoCase::getParScore)
                .findFirst();

        if (preOpt.isEmpty()) return "No Pre-Treatment Reference";

        int pre = preOpt.get().getTotalWeighted();
        if (pre == 0) return "No Different or Worse";

        double reductionPct = ((double)(pre - postScore) / pre) * 100.0;
        int    pointDiff    = pre - postScore;

        if (reductionPct >= 30 && pointDiff >= 22) return "Greatly Improved";
        if (reductionPct >= 30)                    return "Improved";
        return "No Different or Worse";
    }
}
