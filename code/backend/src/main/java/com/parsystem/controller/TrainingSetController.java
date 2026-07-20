package com.parsystem.controller;

import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.service.*;
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
import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * REQUIREMENT 4 — Training Data Validation:
 *   - review() must validate groundTruthPar is 1–50 before setting APPROVED
 *   - Training set must have all 3 model files (UPPER, LOWER, BUCCAL)
 *   - Log approval including reviewer ID and ground truth PAR value
 *
 * BUG FIX 1: saveModel() now deletes the existing file for the same slot before
 *            re-uploading, preventing duplicate DB rows and orphaned disk files.
 * BUG FIX 2: getModelFile() now resolves baseDir to absolute before building the path.
 *
 * BUG FIX 3 (root cause of startup crash):
 *   This class previously had BOTH @RequiredArgsConstructor AND a hand-written
 *   constructor with the same parameter list. Lombok generates a constructor from
 *   the final fields at compile time, which collided with the explicit constructor
 *   below. Spring's bean instantiation then failed with "No default constructor
 *   found" / NoSuchMethodException: <init>(). FIX: removed @RequiredArgsConstructor
 *   entirely — this class needs custom logic in its constructor (resolving baseDir
 *   to an absolute Path), so it keeps the explicit constructor only.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/training-sets")
public class TrainingSetController {

    private final TrainingSetRepository  trainingSetRepository;
    private final UserRepository         userRepository;
    private final Model3DFileRepository  model3DFileRepository;
    private final StorageService         storageService;
    private final AuditService           auditService;

    // BUG FIX 2: resolved to absolute path once in the constructor
    private final Path basePath;

    public TrainingSetController(
            TrainingSetRepository trainingSetRepository,
            UserRepository userRepository,
            Model3DFileRepository model3DFileRepository,
            StorageService storageService,
            AuditService auditService,
            @Value("${app.storage.base-dir}") String baseDir) {
        this.trainingSetRepository = trainingSetRepository;
        this.userRepository        = userRepository;
        this.model3DFileRepository = model3DFileRepository;
        this.storageService        = storageService;
        this.auditService          = auditService;
        this.basePath              = Paths.get(baseDir).toAbsolutePath().normalize();
    }

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
            @RequestPart("upperFile")  MultipartFile upperFile,
            @RequestPart("lowerFile")  MultipartFile lowerFile,
            @RequestPart("buccalFile") MultipartFile buccalFile,
            @AuthenticationPrincipal User user) throws IOException {

        TrainingSet ts = trainingSetRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Training set not found: " + id));

        if (ts.getStatus() != TrainingSet.Status.PENDING) {
            throw new IllegalStateException("Cannot upload to a reviewed training set.");
        }

        saveModel(upperFile,  "UPPER",  id, ts, user);
        saveModel(lowerFile,  "LOWER",  id, ts, user);
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

    /**
     * REQUIREMENT 4: Validate before setting status to APPROVED:
     *   - groundTruthPar must be 1–50 (reject 0 and >50)
     *   - Training set must have all 3 model files (UPPER, LOWER, BUCCAL)
     *   - Log approval including reviewer ID and ground truth PAR value
     */
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

        // REQUIREMENT 4: Validate before APPROVED
        if (status == TrainingSet.Status.APPROVED) {
            int gtp = ts.getGroundTruthPar();
            if (gtp < 1 || gtp > 50) {
                throw new IllegalArgumentException(
                        "groundTruthPar value " + gtp + " is outside the valid range [1, 50]. " +
                        "Cannot approve this training set.");
            }

            List<Model3DFile> files = model3DFileRepository.findByTrainingSetId(id);
            boolean hasUpper  = files.stream().anyMatch(f -> f.getSlot() == Model3DFile.Slot.UPPER);
            boolean hasLower  = files.stream().anyMatch(f -> f.getSlot() == Model3DFile.Slot.LOWER);
            boolean hasBuccal = files.stream().anyMatch(f -> f.getSlot() == Model3DFile.Slot.BUCCAL);

            if (!hasUpper || !hasLower || !hasBuccal) {
                List<String> missing = new ArrayList<>();
                if (!hasUpper)  missing.add("UPPER");
                if (!hasLower)  missing.add("LOWER");
                if (!hasBuccal) missing.add("BUCCAL");
                throw new IllegalArgumentException(
                        "Cannot approve training set — missing model files: " +
                        String.join(", ", missing));
            }

            log.info("TRAINING_SET_APPROVED: setId={} reviewerId={} groundTruthPar={}",
                    id, reviewer.getId(), gtp);
        }

        ts.setStatus(status);
        ts.setReviewer(reviewer);
        ts.setReviewerComment(comment);
        ts.setReviewedAt(LocalDateTime.now());

        TrainingSet saved = trainingSetRepository.save(ts);

        auditService.log(reviewer, "REVIEW_TRAINING_SET", "TrainingSet", id,
                "status=" + status + " groundTruthPar=" + ts.getGroundTruthPar() +
                " reviewerId=" + reviewer.getId());

        return ResponseEntity.ok(saved);
    }

    @GetMapping("/{setId}/models/{slot}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<Resource> getModelFile(
            @PathVariable Long setId,
            @PathVariable String slot,
            @AuthenticationPrincipal User user) {

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

        try {
            // BUG FIX 2: use absolute basePath so resolve works regardless of CWD
            Path filePath = storageService.resolveReadablePath(modelFile.getStoragePath());

            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                log.warn("Training model file not readable: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            String filename = modelFile.getFileName();
            MediaType mediaType = (filename != null && filename.toLowerCase().endsWith(".obj"))
                    ? MediaType.TEXT_PLAIN
                    : MediaType.APPLICATION_OCTET_STREAM;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + filename + "\"")
                    .body(resource);

        } catch (MalformedURLException e) {
            log.error("Malformed URL for training set {} slot {}: {}", setId, slot, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
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

    // ── INTERNAL HELPER ───────────────────────────────────────────────────

    /**
     * BUG FIX 1: Delete any existing file for the same slot before saving the new one.
     * Without this, re-uploading creates duplicate DB rows and orphaned disk files.
     */
    private void saveModel(MultipartFile file, String slot, Long setId,
                           TrainingSet ts, User uploader) throws IOException {

        // Delete old file for this slot if it exists
        model3DFileRepository.findByTrainingSetId(setId).stream()
                .filter(m -> m.getSlot().name().equalsIgnoreCase(slot))
                .forEach(m -> {
                    try {
                        storageService.delete(m.getStoragePath());
                    } catch (Exception e) {
                        log.warn("Failed to delete old training file: {}", m.getStoragePath());
                    }
                    model3DFileRepository.deleteById(m.getId());
                });

        String path       = storageService.storeTraining(file, setId, slot);
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
