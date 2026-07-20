package com.parsystem.controller;

import com.parsystem.entity.Model3DFile;
import com.parsystem.entity.User;
import com.parsystem.repository.Model3DFileRepository;
import com.parsystem.service.AccessControlService;
import com.parsystem.service.StorageService;
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

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Serves stored 3D model files to the React frontend for rendering.
 *
 * Endpoint: GET /api/v1/cases/files/{fileId}
 *
 * BUG FIX 1: Added @PreAuthorize — previously any authenticated user (including
 *            UNDERGRADUATE) could fetch any file by guessing a numeric ID.
 * BUG FIX 2: baseDir resolved to absolute path before use so the file lookup
 *            is not dependent on the JVM working directory.
 * BUG FIX 3 (root cause of startup crash):
 *            This class previously had BOTH @RequiredArgsConstructor AND a
 *            hand-written constructor with the same parameter list. Lombok's
 *            generated constructor collided with the explicit one, and Spring's
 *            bean creation failed with "No default constructor found" /
 *            NoSuchMethodException: <init>(). FIX: removed @RequiredArgsConstructor;
 *            this class needs custom logic in its constructor (resolving baseDir
 *            to an absolute Path) so it must keep the explicit constructor only.
 */
@Slf4j
@RestController
@RequestMapping("/api/v1/cases/files")
public class FileServeController {

    private final Model3DFileRepository model3DFileRepository;
    private final AccessControlService accessControlService;
    private final StorageService storageService;

    // Resolved once to absolute path in the constructor
    private final Path basePath;

    public FileServeController(
            Model3DFileRepository model3DFileRepository,
            AccessControlService accessControlService,
            StorageService storageService,
            @Value("${app.storage.base-dir}") String baseDir) {
        this.model3DFileRepository = model3DFileRepository;
        this.accessControlService = accessControlService;
        this.storageService = storageService;
        // BUG FIX 2: always resolve to absolute so UrlResource works regardless of CWD
        this.basePath = Paths.get(baseDir).toAbsolutePath().normalize();
    }

    // BUG FIX 1: restrict to clinical roles — UNDERGRADUATE must NOT access clinical files
    @GetMapping("/{fileId}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST', 'ADMIN')")
    public ResponseEntity<Resource> serveFile(@PathVariable Long fileId,
                                              @AuthenticationPrincipal User user) {

        Model3DFile modelFile = model3DFileRepository.findById(fileId)
                .orElseThrow(() -> new IllegalArgumentException("File not found: " + fileId));
        accessControlService.requireModelReadable(modelFile, user);

        try {
            Path filePath = storageService.resolveReadablePath(modelFile.getStoragePath());

            // Guard against path traversal even at serve time
            if (!filePath.startsWith(basePath)) {
                log.error("Path traversal attempt blocked for fileId={}", fileId);
                return ResponseEntity.badRequest().build();
            }

            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                log.warn("File not readable: {}", filePath);
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
            log.error("Malformed URL for file {}: {}", fileId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
