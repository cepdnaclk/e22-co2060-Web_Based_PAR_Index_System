package com.parsystem.controller;

import com.parsystem.config.SecurityConfig;
import com.parsystem.entity.*;
import com.parsystem.repository.*;
import com.parsystem.security.JwtAuthFilter;
import com.parsystem.service.AuditService;
import com.parsystem.service.StorageService;
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

import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(TrainingSetController.class)
@Import(SecurityConfig.class)
@TestPropertySource(properties = "app.storage.base-dir=/tmp")
class TrainingSetControllerTest {

    @Autowired private MockMvc mockMvc;

    @MockBean private TrainingSetRepository trainingSetRepository;
    @MockBean private UserRepository userRepository;
    @MockBean private Model3DFileRepository model3DFileRepository;
    @MockBean private StorageService storageService;
    @MockBean private AuditService auditService;

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

    private User orthodontist(long id) {
        return User.builder().id(id).role(User.Role.ORTHODONTIST).build();
    }

    private User admin(long id) {
        return User.builder().id(id).role(User.Role.ADMIN).build();
    }

    private List<Model3DFile> allThreeSlots() {
        return List.of(
                Model3DFile.builder().id(1L).slot(Model3DFile.Slot.UPPER).build(),
                Model3DFile.builder().id(2L).slot(Model3DFile.Slot.LOWER).build(),
                Model3DFile.builder().id(3L).slot(Model3DFile.Slot.BUCCAL).build());
    }

    @Test
    void reviewerNotAssignedAndNotAdminIsRejected() throws Exception {
        User assignedReviewer = orthodontist(5L);
        User outsider = orthodontist(6L);
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(20)
                .reviewer(assignedReviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "APPROVED")
                        .with(user(outsider)))
                .andExpect(status().isBadRequest());

        verify(trainingSetRepository, never()).save(any());
    }

    @Test
    void adminCanReviewAnySubmission() throws Exception {
        User assignedReviewer = orthodontist(5L);
        User adminUser = admin(9L);
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(20)
                .reviewer(assignedReviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));
        when(model3DFileRepository.findByTrainingSetId(1L)).thenReturn(allThreeSlots());
        when(trainingSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "APPROVED")
                        .with(user(adminUser)))
                .andExpect(status().isOk());

        verify(trainingSetRepository).save(argThat(saved ->
                saved.getReviewer().getId().equals(9L)
                        && saved.getStatus() == TrainingSet.Status.APPROVED));
    }

    @Test
    void approveWithGroundTruthParOutOfRangeIsRejected() throws Exception {
        User reviewer = orthodontist(5L);
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(0) // out of [1,50]
                .reviewer(reviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "APPROVED")
                        .with(user(reviewer)))
                .andExpect(status().isBadRequest());

        verify(trainingSetRepository, never()).save(any());
    }

    @Test
    void approveWithMissingModelFilesIsRejected() throws Exception {
        User reviewer = orthodontist(5L);
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(20)
                .reviewer(reviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));
        // Only UPPER present — LOWER and BUCCAL missing
        when(model3DFileRepository.findByTrainingSetId(1L))
                .thenReturn(List.of(Model3DFile.builder().id(1L).slot(Model3DFile.Slot.UPPER).build()));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "APPROVED")
                        .with(user(reviewer)))
                .andExpect(status().isBadRequest());

        verify(trainingSetRepository, never()).save(any());
    }

    @Test
    void approveSucceedsWithValidRangeAndAllFiles() throws Exception {
        User reviewer = orthodontist(5L);
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(20)
                .reviewer(reviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));
        when(model3DFileRepository.findByTrainingSetId(1L)).thenReturn(allThreeSlots());
        when(trainingSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "APPROVED")
                        .param("comment", "Looks good")
                        .with(user(reviewer)))
                .andExpect(status().isOk());

        verify(trainingSetRepository).save(argThat(saved ->
                saved.getStatus() == TrainingSet.Status.APPROVED));
        verify(auditService).log(eq(reviewer), eq("REVIEW_TRAINING_SET"), eq("TrainingSet"), eq(1L), anyString());
    }

    @Test
    void rejectStatusSkipsApprovalValidation() throws Exception {
        User reviewer = orthodontist(5L);
        // Deliberately invalid for APPROVED (out-of-range PAR, no files) — must not matter for REJECTED.
        TrainingSet ts = TrainingSet.builder().id(1L).groundTruthPar(0)
                .reviewer(reviewer).status(TrainingSet.Status.PENDING).build();
        when(trainingSetRepository.findById(1L)).thenReturn(Optional.of(ts));
        when(trainingSetRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        mockMvc.perform(put("/api/v1/training-sets/1/review")
                        .param("status", "REJECTED")
                        .param("comment", "Needs rework")
                        .with(user(reviewer)))
                .andExpect(status().isOk());

        verify(trainingSetRepository).save(argThat(saved ->
                saved.getStatus() == TrainingSet.Status.REJECTED));
        verifyNoInteractions(model3DFileRepository);
    }
}