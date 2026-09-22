package com.parsystem.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class StorageServiceTest {

    @Test
    void deleteRefusesTraversalPaths() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        MockMultipartFile file = new MockMultipartFile(
                "file", "model.stl", "application/octet-stream", "solid".getBytes());

        String relativePath = storageService.storeClinical(file, 1L, "UPPER");
        assertDoesNotThrow(() -> storageService.delete(relativePath));
        assertDoesNotThrow(() -> storageService.delete("../escape.txt"));
    }

    @Test
    void resolveReadablePathRejectsTraversal() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        assertThrows(SecurityException.class,
                () -> storageService.resolveReadablePath("../../etc/passwd"));
    }

    @Test
    void resolveReadablePathRejectsNull() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        assertThrows(IllegalArgumentException.class,
                () -> storageService.resolveReadablePath(null));
    }

    @Test
    void resolveReadablePathRejectsBlank() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        assertThrows(IllegalArgumentException.class,
                () -> storageService.resolveReadablePath("   "));
    }

    @Test
    void resolveReadablePathAcceptsLegitimateRelativePath() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        Path resolved = storageService.resolveReadablePath("clinical/1/upper.stl");

        assertTrue(resolved.startsWith(base.toAbsolutePath().normalize()));
    }

    @Test
    void storeClinicalRejectsEmptyFile() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        MockMultipartFile emptyFile = new MockMultipartFile(
                "file", "model.stl", "application/octet-stream", new byte[0]);

        assertThrows(IllegalArgumentException.class,
                () -> storageService.storeClinical(emptyFile, 1L, "UPPER"));
    }

    @Test
    void storeClinicalRejectsOversizedFile() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        MultipartFile oversized = mock(MultipartFile.class);
        when(oversized.isEmpty()).thenReturn(false);
        when(oversized.getSize()).thenReturn(50L * 1024 * 1024 + 1);
        when(oversized.getOriginalFilename()).thenReturn("model.stl");

        assertThrows(IllegalArgumentException.class,
                () -> storageService.storeClinical(oversized, 1L, "UPPER"));
    }

    @Test
    void storeClinicalRejectsDisallowedExtension() throws Exception {
        Path base = Files.createTempDirectory("storage-test");
        StorageService storageService = new StorageService(base.toString(), "clinical", "training");

        MockMultipartFile badExtension = new MockMultipartFile(
                "file", "model.exe", "application/octet-stream", "content".getBytes());

        assertThrows(IllegalArgumentException.class,
                () -> storageService.storeClinical(badExtension, 1L, "UPPER"));
    }
}