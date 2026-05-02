package com.parsystem.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.*;
import java.util.Set;
import java.util.UUID;

/**
 * Abstracts 3D model file storage.
 * Phase 1: local filesystem.
 * Future: swap implementation for AWS S3 without changing callers.
 */
@Slf4j
@Service
public class StorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("stl", "obj");
    private static final Set<String> ALLOWED_MIMES = Set.of(
            "model/stl", "application/octet-stream",
            "model/obj", "text/plain"          // OBJ files are plain text
    );
    private static final long MAX_SIZE_BYTES = 50L * 1024 * 1024; // 50 MB

    @Value("${app.storage.base-dir}")
    private String baseDir;

    @Value("${app.storage.clinical-dir}")
    private String clinicalDir;

    @Value("${app.storage.training-dir}")
    private String trainingDir;

    /**
     * Stores a clinical 3D model file.
     * @return relative storage path: clinical/{caseId}/{slot}_{uuid}.{ext}
     */
    public String storeClinical(MultipartFile file, Long caseId, String slot) throws IOException {
        validate(file);
        String ext = getExtension(file.getOriginalFilename());
        String relative = clinicalDir + "/" + caseId + "/" + slot.toLowerCase()
                          + "_" + UUID.randomUUID() + "." + ext;
        write(file, relative);
        return relative;
    }

    /**
     * Stores a training set 3D model file.
     * @return relative storage path: training/{setId}/{slot}_{uuid}.{ext}
     */
    public String storeTraining(MultipartFile file, Long setId, String slot) throws IOException {
        validate(file);
        String ext = getExtension(file.getOriginalFilename());
        String relative = trainingDir + "/" + setId + "/" + slot.toLowerCase()
                          + "_" + UUID.randomUUID() + "." + ext;
        write(file, relative);
        return relative;
    }

    public void delete(String relativePath) {
        try {
            Path target = Paths.get(baseDir).resolve(relativePath);
            Files.deleteIfExists(target);
            log.info("Deleted file: {}", target);
        } catch (IOException e) {
            log.warn("Could not delete file {}: {}", relativePath, e.getMessage());
        }
    }

    public BigDecimal toMb(MultipartFile file) {
        return BigDecimal.valueOf(file.getSize())
                .divide(BigDecimal.valueOf(1_048_576), 2, RoundingMode.HALF_UP);
    }

    // ── private helpers ───────────────────────────────────────────────

    private void validate(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("File must not be empty.");
        }
        if (file.getSize() > MAX_SIZE_BYTES) {
            throw new IllegalArgumentException("File exceeds 50 MB limit.");
        }
        String ext = getExtension(file.getOriginalFilename());
        if (!ALLOWED_EXTENSIONS.contains(ext)) {
            throw new IllegalArgumentException(
                    "Unsupported format '" + ext + "'. Only STL and OBJ are accepted.");
        }
    }

    private void write(MultipartFile file, String relative) throws IOException {
        Path target = Paths.get(baseDir).resolve(relative);
        Files.createDirectories(target.getParent());
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);
        log.info("Stored 3D model: {}", target);
    }

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }
}