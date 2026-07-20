package com.parsystem.service;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

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
}
