package com.parsystem.controller;

import com.parsystem.entity.Model3DFile;
import com.parsystem.repository.Model3DFileRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.MalformedURLException;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Serves stored 3D model files to the React frontend for rendering.
 *
 * Endpoint: GET /api/v1/cases/files/{fileId}
 *
 * The Model3DFile entity stores a relative path (e.g. clinical/7/upper_uuid.stl).
 * This controller resolves it against the configured storage base directory and
 * streams the file with the correct Content-Type.
 *
 * Security: any authenticated user can read files (same rule as case access).
 */
@RestController
@RequestMapping("/api/v1/cases/files")
@RequiredArgsConstructor
@Slf4j
public class FileServeController {

    private final Model3DFileRepository model3DFileRepository;

    @Value("${app.storage.base-dir}")
    private String baseDir;

    @GetMapping("/{fileId}")
    public ResponseEntity<Resource> serveFile(@PathVariable Long fileId) {
        Model3DFile modelFile = model3DFileRepository.findById(fileId)
                .orElseThrow(() -> new IllegalArgumentException("File not found: " + fileId));

        try {
            Path filePath = Paths.get(baseDir)
                                 .resolve(modelFile.getStoragePath())
                                 .normalize();

            Resource resource = new UrlResource(filePath.toUri());

            if (!resource.exists() || !resource.isReadable()) {
                log.warn("File not readable: {}", filePath);
                return ResponseEntity.notFound().build();
            }

            // Determine Content-Type from file extension
            String filename  = modelFile.getFileName();
            MediaType mediaType = filename != null && filename.toLowerCase().endsWith(".obj")
                    ? MediaType.TEXT_PLAIN
                    : MediaType.APPLICATION_OCTET_STREAM;

            return ResponseEntity.ok()
                    .contentType(mediaType)
                    .header(HttpHeaders.CONTENT_DISPOSITION,
                            "inline; filename=\"" + filename + "\"")
                    // Allow Three.js to load the file cross-origin within the same app
                    .header(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "*")
                    .body(resource);

        } catch (MalformedURLException e) {
            log.error("Malformed URL for file {}: {}", fileId, e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }
}
