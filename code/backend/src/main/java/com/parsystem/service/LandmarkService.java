package com.parsystem.service;

import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.LandmarkPoint;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.User;
import com.parsystem.repository.LandmarkPointRepository;
import com.parsystem.repository.OrthoCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class LandmarkService {

    private final LandmarkPointRepository landmarkRepo;
    private final OrthoCaseRepository     caseRepo;
    private final AuditService            auditService;

    // ── Save a batch of points for one slot ────────────────────────────────

    @Transactional
    public List<LandmarkDto.LandmarkResponse> submitPoints(Long caseId,
                                                           LandmarkDto.SubmitRequest req,
                                                           User performer) {
        OrthoCase orthoCase = caseRepo.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot modify a finalised case.");
        }

        // Replace existing points for this slot so the user can re-place freely
        landmarkRepo.deleteByOrthoCaseIdAndSlot(caseId, req.getSlot());

        List<LandmarkPoint> entities = req.getPoints().stream()
                .map(pd -> LandmarkPoint.builder()
                        .orthoCase(orthoCase)
                        .slot(req.getSlot())
                        .pointName(pd.getName())
                        .x(pd.getX())
                        .y(pd.getY())
                        .z(pd.getZ())
                        .build())
                .collect(Collectors.toList());

        List<LandmarkPoint> saved = landmarkRepo.saveAll(entities);
        auditService.log(performer, "SUBMIT_LANDMARKS", "OrthoCase", caseId,
                "slot=" + req.getSlot() + " count=" + saved.size());

        log.debug("Saved {} landmarks for case {} slot {}", saved.size(), caseId, req.getSlot());
        return saved.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Retrieve all landmarks for a case ──────────────────────────────────

    @Transactional(readOnly = true)
    public List<LandmarkDto.LandmarkResponse> getPoints(Long caseId) {
        return landmarkRepo
                .findByOrthoCaseIdOrderBySlotAscPointNameAsc(caseId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    // ── Clear all landmarks for a case ─────────────────────────────────────

    @Transactional
    public void clearPoints(Long caseId, User performer) {
        OrthoCase orthoCase = caseRepo.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot modify a finalised case.");
        }

        long deleted = landmarkRepo.countByOrthoCaseId(caseId);
        landmarkRepo.deleteByOrthoCaseId(caseId);
        auditService.log(performer, "CLEAR_LANDMARKS", "OrthoCase", caseId,
                "deleted=" + deleted);
    }

    // ── Confirm ML-predicted points for a slot ─────────────────────────────

    /**
     * Marks all ML_PREDICTED landmarks in one slot as confirmed, i.e. the
     * clinician has reviewed them (optionally adjusting coordinates first
     * via a normal submitPoints call) and accepts them as clinically valid.
     * Only after this will auto-calculate include them.
     */
    @Transactional
    public List<LandmarkDto.LandmarkResponse> confirmPredicted(Long caseId,
                                                               LandmarkPoint.Slot slot,
                                                               User performer) {
        OrthoCase orthoCase = caseRepo.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot modify a finalised case.");
        }

        List<LandmarkPoint> predicted = landmarkRepo.findByOrthoCaseIdAndSlot(caseId, slot).stream()
                .filter(p -> p.getSource() == LandmarkPoint.Source.ML_PREDICTED && !p.isConfirmed())
                .collect(Collectors.toList());

        predicted.forEach(p -> p.setConfirmed(true));
        List<LandmarkPoint> saved = landmarkRepo.saveAll(predicted);

        auditService.log(performer, "CONFIRM_ML_LANDMARKS", "OrthoCase", caseId,
                "slot=" + slot + " count=" + saved.size());

        return saved.stream().map(this::toResponse).collect(Collectors.toList());
    }

    // ── Mapper ─────────────────────────────────────────────────────────────

    private LandmarkDto.LandmarkResponse toResponse(LandmarkPoint p) {
        return LandmarkDto.LandmarkResponse.builder()
                .id(p.getId())
                .slot(p.getSlot().name())
                .pointName(p.getPointName())
                .x(p.getX())
                .y(p.getY())
                .z(p.getZ())
                .createdAt(p.getCreatedAt())
                .source(p.getSource().name())
                .confirmed(p.isConfirmed())
                .build();
    }
}
