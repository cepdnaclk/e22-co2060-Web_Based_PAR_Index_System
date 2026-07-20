package com.parsystem.service;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.file.*;
import java.security.DigestInputStream;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * REQUIREMENT 8 — STL File Integrity Check:
 *   - After writing every file: verify actualSize == expectedSize
 *   - If mismatch: delete the file and throw IOException
 *   - Compute and store MD5 checksum after successful write
 */
@Slf4j
@Service
public class StorageService {

    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("stl", "obj");

    private static final Set<String> ALLOWED_MIMES = Set.of(
            "model/stl", "application/octet-stream",
            "model/obj", "text/plain"
    );

    private static final long MAX_SIZE_BYTES = 50L * 1024 * 1024;

    // Resolved once to absolute, normalised paths so all comparisons are consistent.
    private final Path basePath;
    private final Path clinicalPath;
    private final Path trainingPath;

    public StorageService(
            @Value("${app.storage.base-dir}")     String baseDir,
            @Value("${app.storage.clinical-dir}") String clinicalDir,
            @Value("${app.storage.training-dir}") String trainingDir
    ) {
        // Always resolve to absolute + normalised so startsWith() comparisons work correctly.
        this.basePath = Paths.get(baseDir).toAbsolutePath().normalize();

        // BUG FIX: clinicalDir/trainingDir must be resolved AS SUBDIRECTORIES of
        // basePath, not independently. Resolving them independently
        // (Paths.get(clinicalDir).toAbsolutePath()) made them siblings of basePath
        // (e.g. basePath=/app/uploads but clinicalPath=/app/clinical), which meant
        // every storeClinical()/storeTraining() call returned a relative path
        // containing "../" once relativized against basePath. That ".." path was
        // then persisted into the database as storage_path. Reads happened to
        // still resolve to the right file (the ".." cancels back out), but the
        // path-traversal containment check in FileServeController legitimately
        // rejected every one of these paths as "outside the base directory",
        // and dataset_preprocessor.py's path joins broke for the same reason.
        this.clinicalPath = this.basePath.resolve(clinicalDir).normalize();
        this.trainingPath = this.basePath.resolve(trainingDir).normalize();
    }

    // ─────────────────────────────────────────────
    // CLINICAL STORAGE
    // ─────────────────────────────────────────────

    public String storeClinical(MultipartFile file, Long caseId, String slot) throws IOException {
        validate(file);

        String ext      = getExtension(file.getOriginalFilename());
        String safeSlot = sanitizeSlot(slot);
        String relative = caseId + "/" + safeSlot + "_" + UUID.randomUUID() + "." + ext;

        Path target = resolveAndGuard(clinicalPath, relative);
        write(file, target);

        // Return a path relative to basePath for storage in the DB
        return basePath.relativize(target).toString();
    }

    // ─────────────────────────────────────────────
    // TRAINING STORAGE
    // ─────────────────────────────────────────────

    public String storeTraining(MultipartFile file, Long setId, String slot) throws IOException {
        validate(file);

        String ext      = getExtension(file.getOriginalFilename());
        String safeSlot = sanitizeSlot(slot);
        String relative = setId + "/" + safeSlot + "_" + UUID.randomUUID() + "." + ext;

        Path target = resolveAndGuard(trainingPath, relative);
        write(file, target);

        return basePath.relativize(target).toString();
    }

    // ─────────────────────────────────────────────
    // READ ACCESS — resolve a stored relative path for serving/reading
    // ─────────────────────────────────────────────

    /**
     * Resolves a relative path as persisted in the DB (e.g. Model3DFile.storagePath,
     * TrainingFile.storagePath) against basePath, guarding against path traversal.
     *
     * This is the public read-side counterpart to storeClinical/storeTraining: those
     * methods write under clinicalPath/trainingPath but always return a path already
     * relativized against basePath (see the BUG FIX note in the constructor — both
     * clinicalPath and trainingPath are subdirectories of basePath, not siblings of
     * it). That means every stored relative path is correctly anchored at basePath,
     * so reads only ever need to resolve against basePath, never against
     * clinicalPath/trainingPath directly. FileServeController and
     * TrainingSetController both call this to turn a stored relative path into an
     * absolute Path before opening it as a Resource, and both also re-check
     * filePath.startsWith(basePath) themselves afterward — this method guards first,
     * so that second check is defense-in-depth rather than the only line of defense.
     *
     * @throws IllegalArgumentException if relativePath is null/blank
     * @throws SecurityException        if the resolved path escapes basePath
     */
    public Path resolveReadablePath(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            throw new IllegalArgumentException("Stored path must not be empty.");
        }
        return resolveAndGuard(basePath, relativePath);
    }

    // ─────────────────────────────────────────────
    // DELETE FILE
    // ─────────────────────────────────────────────

    public void delete(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) return;

        try {
            Path target = resolveAndGuard(basePath, relativePath);
            Files.deleteIfExists(target);
            log.info("Deleted file: {}", target);
        } catch (SecurityException e) {
            log.warn("Refused to delete file outside base dir: {}", relativePath);
        } catch (IOException e) {
            log.warn("Could not delete file {}: {}", relativePath, e.getMessage());
        }
    }

    // ─────────────────────────────────────────────
    // REQUIREMENT 8: MD5 CHECKSUM
    // ─────────────────────────────────────────────

    /**
     * Compute MD5 checksum of a file on disk.
     */
    public String computeMd5(Path filePath) throws IOException {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            try (InputStream is  = Files.newInputStream(filePath);
                 DigestInputStream dis = new DigestInputStream(is, md)) {
                byte[] buffer = new byte[8192];
                //noinspection StatementWithEmptyBody
                while (dis.read(buffer) != -1) { /* drain */ }
            }
            return HexFormat.of().formatHex(md.digest());
        } catch (NoSuchAlgorithmException e) {
            throw new IOException("MD5 not available", e);
        }
    }

    /**
     * REQUIREMENT 8: Verify file integrity by comparing stored vs actual checksum.
     */
    public Map<String, Object> verifyIntegrity(String relativePath,
                                               String storedChecksum) throws IOException {
        Path target = resolveAndGuard(basePath, relativePath);

        if (!Files.exists(target)) {
            return Map.of("valid", false, "error", "File not found");
        }

        String actual = computeMd5(target);
        boolean valid = actual.equalsIgnoreCase(storedChecksum);

        return Map.of(
                "valid",          valid,
                "storedChecksum", storedChecksum != null ? storedChecksum : "N/A",
                "actualChecksum", actual
        );
    }

    // ─────────────────────────────────────────────
    // UTIL
    // ─────────────────────────────────────────────

    public BigDecimal toMb(MultipartFile file) {
        return BigDecimal.valueOf(file.getSize())
                .divide(BigDecimal.valueOf(1_048_576), 2, RoundingMode.HALF_UP);
    }

    // ─────────────────────────────────────────────
    // VALIDATION
    // ─────────────────────────────────────────────

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

    // ─────────────────────────────────────────────
    // SECURITY GUARD — path traversal prevention
    // ─────────────────────────────────────────────

    /**
     * Resolves {@code relative} against {@code root} and verifies the result
     * is still inside {@code root}. Both sides are absolute + normalised before
     * the startsWith check, so the comparison is always consistent.
     *
     * @throws SecurityException if the resolved path escapes the root directory
     */
    private Path resolveAndGuard(Path root, String relative) {
        // root is already absolute+normalised (set in constructor / passed from there)
        Path target = root.resolve(relative).normalize();

        if (!target.startsWith(root)) {
            log.error("Path traversal attempt blocked: root={} relative={}", root, relative);
            throw new SecurityException("Invalid file path detected");
        }
        return target;
    }

    // ─────────────────────────────────────────────
    // FILE WRITING with REQUIREMENT 8 integrity check
    // ─────────────────────────────────────────────

    private void write(MultipartFile file, Path target) throws IOException {
        Files.createDirectories(target.getParent());
        Files.copy(file.getInputStream(), target, StandardCopyOption.REPLACE_EXISTING);

        // REQUIREMENT 8: size must match exactly
        long expectedSize = file.getSize();
        long actualSize   = Files.size(target);

        if (actualSize != expectedSize) {
            Files.deleteIfExists(target);
            throw new IOException(
                    "File write incomplete: expected " + expectedSize +
                    " bytes, got " + actualSize + ". Please re-upload.");
        }

        // Compute and log MD5
        try {
            String md5 = computeMd5(target);
            log.info("Stored 3D model: {} (size={} bytes, md5={})", target, actualSize, md5);
        } catch (IOException e) {
            log.warn("Could not compute MD5 for {}: {}", target, e.getMessage());
            log.info("Stored 3D model: {} (size={} bytes)", target, actualSize);
        }
    }

    // ─────────────────────────────────────────────
    // HELPERS
    // ─────────────────────────────────────────────

    private String getExtension(String filename) {
        if (filename == null || !filename.contains(".")) return "";
        return filename.substring(filename.lastIndexOf('.') + 1).toLowerCase();
    }

    private String sanitizeSlot(String slot) {
        if (slot == null) return "UNKNOWN";
        return slot.trim().toUpperCase().replaceAll("[^A-Z0-9_]", "");
    }
}