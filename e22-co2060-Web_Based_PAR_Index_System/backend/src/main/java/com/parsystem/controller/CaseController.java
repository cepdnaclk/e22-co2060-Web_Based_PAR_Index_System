package com.parsystem.controller;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
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
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/cases")
@RequiredArgsConstructor
public class CaseController {

    private final OrthoCaseRepository caseRepository;
    private final PatientRepository patientRepository;
    private final Model3DFileRepository model3DFileRepository;
    private final PARCalculatorService parCalculatorService;
    private final StorageService storageService;
    private final AuditService auditService;

    /** Create a new orthodontic case linked to a patient. Only ORTHODONTIST may create cases. */
    @PostMapping
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<OrthoCase> create(
            @RequestParam Long patientId,
            @RequestParam OrthoCase.Stage stage,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal User user) {

        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new IllegalArgumentException("Patient not found: " + patientId));

        // Enforce: POST stage can only be created after a PRE case is finalised
        if (stage == OrthoCase.Stage.POST) {
            boolean preFinalised = caseRepository.findByPatientId(patientId).stream()
                    .anyMatch(c -> c.getStage() == OrthoCase.Stage.PRE && c.isFinalized());
            if (!preFinalised) {
                throw new IllegalStateException(
                        "A finalised pre-treatment case is required before creating a post-treatment case.");
            }
        }

        OrthoCase c = OrthoCase.builder()
                .patient(patient)
                .createdBy(user)
                .stage(stage)
                .notes(notes)
                .build();

        OrthoCase saved = caseRepository.save(c);
        auditService.log(user, "CREATE_CASE", "OrthoCase", saved.getId(), "stage=" + stage);
        return ResponseEntity.ok(saved);
    }

    /** Get all cases for a patient. ORTHODONTIST and ADMIN can read. */
    @GetMapping("/patient/{patientId}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<List<OrthoCase>> getByPatient(@PathVariable Long patientId) {
        return ResponseEntity.ok(caseRepository.findByPatientId(patientId));
    }

    /** Get a single case. ORTHODONTIST and ADMIN can read. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<OrthoCase> getById(@PathVariable Long id) {
        return ResponseEntity.ok(caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id)));
    }

    /**
     * Upload three 3D model files for a case.
     * Expects multipart fields: upperFile, lowerFile, buccalFile
     * Only ORTHODONTIST can upload.
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
        return ResponseEntity.ok(Map.of("message", "3D models uploaded successfully."));
    }

    /**
     * Serve a 3D model file for in-browser viewing.
     * GET /api/v1/cases/{id}/models/{slot}
     * ORTHODONTIST and ADMIN can access.
     */
    @GetMapping("/{id}/models/{slot}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<Resource> getModelFile(
            @PathVariable Long id,
            @PathVariable String slot,
            @AuthenticationPrincipal User user) throws IOException {

        OrthoCase orthoCase = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));

        Model3DFile modelFile = orthoCase.getModelFiles().stream()
                .filter(f -> f.getSlot().name().equalsIgnoreCase(slot))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Model file not found for slot: " + slot));

        Path filePath = Paths.get(modelFile.getStoragePath());
        Resource resource = new UrlResource(filePath.toUri());

        if (!resource.exists() || !resource.isReadable()) {
            throw new RuntimeException("File not found or not readable: " + filePath);
        }

        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + modelFile.getFileName() + "\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(resource);
    }

    /** Compute PAR score for a case. Only ORTHODONTIST. */
    @PostMapping("/{id}/calculate")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<PARScore> calculate(
            @PathVariable Long id,
            @Valid @RequestBody PARScoreDto.CalculateRequest request,
            @AuthenticationPrincipal User user) {

        return ResponseEntity.ok(parCalculatorService.calculate(id, request, user));
    }

    /**
     * Finalise a case (locks it — no further edits).
     * After finalising PRE, POST cases become available.
     * POST cases can be finalised too — supports multiple post-treatment sessions.
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

        if (c.getParScore() == null) {
            throw new IllegalStateException("A PAR score must be calculated before finalising.");
        }

        c.setFinalized(true);
        caseRepository.save(c);
        auditService.log(user, "FINALIZE_CASE", "OrthoCase", id, "stage=" + c.getStage());

        String msg = c.getStage() == OrthoCase.Stage.PRE
                ? "Pre-treatment case finalised. Post-treatment scoring is now available."
                : "Post-treatment case finalised successfully.";

        return ResponseEntity.ok(Map.of("message", msg));
    }

    // ── helper ────────────────────────────────────────────────────────

    private void saveModel(MultipartFile file, String slot, Long refId,
                           OrthoCase orthoCase, User uploader) throws IOException {

        // Remove existing file for this slot before saving a new one
        model3DFileRepository.findAll().stream()
                .filter(m -> m.getOrthoCase() != null
                        && m.getOrthoCase().getId().equals(refId)
                        && m.getSlot().name().equals(slot))
                .forEach(m -> model3DFileRepository.deleteById(m.getId()));

        String path = storageService.storeClinical(file, refId, slot);
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
