package com.parsystem.controller;

import com.parsystem.dto.PARScoreDto;
import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
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

    /** Create a new orthodontic case linked to a patient. */
    @PostMapping
    public ResponseEntity<OrthoCase> create(
            @RequestParam Long patientId,
            @RequestParam OrthoCase.Stage stage,
            @RequestParam(required = false) String notes,
            @AuthenticationPrincipal User user) {

        Patient patient = patientRepository.findById(patientId)
                .orElseThrow(() -> new IllegalArgumentException("Patient not found: " + patientId));

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

    /** Get all cases for a patient. */
    @GetMapping("/patient/{patientId}")
    public ResponseEntity<List<OrthoCase>> getByPatient(@PathVariable Long patientId) {
        return ResponseEntity.ok(caseRepository.findByPatientId(patientId));
    }

    /** Get a single case. */
    @GetMapping("/{id}")
    public ResponseEntity<OrthoCase> getById(@PathVariable Long id) {
        return ResponseEntity.ok(caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id)));
    }

    /**
     * Upload three 3D model files for a case.
     * Expects multipart fields: upperFile, lowerFile, buccalFile
     */
    @PostMapping("/{id}/models")
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

        saveModel(upperFile,  "UPPER",  id, orthoCase, user, false);
        saveModel(lowerFile,  "LOWER",  id, orthoCase, user, false);
        saveModel(buccalFile, "BUCCAL", id, orthoCase, user, false);

        auditService.log(user, "UPLOAD_3D_MODELS", "OrthoCase", id, "3 files uploaded");

        return ResponseEntity.ok(Map.of("message", "3D models uploaded successfully."));
    }

    /** Compute PAR score for a case. */
    @PostMapping("/{id}/calculate")
    public ResponseEntity<PARScore> calculate(
            @PathVariable Long id,
            @Valid @RequestBody PARScoreDto.CalculateRequest request,
            @AuthenticationPrincipal User user) {

        return ResponseEntity.ok(parCalculatorService.calculate(id, request, user));
    }

    /** Finalize a case (locks it — no further edits). */
    @PostMapping("/{id}/finalize")
    public ResponseEntity<Void> finalize(@PathVariable Long id,
                                          @AuthenticationPrincipal User user) {
        OrthoCase c = caseRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + id));
        c.setFinalized(true);
        caseRepository.save(c);
        auditService.log(user, "FINALIZE_CASE", "OrthoCase", id, null);
        return ResponseEntity.noContent().build();
    }

    // ── helper ────────────────────────────────────────────────────────

    private void saveModel(MultipartFile file, String slot, Long refId,
                           OrthoCase orthoCase, User uploader, boolean isTraining)
            throws IOException {

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