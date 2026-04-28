package com.parsystem.controller;

import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.service.*;
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

@Slf4j
@RestController
@RequestMapping("/api/v1/training-sets")
@RequiredArgsConstructor
public class TrainingSetController {

    private final TrainingSetRepository trainingSetRepository;
    private final UserRepository userRepository;
    private final Model3DFileRepository model3DFileRepository;
    private final StorageService storageService;
    private final AuditService auditService;

    // ✅ FIX ADDED (Bug 1)
    @Value("${app.storage.base-dir}")
    private String baseDir;

    @GetMapping("/reviewers")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<List<User>> getReviewers() {
        List<User> orthos = userRepository.findByRoleIn(
                List.of(User.Role.ORTHODONTIST));
        return ResponseEntity.ok(orthos);
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<TrainingSet> create(
            @RequestParam String anonymisedLabel,
            @RequestParam int groundTruthPar,
            @RequestParam(required = false) String sourceDescription,
            @RequestParam Long reviewerId,
            @AuthenticationPrincipal User user) {

        User reviewer = userRepository.findById(reviewerId)
                .orElseThrow(() -> new IllegalArgumentException("Invalid reviewer ID"));

        if (reviewer.getRole() != User.Role.ORTHODONTIST) {
            throw new IllegalArgumentException("Reviewer must be an orthodontist");
        }

        TrainingSet ts = TrainingSet.builder()
                .submittedBy(user)
                .anonymisedLabel(anonymisedLabel)
                .groundTruthPar(groundTruthPar)
                .sourceDescription(sourceDescription)
                .reviewer(reviewer)
                .status(TrainingSet.Status.PENDING)
                .build();

        TrainingSet saved = trainingSetRepository.save(ts);
        auditService.log(user, "CREATE_TRAINING_SET", "TrainingSet", saved.getId(), null);
        return ResponseEntity.ok(saved);
    }

    @PostMapping("/{id}/models")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<Map<String, String>> uploadModels(
            @PathVariable Long id,
            @RequestPart("upperFile") MultipartFile upperFile,
            @RequestPart("lowerFile") MultipartFile lowerFile,
            @RequestPart("buccalFile") MultipartFile buccalFile,
            @AuthenticationPrincipal User user) throws IOException {

        TrainingSet ts = trainingSetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Training set not found: " + id));

        if (ts.getStatus() != TrainingSet.Status.PENDING) {
            throw new IllegalStateException("Cannot upload to a reviewed training set.");
        }

        saveModel(upperFile, "UPPER", id, ts, user);
        saveModel(lowerFile, "LOWER", id, ts, user);
        saveModel(buccalFile, "BUCCAL", id, ts, user);

        auditService.log(user, "UPLOAD_TRAINING_MODELS", "TrainingSet", id, "3 files uploaded");
        return ResponseEntity.ok(Map.of("message", "Training 3D models uploaded successfully."));
    }

    @GetMapping("/my")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<List<TrainingSet>> getMy(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(trainingSetRepository.findBySubmittedById(user.getId()));
    }

    @GetMapping
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<TrainingSet>> getAll(
            @RequestParam(required = false) TrainingSet.Status status) {
        if (status != null) {
            return ResponseEntity.ok(trainingSetRepository.findByStatus(status));
        }
        return ResponseEntity.ok(trainingSetRepository.findAll());
    }

    @GetMapping("/assigned")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<List<TrainingSet>> getAssigned(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(trainingSetRepository.findByReviewerId(user.getId()));
    }

    @PutMapping("/{id}/review")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<TrainingSet> review(
            @PathVariable Long id,
            @RequestParam TrainingSet.Status status,
            @RequestParam(required = false) String comment,
            @AuthenticationPrincipal User reviewer) {

        TrainingSet ts = trainingSetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Training set not found: " + id));

        if (reviewer.getRole() != User.Role.ADMIN &&
                !ts.getReviewer().getId().equals(reviewer.getId())) {
            throw new IllegalArgumentException("You can only review assigned submissions.");
        }

        ts.setStatus(status);
        ts.setReviewer(reviewer);
        ts.setReviewerComment(comment);
        ts.setReviewedAt(LocalDateTime.now());

        TrainingSet saved = trainingSetRepository.save(ts);

        auditService.log(reviewer, "REVIEW_TRAINING_SET", "TrainingSet", id, "status=" + status);
        return ResponseEntity.ok(saved);
    }

    // ✅ FIXED METHOD (Bug 1 + Bug 2)
    @GetMapping("/{setId}/models/{slot}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<Resource> getModelFile(
            @PathVariable Long setId,
            @PathVariable String slot,
            @AuthenticationPrincipal User user) throws IOException {

        TrainingSet ts = trainingSetRepository.findById(setId)
                .orElseThrow(() -> new IllegalArgumentException("Training set not found: " + setId));

        if (user.getRole() != User.Role.ADMIN &&
                !ts.getReviewer().getId().equals(user.getId())) {
            throw new IllegalArgumentException("Not authorized to view this model.");
        }

        Model3DFile modelFile = ts.getModelFiles().stream()
                .filter(f -> f.getSlot().name().equalsIgnoreCase(slot))
                .findFirst()
                .orElseThrow(() -> new IllegalArgumentException("Model file not found: " + slot));

        // ✅ FIX 1: correct path resolution
        Path filePath = Paths.get(baseDir)
                .resolve(modelFile.getStoragePath())
                .normalize();

        Resource resource = new UrlResource(filePath.toUri());

        if (!resource.exists() || !resource.isReadable()) {
            log.warn("Training model file not readable: {}", filePath);
            return ResponseEntity.notFound().build();
        }

        String filename = modelFile.getFileName();

        MediaType mediaType = (filename != null && filename.toLowerCase().endsWith(".obj"))
                ? MediaType.TEXT_PLAIN
                : MediaType.APPLICATION_OCTET_STREAM;

        // ✅ FIX 2: add CORS header for Three.js (prevents silent 403)
        return ResponseEntity.ok()
                .contentType(mediaType)
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "inline; filename=\"" + filename + "\"")
                .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                .body(resource);
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('UNDERGRADUATE','ADMIN')")
    public ResponseEntity<Void> delete(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        TrainingSet ts = trainingSetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Training set not found: " + id));

        if (ts.getStatus() != TrainingSet.Status.PENDING) {
            throw new IllegalStateException("Only pending submissions can be deleted.");
        }

        trainingSetRepository.deleteById(id);
        auditService.log(user, "DELETE_TRAINING_SET", "TrainingSet", id, null);
        return ResponseEntity.noContent().build();
    }

    private void saveModel(MultipartFile file, String slot, Long setId,
                           TrainingSet ts, User uploader) throws IOException {

        String path = storageService.storeTraining(file, setId, slot);
        BigDecimal sizeMb = storageService.toMb(file);

        Model3DFile model = Model3DFile.builder()
                .trainingSet(ts)
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