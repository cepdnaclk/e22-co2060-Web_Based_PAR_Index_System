package com.parsystem.service;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.*;
import com.parsystem.repository.OrthoCaseRepository;
import com.parsystem.repository.PARScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;

@Service
@RequiredArgsConstructor
public class PARCalculatorService {

    private final OrthoCaseRepository caseRepository;
    private final PARScoreRepository  parScoreRepository;
    private final AuditService        auditService;

    @Transactional
    public PARScore calculate(Long caseId, PARScoreDto.CalculateRequest req, User performer) {
        OrthoCase orthoCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot recalculate a finalised case.");
        }

        // Reuse existing score row or create new
        PARScore score = parScoreRepository.findByOrthoCaseId(caseId)
                .orElse(new PARScore());

        score.setOrthoCase(orthoCase);
        score.setUpperAnterior(req.getUpperAnterior());
        score.setLowerAnterior(req.getLowerAnterior());
        score.setBuccalLeft(req.getBuccalLeft());
        score.setBuccalRight(req.getBuccalRight());
        score.setOverjet(req.getOverjet());
        score.setOverbite(req.getOverbite());
        score.setCentreline(req.getCentreline());
        score.setScoreSource("MANUAL");

        // FIXED: explicitly compute and store the weighted total
        int weighted = score.computeWeighted();
        score.setTotalWeighted(weighted);
        score.setCalculatedAt(LocalDateTime.now());

        // Classify post-treatment cases
        if (orthoCase.getStage() == OrthoCase.Stage.POST) {
            score.setClassification(classifyPostTreatment(orthoCase, weighted));
        } else {
            score.setClassification(null);
        }

        PARScore saved = parScoreRepository.save(score);
        auditService.log(performer, "CALCULATE_PAR", "OrthoCase", caseId,
                "weighted=" + weighted);
        return saved;
    }

    /**
     * Applies the case's ML predicted total PAR score as the case's final
     * PARScore record, instead of a manual component-by-component entry.
     *
     * The ML model only returns a single total score, not a per-component
     * breakdown, so upperAnterior, lowerAnterior, buccalLeft, buccalRight,
     * overjet, overbite, and centreline are all left at 0, and scoreSource
     * is set to "ML" so the UI can show the total without implying a real
     * component breakdown.
     */
    @Transactional
    public PARScore calculateFromML(Long caseId, User performer) {
        OrthoCase orthoCase = caseRepository.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot recalculate a finalised case.");
        }

        if (orthoCase.getMlPredictedScore() == null) {
            throw new IllegalStateException(
                    "No ML predicted score is available for this case yet.");
        }

        int weighted = Math.round(orthoCase.getMlPredictedScore());

        PARScore score = parScoreRepository.findByOrthoCaseId(caseId)
                .orElse(new PARScore());

        score.setOrthoCase(orthoCase);
        score.setUpperAnterior(0);
        score.setLowerAnterior(0);
        score.setBuccalLeft(0);
        score.setBuccalRight(0);
        score.setOverjet(0);
        score.setOverbite(0);
        score.setCentreline(0);
        score.setTotalWeighted(weighted);
        score.setScoreSource("ML");
        score.setCalculatedAt(LocalDateTime.now());

        if (orthoCase.getStage() == OrthoCase.Stage.POST) {
            score.setClassification(classifyPostTreatment(orthoCase, weighted));
        } else {
            score.setClassification(null);
        }

        PARScore saved = parScoreRepository.save(score);
        auditService.log(performer, "CALCULATE_PAR_FROM_ML", "OrthoCase", caseId,
                "mlPredictedScore=" + orthoCase.getMlPredictedScore() + " weighted=" + weighted);
        return saved;
    }

    /**
     * British standard outcome classification (post-treatment only):
     *   >= 30% reduction AND >= 22 point decrease -> Greatly Improved
     *   >= 30% reduction                          -> Improved
     *   otherwise                                 -> No Different or Worse
     *
     * BUG FIX: this previously found ANY PRE-stage case for the patient with a
     * non-null PARScore via an unordered findFirst(), ignoring the explicit
     * pre_case_id link set on the POST case at creation time (see
     * CaseController, REQUIREMENT 2). For any patient with more than one
     * PRE/POST treatment cycle, that lookup could silently grab the wrong PRE
     * case and produce a wrong classification. It's now aligned with
     * GeometricPARService's classifyPostTreatment, which uses
     * postCase.getPreCase() exclusively and never falls back to a guess.
     */
    private String classifyPostTreatment(OrthoCase postCase, int postScore) {
        OrthoCase preCase = postCase.getPreCase();

        if (preCase == null) {
            return "No Pre-Treatment Reference";
        }

        PARScore preParScore = preCase.getParScore();

        if (preParScore == null) {
            throw new IllegalStateException(
                    "PRE case #" + preCase.getId() + " has no PAR score recorded. " +
                    "Cannot classify without a baseline score.");
        }

        int pre = preParScore.getTotalWeighted();
        if (pre == 0) return "No Different or Worse";

        double reductionPct = ((double)(pre - postScore) / pre) * 100;
        int    pointDiff    = pre - postScore;

        if (reductionPct >= 30 && pointDiff >= 22) return "Greatly Improved";
        if (reductionPct >= 30)                     return "Improved";
        return "No Different or Worse";
    }
}