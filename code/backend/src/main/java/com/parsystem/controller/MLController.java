package com.parsystem.controller;

import com.parsystem.entity.AuditLog;
import com.parsystem.entity.MLMetrics;
import com.parsystem.entity.User;
import com.parsystem.repository.AuditLogRepository;
import com.parsystem.service.AuditService;
import com.parsystem.service.MLClientService;
import com.parsystem.service.MLService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * REQUIREMENT 10: Rollback endpoint — admin only — calls FastAPI rollback
 * REQUIREMENT 11: Admin audit-log endpoint with date range filter
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/ml")
@RequiredArgsConstructor
public class MLController {

    private final MLService          mlService;
    private final MLClientService    mlClientService;
    private final AuditService       auditService;
    private final AuditLogRepository auditLogRepository;

    /**
     * Overall ML system status.
     * GET /api/v1/ml/status
     */
    @GetMapping("/status")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN','ORTHODONTIST')")
    public ResponseEntity<MLService.MLStatus> getStatus() {
        return ResponseEntity.ok(mlService.getStatus());
    }

    /**
     * All completed training run metrics (for charts).
     * GET /api/v1/ml/metrics
     */
    @GetMapping("/metrics")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<List<MLMetrics>> getMetrics() {
        return ResponseEntity.ok(mlService.getAllMetrics());
    }

    /**
     * Epoch-by-epoch metrics for a specific model version.
     * GET /api/v1/ml/metrics/{version}
     */
    @GetMapping("/metrics/{version}")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<List<MLMetrics>> getMetricsByVersion(
            @PathVariable String version) {
        return ResponseEntity.ok(mlService.getMetricsByVersion(version));
    }

    /**
     * Current user's own training runs.
     * GET /api/v1/ml/my-runs
     */
    @GetMapping("/my-runs")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<List<MLMetrics>> getMyRuns(
            @AuthenticationPrincipal User user) {
        return ResponseEntity.ok(mlService.getMyRuns(user));
    }

    /**
     * Start a training run.
     * POST /api/v1/ml/train
     * Body: { modelVersion: "v1.2", epochs: 50 }
     *
     * REQUIREMENT 14: Returns 409 if training already in progress.
     */
    @PostMapping("/train")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<MLMetrics> startTraining(
            @RequestBody Map<String, Object> body,
            @AuthenticationPrincipal User user) {

        String modelVersion = (String) body.get("modelVersion");
        int    epochs       = body.get("epochs") instanceof Integer
                ? (Integer) body.get("epochs")
                : Integer.parseInt(body.get("epochs").toString());

        if (modelVersion == null || modelVersion.isBlank()) {
            throw new IllegalArgumentException("modelVersion is required.");
        }
        if (epochs < 1 || epochs > 500) {
            throw new IllegalArgumentException("epochs must be between 1 and 500.");
        }

        return ResponseEntity.ok(mlService.startTraining(modelVersion, epochs, user));
    }

    /**
     * REQUIREMENT 10: Model rollback — admin only.
     * POST /api/v1/ml/rollback/{version}
     * Copies models/{version}.pt to models/latest.pt via FastAPI.
     * REQUIREMENT 11: Audit log ML_MODEL_ROLLBACK.
     */
    @PostMapping("/rollback/{version}")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> rollback(
            @PathVariable String version,
            @AuthenticationPrincipal User user) {

        boolean success = mlClientService.rollback(version);

        if (!success) {
            throw new IllegalStateException(
                    "Model rollback to version '" + version + "' failed. " +
                    "Check ML service logs.");
        }

        // REQUIREMENT 11: Audit log rollback
        auditService.log(user, "ML_MODEL_ROLLBACK", "MLMetrics", null,
                "from=latest to=" + version);

        log.warn("ML model rolled back to version {} by admin userId={}", version, user.getId());

        return ResponseEntity.ok(Map.of("message", "Model successfully rolled back to version: " + version));
    }

    /**
     * REQUIREMENT 11: Admin audit logs with date range filter.
     * GET /api/v1/admin/audit-logs?from=...&to=...&page=0&size=50
     * AuditLog records must never be deletable.
     */
    @GetMapping("/admin/audit-logs")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Page<AuditLog>> getAuditLogs(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE_TIME) LocalDateTime to,
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {

        PageRequest pageable = PageRequest.of(page, size, Sort.by("performedAt").descending());

        Page<AuditLog> result;
        if (from != null && to != null) {
            result = auditLogRepository.findByPerformedAtBetweenOrderByPerformedAtDesc(from, to, pageable);
        } else {
            result = auditLogRepository.findAllByOrderByPerformedAtDesc(pageable);
        }

        return ResponseEntity.ok(result);
    }
}
