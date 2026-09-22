package com.parsystem.controller;

import com.parsystem.config.SecurityConfig;
import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.security.JwtAuthFilter;
import com.parsystem.service.*;
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
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(CaseController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.storage.base-dir=/tmp")
class CaseControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private OrthoCaseRepository caseRepository;
    @MockBean private PatientRepository patientRepository;
    @MockBean private Model3DFileRepository model3DFileRepository;
    @MockBean private PARCalculatorService parCalculatorService;
    @MockBean private StorageService storageService;
    @MockBean private AuditService auditService;
    @MockBean private MLClientService mlClientService;
    @MockBean private AuditLogRepository auditLogRepository;

    @MockBean private JwtAuthFilter jwtAuthFilter;
    @MockBean private UserDetailsService userDetailsService;

    // Lesson from FileServeControllerSecurityTest: a bare @MockBean of a Filter
    // never calls chain.doFilter(...), so it silently swallows every request.
    // Stub it as a passthrough so the real SecurityConfig rules actually run.
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

    private User admin(long id) {
        return User.builder().id(id).role(User.Role.ADMIN).build();
    }

    private PARScore parScoreWithTotal(int total) {
        return PARScore.builder().totalWeighted(total).build();
    }

    // ── FINALIZE ─────────────────────────────────────────────────────────

    @Test
    void finalizeSucceedsWithValidParScore() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(false)
                .parScore(parScoreWithTotal(15))
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/cases/1/finalize").with(user(orthodontist(2L))))
                .andExpect(status().isOk());

        verify(caseRepository).save(argThat(saved -> saved.isFinalized()
                && saved.getFinalizedBy() != null));
        verify(auditService).log(any(), eq("FINALIZE_CASE"), eq("OrthoCase"), eq(1L), anyString());
    }

    @Test
    void finalizeAlreadyFinalizedReturns409() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(true)
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/cases/1/finalize").with(user(orthodontist(2L))))
                .andExpect(status().isConflict());

        verify(caseRepository, never()).save(any());
    }

    @Test
    void finalizeMissingParScoreReturns422() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(false)
                .parScore(null)
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/cases/1/finalize").with(user(orthodontist(2L))))
                .andExpect(status().isUnprocessableEntity());

        verify(caseRepository, never()).save(any());
    }

    @Test
    void finalizeZeroParScoreReturns422() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(false)
                .parScore(parScoreWithTotal(0))
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(post("/api/v1/cases/1/finalize").with(user(orthodontist(2L))))
                .andExpect(status().isUnprocessableEntity());

        verify(caseRepository, never()).save(any());
    }

    // ── UNFINALIZE ───────────────────────────────────────────────────────

    @Test
    void unfinalizeSucceedsAsAdminWithReason() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(true)
                .finalizedAt(LocalDateTime.now())
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(put("/api/v1/cases/1/unfinalize")
                        .param("reason", "Incorrect landmark placement, redoing scoring")
                        .with(user(admin(9L))))
                .andExpect(status().isOk());

        verify(caseRepository).save(argThat(saved -> !saved.isFinalized()
                && saved.getFinalizedBy() == null));
        verify(auditService).log(any(), eq("CASE_UNFINALIZED"), eq("OrthoCase"), eq(1L), anyString());
    }

    @Test
    void unfinalizeBlankReasonReturns400() throws Exception {
        mockMvc.perform(put("/api/v1/cases/1/unfinalize")
                        .param("reason", "   ")
                        .with(user(admin(9L))))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(caseRepository);
    }

    @Test
    void unfinalizeNotCurrentlyFinalizedReturns409() throws Exception {
        OrthoCase c = OrthoCase.builder()
                .id(1L).stage(OrthoCase.Stage.PRE)
                .isFinalized(false)
                .build();
        when(caseRepository.findById(1L)).thenReturn(Optional.of(c));

        mockMvc.perform(put("/api/v1/cases/1/unfinalize")
                        .param("reason", "Some reason")
                        .with(user(admin(9L))))
                .andExpect(status().isConflict());

        verify(caseRepository, never()).save(any());
    }

    // ── CREATE (POST-stage precondition) ────────────────────────────────

    @Test
    void createPostCaseWithoutFinalizedPreCaseReturns422() throws Exception {
        Patient patient = Patient.builder().id(1L).build();
        when(patientRepository.findById(1L)).thenReturn(Optional.of(patient));
        when(caseRepository.findByPatientId(1L)).thenReturn(List.of()); // no PRE case at all

        mockMvc.perform(post("/api/v1/cases")
                        .param("patientId", "1")
                        .param("stage", "POST")
                        .with(user(orthodontist(2L))))
                .andExpect(status().isUnprocessableEntity());

        verify(caseRepository, never()).save(any());
    }
}