package com.parsystem.controller;

import com.parsystem.config.SecurityConfig;
import com.parsystem.entity.User;
import com.parsystem.repository.AuditLogRepository;
import com.parsystem.security.JwtAuthFilter;
import com.parsystem.service.AuditService;
import com.parsystem.service.MLClientService;
import com.parsystem.service.MLService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletRequest;
import jakarta.servlet.ServletResponse;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.stubbing.Answer;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(MLController.class)
@Import(SecurityConfig.class)
class MLControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private MLService mlService;
    @MockBean private MLClientService mlClientService;
    @MockBean private AuditService auditService;
    @MockBean private AuditLogRepository auditLogRepository;

    @MockBean private JwtAuthFilter jwtAuthFilter;
    @MockBean private UserDetailsService userDetailsService;

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

    private User undergrad(long id) {
        return User.builder().id(id).role(User.Role.UNDERGRADUATE).build();
    }

    private User orthodontist(long id) {
        return User.builder().id(id).role(User.Role.ORTHODONTIST).build();
    }

    private User admin(long id) {
        return User.builder().id(id).role(User.Role.ADMIN).build();
    }

    // ── /status — the one endpoint ORTHODONTIST IS allowed on ─────────────

    @Test
    void statusAllowsUndergraduate() throws Exception {
        mockMvc.perform(get("/api/v1/ml/status").with(user(undergrad(1L))))
                .andExpect(status().isOk());
    }

    @Test
    void statusAllowsOrthodontist() throws Exception {
        mockMvc.perform(get("/api/v1/ml/status").with(user(orthodontist(2L))))
                .andExpect(status().isOk());
    }

    @Test
    void statusAllowsAdmin() throws Exception {
        mockMvc.perform(get("/api/v1/ml/status").with(user(admin(9L))))
                .andExpect(status().isOk());
    }

    // ── /metrics — ORTHODONTIST is excluded here, unlike /status ──────────

    @Test
    void metricsBlocksOrthodontist() throws Exception {
        mockMvc.perform(get("/api/v1/ml/metrics").with(user(orthodontist(2L))))
                .andExpect(status().isForbidden());
    }

    @Test
    void metricsAllowsUndergraduate() throws Exception {
        mockMvc.perform(get("/api/v1/ml/metrics").with(user(undergrad(1L))))
                .andExpect(status().isOk());
    }

    // ── /train — ORTHODONTIST is excluded here too ─────────────────────────

    @Test
    void trainBlocksOrthodontist() throws Exception {
        mockMvc.perform(post("/api/v1/ml/train")
                        .with(user(orthodontist(2L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modelVersion\":\"v1.2\",\"epochs\":50}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void trainAllowsUndergraduate() throws Exception {
        mockMvc.perform(post("/api/v1/ml/train")
                        .with(user(undergrad(1L)))
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"modelVersion\":\"v1.2\",\"epochs\":50}"))
                .andExpect(status().isOk());
    }

    // ── /rollback — ADMIN only, everyone else excluded ─────────────────────

    @Test
    void rollbackBlocksUndergraduate() throws Exception {
        mockMvc.perform(post("/api/v1/ml/rollback/v1.1").with(user(undergrad(1L))))
                .andExpect(status().isForbidden());
    }

    @Test
    void rollbackAllowsAdmin() throws Exception {
        when(mlClientService.rollback("v1.1")).thenReturn(true);

        mockMvc.perform(post("/api/v1/ml/rollback/v1.1").with(user(admin(9L))))
                .andExpect(status().isOk());

        verify(auditService).log(any(), eq("ML_MODEL_ROLLBACK"), eq("MLMetrics"), isNull(), anyString());
    }
}