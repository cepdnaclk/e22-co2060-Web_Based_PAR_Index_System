package com.parsystem.service;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.*;
import com.parsystem.repository.OrthoCaseRepository;
import com.parsystem.repository.PARScoreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.Optional;

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
     * British standard outcome classification (post-treatment only):
     *   >= 30% reduction AND >= 22 point decrease -> Greatly Improved
     *   >= 30% reduction                          -> Improved
     *   otherwise                                 -> No Different or Worse
     */
    private String classifyPostTreatment(OrthoCase postCase, int postScore) {
        Optional<PARScore> preScoreOpt = caseRepository
                .findByPatientId(postCase.getPatient().getId())
                .stream()
                .filter(c -> c.getStage() == OrthoCase.Stage.PRE && c.getParScore() != null)
                .map(OrthoCase::getParScore)
                .findFirst();

        if (preScoreOpt.isEmpty()) return "No Pre-Treatment Reference";

        int pre = preScoreOpt.get().getTotalWeighted();
        if (pre == 0) return "No Different or Worse";

        double reductionPct = ((double)(pre - postScore) / pre) * 100;
        int    pointDiff    = pre - postScore;

        if (reductionPct >= 30 && pointDiff >= 22) return "Greatly Improved";
        if (reductionPct >= 30)                     return "Improved";
        return "No Different or Worse";
    }
}
