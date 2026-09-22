package com.parsystem.controller;

import com.parsystem.config.SecurityConfig;
import com.parsystem.entity.Model3DFile;
import com.parsystem.entity.User;
import com.parsystem.repository.Model3DFileRepository;
import com.parsystem.security.JwtAuthFilter;
import com.parsystem.service.AccessControlService;
import com.parsystem.service.StorageService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.stubbing.Answer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(FileServeController.class)
@Import(SecurityConfig.class)
class FileServeControllerSecurityTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private Model3DFileRepository model3DFileRepository;
    @MockBean private AccessControlService accessControlService;
    @MockBean private StorageService storageService;

    // SecurityConfig's bean graph (JwtAuthFilter, UserDetailsService) must be
    // satisfiable even though these tests authenticate via user(...) directly
    // rather than exercising real JWT parsing.
    @MockBean private JwtAuthFilter jwtAuthFilter;
    @MockBean private UserDetailsService userDetailsService;

    @TempDir static Path storageDir;

    @DynamicPropertySource
    static void storageProps(DynamicPropertyRegistry registry) {
        registry.add("app.storage.base-dir", () -> storageDir.toString());
    }

    // FIX: a bare @MockBean of a Filter is a no-op for every method, including
    // doFilter(request, response, chain) — it never calls chain.doFilter(...),
    // so the mocked JwtAuthFilter silently swallowed every request before it
    // reached the authorization check or the controller (MockMvc then reported
    // whatever MockHttpServletResponse's untouched default was: 200, empty body).
    // This stub makes it act as a passthrough filter instead, so the real
    // SecurityConfig authorization rules actually run in this test.
    @BeforeEach
    void makeJwtAuthFilterPassthrough() throws Exception {
        doAnswer((Answer<Void>) invocation -> {
            ServletRequest request = invocation.getArgument(0);
            ServletResponse response = invocation.getArgument(1);
            FilterChain chain = invocation.getArgument(2);
            chain.doFilter(request, response);
            return null;
        }).when(jwtAuthFilter).doFilter(any(), any(), any());
    }

    private User orthodontist(long id) {
        return User.builder().id(id).role(User.Role.ORTHODONTIST).build();
    }

    private User undergraduate(long id) {
        return User.builder().id(id).role(User.Role.UNDERGRADUATE).build();
    }

    private Model3DFile modelFile(long id, String storagePath) {
        return Model3DFile.builder()
                .id(id)
                .fileName("upper.stl")
                .storagePath(storagePath)
                .build();
    }

    @Test
    void undergraduateIsBlockedBeforeReachingController() throws Exception {
        // BUG FIX 1 regression: the URL-level rule in SecurityConfig
        // (/api/v1/cases/** -> hasAnyRole(ORTHODONTIST, ADMIN)) must still
        // reject UNDERGRADUATE before the controller/service layer runs at all.
        mockMvc.perform(get("/api/v1/cases/files/1").with(user(undergraduate(9L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(model3DFileRepository, accessControlService, storageService);
    }

    @Test
    void orthodontistWithoutModelAccessIsRejected() throws Exception {
        // Passes the coarse URL-level role check (ORTHODONTIST) but the
        // service-layer ownership/case-access check denies it.
        Model3DFile file = modelFile(5L, "clinical/1/upper.stl");
        when(model3DFileRepository.findById(5L)).thenReturn(Optional.of(file));
        doThrow(new AccessDeniedException("You do not have access to this model file."))
                .when(accessControlService).requireModelReadable(eq(file), any(User.class));

        mockMvc.perform(get("/api/v1/cases/files/5").with(user(orthodontist(2L))))
                .andExpect(status().isForbidden());

        verify(storageService, never()).resolveReadablePath(anyString());
    }

    @Test
    void authorizedOrthodontistCanDownloadFile() throws Exception {
        Model3DFile file = modelFile(7L, "clinical/1/upper.stl");
        Path realFile = storageDir.resolve("upper.stl");
        Files.writeString(realFile, "dummy-stl-content");

        when(model3DFileRepository.findById(7L)).thenReturn(Optional.of(file));
        doNothing().when(accessControlService).requireModelReadable(eq(file), any(User.class));
        when(storageService.resolveReadablePath("clinical/1/upper.stl")).thenReturn(realFile);

        mockMvc.perform(get("/api/v1/cases/files/7").with(user(orthodontist(2L))))
                .andExpect(status().isOk());
    }
}