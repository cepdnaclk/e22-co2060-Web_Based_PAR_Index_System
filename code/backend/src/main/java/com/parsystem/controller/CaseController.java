package com.parsystem.controller;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * REQUIREMENT 2:  POST case creation finds the most recent FINALIZED PRE case and sets pre_case_id
 * REQUIREMENT 3:  finalize() verifies parScore exists AND totalWeighted > 0
 * REQUIREMENT 3:  unfinalize() admin-only with mandatory reason, logs to audit_log
 * REQUIREMENT 11: Audit log CASE_UNFINALIZED
 * REQUIREMENT 14: After STL upload, fire-and-forget async ML prediction
 * REQUIREMENT 11: Audit log ML_PREDICTION / ML_PREDICTION_FAILED
 * REQUIREMENT 12: POST /api/v1/admin/frontend-error — no auth, logs to audit_log
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cases")
@RequiredArgsConstructor
public class CaseController {

    @Value("${app.storage.base-dir}")
    private String baseDir;

    private final OrthoCaseRepository    caseRepository;
    private final PatientRepository      patientRepository;
    private final Model3DFileRepository  model3DFileRepository;
    private final PARCalculatorService   parCalculatorService;
    private final StorageService         storageService;
    private final AuditService           auditService;
    private final MLClientService        mlClientService;
    private final AuditLogRepository     auditLogRepository;

    // REQUIREMENT 14: Fire-and-forget async for ML — single thread executor
    private final ExecutorService mlExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "ml-predict-thread");
        t.setDaemon(true);
        return t;
    });

    // ── CREATE CASE ───────────────────────────────────────────────────────

    @PostMapping
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<OrthoCase> create(
            @RequestParam Long patientId,
            @RequestParam OrthoCase.Stage stage,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal User user) {

        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new IllegalArgumentException("Patient not found: " + patientId));

        OrthoCase preCaseRef = null;

        if (stage == OrthoCase.Stage.POST) {
            // REQUIREMENT 2: Find the most recent FINALIZED PRE case for this patient
            Optional<OrthoCase> mostRecentPre = caseRepository.findByPatientId(patientId).stream()
                    .filter(c -> c.getStage() == OrthoCase.Stage.PRE && c.isFinalized())
                    .max((a, b) -> a.getCreatedAt().compareTo(b.getCreatedAt()));

            if (mostRecentPre.isEmpty()) {
                throw new IllegalStateException(
                        "A finalised pre-treatment case is required before creating a post-treatment case.");
            }
            preCaseRef = mostRecentPre.get();
        }

        OrthoCase.OrthoCaseBuilder builder = OrthoCase.builder()
                .patient(patient)
                .createdBy(user)
                .stage(stage)
                .notes(notes);

        // REQUIREMENT 2: Set pre_case_id on POST cases — never leave null for POST cases
        if (preCaseRef != null) {
            builder.preCase(preCaseRef);
        }

        OrthoCase saved = caseRepository.save(builder.build());
        auditService.log(user, "CREATE_CASE", "OrthoCase", saved.getId(), "stage=" + stage);

        return ResponseEntity.ok(saved);
    }

    // ── GET CASES ────────────────────────────────────────────────────────

    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<List<OrthoCase>> getByPatient(@PathVariable Long patientId) {
        return ResponseEntity.ok(caseRepository.findByPatientId(patientId));
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<OrthoCase> getById(@PathVariable Long id) {
        return ResponseEntity.ok(caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id)));
    }

    // ── UPLOAD 3D MODELS ─────────────────────────────────────────────────

    /**
     * REQUIREMENT 14: After saving all 3 STL files, trigger ML prediction async.
     * Store mlPredictedScore and mlConfidenceNote on OrthoCase.
     * Audit log ML_PREDICTION or ML_PREDICTION_FAILED.
     */
    @PostMapping("/{id}/models")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<Map<String, String>> uploadModels(
            @PathVariable Long id,
            @RequestPart("upperFile")  MultipartFile upperFile,
            @RequestPart("lowerFile")  MultipartFile lowerFile,
            @RequestPart("buccalFile") MultipartFile buccalFile,
            @AuthenticationPrincipal User user) throws IOException {

        OrthoCase orthoCase = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot upload files to a finalised case.");
        }

        saveModel(upperFile,  "UPPER",  id, orthoCase, user);
        saveModel(lowerFile,  "LOWER",  id, orthoCase, user);
        saveModel(buccalFile, "BUCCAL", id, orthoCase, user);

        auditService.log(user, "UPLOAD_3D_MODELS", "OrthoCase", id, "3 files uploaded");

        // REQUIREMENT 14: Resolve absolute paths of saved files from DB after all 3 are saved
        // Only call ML if all 3 slots present — fire-and-forget async
        triggerMLPredictionAsync(id, user);

        return ResponseEntity.ok(Map.of("message", "3D models uploaded successfully."));
    }

    // ── GET MODEL FILE ────────────────────────────────────────────────────

    @GetMapping("/{id}/models/{slot}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<?> getModelFile(
            @PathVariable Long id,
            @PathVariable String slot,
            @AuthenticationPrincipal User user) throws IOException {

        OrthoCase orthoCase = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        Model3DFile modelFile = orthoCase.getModelFiles().stream()
                .filter(f -> f.getSlot().name().equalsIgnoreCase(slot))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Model file not found for slot: " + slot));

        // BUG FIX: baseDir ("./uploads") must be resolved to an absolute path before
        // resolving the stored relative storagePath, or this depends on JVM working
        // directory and can silently double up / mis-resolve. Matches the fix already
        // applied in FileServeController and TrainingSetController.
        Path basePath = Paths.get(baseDir).toAbsolutePath().normalize();
        Path filePath  = basePath
                .resolve(modelFile.getStoragePath())
                .normalize();

        Resource resource = new UrlResource(filePath.toUri());

        if (!resource.exists() || !resource.isReadable()) {
            // BUG FIX: previously returned an empty 404 body, so the frontend
            // could not tell "file genuinely missing on disk" apart from a
            // network error and showed a generic, unhelpful message. This
            // happens for cases whose storage_path was written before the
            // basePath-relativization fix in StorageService — the path
            // recorded in the DB no longer resolves to a real file under
            // the current volume layout.
            log.warn("Model file not readable: case={} slot={} resolvedPath={} storagePath={}",
                    id, slot, filePath, modelFile.getStoragePath());
            return ResponseEntity.status(404).body(Map.of(
                    "error", "MODEL_FILE_MISSING",
                    "message", "This 3D model file is missing on the server. Please re-upload it."
            ));
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + modelFile.getFileName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    // ── REQUIREMENT 8: Model integrity verification ───────────────────────

    @GetMapping("/{id}/models/{slot}/verify")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<Map<String, Object>> verifyModel(
            @PathVariable Long id,
            @PathVariable String slot) throws IOException {

        OrthoCase orthoCase = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        Model3DFile modelFile = orthoCase.getModelFiles().stream()
                .filter(f -> f.getSlot().name().equalsIgnoreCase(slot))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Model file not found: " + slot));

        // Note: storedChecksum would come from model3d_files.file_checksum if populated
        Map<String, Object> result = storageService.verifyIntegrity(
                modelFile.getStoragePath(), null);

        return ResponseEntity.ok(result);
    }

    // ── CALCULATE PAR ─────────────────────────────────────────────────────

    @PostMapping("/{id}/calculate")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<PARScore> calculate(
            @PathVariable Long id,
            @Valid @RequestBody PARScoreDto.CalculateRequest request,
            @AuthenticationPrincipal User user) {

        return ResponseEntity.ok(parCalculatorService.calculate(id, request, user));
    }

    // ── REQUIREMENT (new): apply ML predicted score as the case's final PAR ─

    /**
     * Lets the orthodontist explicitly choose the ML predicted total as the
     * case's official PAR score instead of entering a manual breakdown.
     * Only the total is known from ML, so the per-component fields are left
     * at 0 and PARScore.scoreSource is set to "ML" — the frontend uses this
     * to show the total without implying a real component breakdown.
     */
    @PostMapping("/{id}/calculate/ml")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<PARScore> calculateFromMl(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        return ResponseEntity.ok(parCalculatorService.calculateFromML(id, user));
    }

    // ── FINALIZE ──────────────────────────────────────────────────────────

    /**
     * REQUIREMENT 3: finalize() must verify parScore exists AND totalWeighted > 0.
     * Record finalizedBy and finalizedAt.
     */
    @PostMapping("/{id}/finalize")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<Map<String, String>> finalize(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        OrthoCase c = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        if (c.isFinalized()) {
            throw new IllegalStateException("Case is already finalised.");
        }

        // REQUIREMENT 3: Verify parScore record exists AND totalWeighted > 0
        if (c.getParScore() == null) {
            throw new IllegalStateException(
                    "A PAR score must be calculated before finalising. " +
                    "Please complete scoring first.");
        }
        if (c.getParScore().getTotalWeighted() <= 0) {
            throw new IllegalStateException(
                    "PAR score is 0 — scoring was not completed. " +
                    "Please complete all landmark placements and recalculate before finalising.");
        }

        c.setFinalized(true);
        c.setFinalizedBy(user);
        c.setFinalizedAt(LocalDateTime.now());
        caseRepository.save(c);

        auditService.log(user, "FINALIZE_CASE", "OrthoCase", id,
                "stage=" + c.getStage() + " parScore=" + c.getParScore().getTotalWeighted());

        String msg = c.getStage() == OrthoCase.Stage.PRE
                ? "Pre-treatment case finalised. Post-treatment scoring is now available."
                : "Post-treatment case finalised successfully.";

        return ResponseEntity.ok(Map.of("message", msg));
    }

    // ── REQUIREMENT 3: UNFINALIZE (admin only) ────────────────────────────

    /**
     * REQUIREMENT 3: Admin-only unfinalize endpoint with mandatory reason.
     * REQUIREMENT 11: Audit log CASE_UNFINALIZED.
     */
    @PutMapping("/{id}/unfinalize")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Map<String, String>> unfinalize(
            @PathVariable Long id,
            @RequestParam String reason,
            @AuthenticationPrincipal User user) {

        if (reason == null || reason.isBlank()) {
            throw new IllegalArgumentException("A reason is required for unfinalizing a case.");
        }

        OrthoCase c = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        if (!c.isFinalized()) {
            throw new IllegalStateException("Case is not currently finalised.");
        }

        c.setFinalized(false);
        c.setFinalizedBy(null);
        c.setFinalizedAt(null);
        caseRepository.save(c);

        // REQUIREMENT 11: Audit log CASE_UNFINALIZED with reason
        auditService.log(user, "CASE_UNFINALIZED", "OrthoCase", id,
                "caseId=" + id + " reason=" + reason);

        log.warn("Case {} unfinalized by admin userId={} reason={}", id, user.getId(), reason);

        return ResponseEntity.ok(Map.of("message", "Case #" + id + " has been unfinalised."));
    }

    // ── REQUIREMENT 12: Frontend error logging ────────────────────────────

    /**
     * REQUIREMENT 12: POST /api/v1/admin/frontend-error — no auth required
     * (called from ErrorBoundary before auth state is known).
     * Logs to audit_log with action="FRONTEND_ERROR".
     */
    @PostMapping("/admin/frontend-error")
    public ResponseEntity<Void> logFrontendError(@RequestBody Map<String, String> body) {
        String message = body.getOrDefault("message", "Unknown error");
        String stack   = body.getOrDefault("stack", "");

        // Truncate to avoid excessive log entry size
        if (stack.length() > 2000) stack = stack.substring(0, 2000) + "...[truncated]";

        AuditLog errorLog = AuditLog.builder()
                .action("FRONTEND_ERROR")
                .entityType("Frontend")
                .entityId(null)
                .detail("message=" + message + "\nstack=" + stack)
                .build();

        // Note: performedBy is nullable for frontend errors (user may not be authed)
        auditLogRepository.save(errorLog);
        log.error("Frontend error logged: {}", message);

        return ResponseEntity.ok().build();
    }

    // ── ML PREDICTION (async internal) ───────────────────────────────────

    /**
     * REQUIREMENT 14: Fire-and-forget async ML prediction.
     * Resolves absolute paths of saved files from DB after all 3 are saved.
     * Stores mlPredictedScore and mlConfidenceNote on OrthoCase.
     */
    private void triggerMLPredictionAsync(Long caseId, User user) {
        mlExecutor.submit(() -> {
            try {
                OrthoCase c = caseRepository.findById(caseId).orElse(null);
                if (c == null) return;

                // REQUIREMENT 14: Only call ML if all 3 slots present
                List<Model3DFile> files = model3DFileRepository.findByOrthoCaseId(caseId);
                Optional<Model3DFile> upper  = files.stream().filter(f -> f.getSlot() == Model3DFile.Slot.UPPER).findFirst();
                Optional<Model3DFile> lower  = files.stream().filter(f -> f.getSlot() == Model3DFile.Slot.LOWER).findFirst();
                Optional<Model3DFile> buccal = files.stream().filter(f -> f.getSlot() == Model3DFile.Slot.BUCCAL).findFirst();

                if (upper.isEmpty() || lower.isEmpty() || buccal.isEmpty()) {
                    log.debug("ML prediction skipped for case {} — not all 3 slots present", caseId);
                    return;
                }

                // Resolve absolute paths
                Path basePath = Paths.get(baseDir).toAbsolutePath();
                String upperPath  = basePath.resolve(upper.get().getStoragePath()).toString();
                String lowerPath  = basePath.resolve(lower.get().getStoragePath()).toString();
                String buccalPath = basePath.resolve(buccal.get().getStoragePath()).toString();

                Optional<Float> prediction = mlClientService.predictPAR(upperPath, lowerPath, buccalPath);

                if (prediction.isPresent()) {
                    float score = prediction.get();

                    // BUG FIX: this previously computed
                    // `caseRepository.findAll().size()` into approvedCount on
                    // every single ML prediction — a full table scan of
                    // ortho_cases — then never used the result anywhere.
                    // buildConfidenceNote() doesn't take it as a parameter.
                    // Removed; see buildConfidenceNote() below if a real
                    // dataset-size-aware confidence note is wanted later.
                    String confidenceNote = score >= 0 ? buildConfidenceNote(caseId, score) : null;

                    c.setMlPredictedScore(score);
                    c.setMlConfidenceNote(confidenceNote);
                    caseRepository.save(c);

                    // REQUIREMENT 11
                    auditService.log(user, "ML_PREDICTION", "OrthoCase", caseId,
                            "caseId=" + caseId + " score=" + score + " confidence=" + confidenceNote);

                    log.info("ML prediction for case {}: score={}", caseId, score);
                } else {
                    // REQUIREMENT 11
                    auditService.log(user, "ML_PREDICTION_FAILED", "OrthoCase", caseId,
                            "caseId=" + caseId + " reason=ML service returned no prediction");
                    log.warn("ML prediction returned no result for case {}", caseId);
                }

            } catch (Exception e) {
                log.warn("ML prediction async failed for case {}: {}", caseId, e.getMessage());
                auditService.log(user, "ML_PREDICTION_FAILED", "OrthoCase", caseId,
                        "caseId=" + caseId + " reason=" + e.getMessage());
            }
        });
    }

    private String buildConfidenceNote(Long caseId, float score) {
        // Confidence note is set based on score range and context
        if (score >= 0 && score <= 100) {
            return "Experimental ML prediction. Verify with clinical landmark scoring.";
        }
        return "Low confidence — prediction outside typical range.";
    }

    // ── INTERNAL HELPER ───────────────────────────────────────────────────

    private void saveModel(MultipartFile file, String slot, Long refId,
                           OrthoCase orthoCase, User uploader) throws IOException {

        model3DFileRepository.findByOrthoCaseId(refId).stream()
                .filter(m -> m.getSlot().name().equalsIgnoreCase(slot))
                .forEach(m -> {
                    try {
                        storageService.delete(m.getStoragePath());
                    } catch (Exception e) {
                        log.warn("Failed to delete old file: {}", m.getStoragePath());
                    }
                    model3DFileRepository.deleteById(m.getId());
                });

        String path    = storageService.storeClinical(file, refId, slot);
        BigDecimal sizeMb = storageService.toMb(file);

        Model3DFile model = Model3DFile.builder()
                .orthoCase(orthoCase)
                .slot(Model3DFile.Slot.valueOf(slot))
                .fileName(file.getOriginalFilename())
                .mimeType(file.getContentType())
                .fileSizeMb(sizeMb)
                .storagePath(path)
                .uploadedBy(uploader)
                .build();

        model3DFileRepository.save(model);
    }
}