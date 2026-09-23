package com.parsystem.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.parsystem.config.SecurityConfig;
import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.LandmarkPoint;
import com.parsystem.entity.User;
import com.parsystem.security.JwtAuthFilter;
import com.parsystem.service.GeometricPARService;
import com.parsystem.service.LandmarkService;
import com.parsystem.service.MlPredictionService;
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

import java.util.Collections;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(LandmarkController.class)
@Import(SecurityConfig.class)
class LandmarkControllerTest {

    @Autowired private MockMvc mockMvc;
    @Autowired private ObjectMapper objectMapper;

    @MockBean private LandmarkService landmarkService;
    @MockBean private GeometricPARService geometricPARService;
    @MockBean private MlPredictionService mlPredictionService;

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

    private User undergraduate(long id) {
        return User.builder().id(id).role(User.Role.UNDERGRADUATE).build();
    }

    private LandmarkDto.SubmitRequest validSubmitRequest() {
        LandmarkDto.PointData point = new LandmarkDto.PointData();
        point.setName("R3M");
        point.setX(12.5);
        point.setY(-3.2);
        point.setZ(4.0);

        LandmarkDto.SubmitRequest request = new LandmarkDto.SubmitRequest();
        request.setSlot(LandmarkPoint.Slot.UPPER);
        request.setPoints(List.of(point));
        return request;
    }

    // ── POST /landmarks — role gating ───────────────────────────────────

    @Test
    void submitLandmarks_undergraduateBlocked() throws Exception {
        mockMvc.perform(post("/api/v1/cases/1/landmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validSubmitRequest()))
                        .with(user(undergraduate(3L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(landmarkService);
    }

    @Test
    void submitLandmarks_orthodontistAllowed() throws Exception {
        User ortho = orthodontist(5L);
        when(landmarkService.submitPoints(eq(1L), any(), eq(ortho)))
                .thenReturn(Collections.emptyList());

        mockMvc.perform(post("/api/v1/cases/1/landmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(validSubmitRequest()))
                        .with(user(ortho)))
                .andExpect(status().isOk());

        verify(landmarkService).submitPoints(eq(1L), any(), eq(ortho));
    }

    // ── POST /landmarks — request validation ────────────────────────────

    @Test
    void submitLandmarks_missingSlotIsRejected() throws Exception {
        User ortho = orthodontist(5L);
        LandmarkDto.SubmitRequest request = validSubmitRequest();
        request.setSlot(null);

        mockMvc.perform(post("/api/v1/cases/1/landmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .with(user(ortho)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(landmarkService);
    }

    @Test
    void submitLandmarks_emptyPointsListIsRejected() throws Exception {
        User ortho = orthodontist(5L);
        LandmarkDto.SubmitRequest request = validSubmitRequest();
        request.setPoints(Collections.emptyList());

        mockMvc.perform(post("/api/v1/cases/1/landmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .with(user(ortho)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(landmarkService);
    }

    @Test
    void submitLandmarks_blankPointNameIsRejected() throws Exception {
        User ortho = orthodontist(5L);
        LandmarkDto.PointData badPoint = new LandmarkDto.PointData();
        badPoint.setName("");   // @NotBlank on PointData.name, validated via @Valid cascading from the list
        badPoint.setX(1.0);
        badPoint.setY(1.0);
        badPoint.setZ(1.0);

        LandmarkDto.SubmitRequest request = validSubmitRequest();
        request.setPoints(List.of(badPoint));

        mockMvc.perform(post("/api/v1/cases/1/landmarks")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request))
                        .with(user(ortho)))
                .andExpect(status().isBadRequest());

        verifyNoInteractions(landmarkService);
    }

    // ── GET /landmarks ───────────────────────────────────────────────────

    @Test
    void getLandmarks_undergraduateBlocked() throws Exception {
        mockMvc.perform(get("/api/v1/cases/1/landmarks")
                        .with(user(undergraduate(3L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(landmarkService);
    }

    @Test
    void getLandmarks_orthodontistAllowed() throws Exception {
        when(landmarkService.getPoints(1L)).thenReturn(Collections.emptyList());

        mockMvc.perform(get("/api/v1/cases/1/landmarks")
                        .with(user(orthodontist(5L))))
                .andExpect(status().isOk());

        verify(landmarkService).getPoints(1L);
    }

    // ── DELETE /landmarks ────────────────────────────────────────────────

    @Test
    void clearLandmarks_undergraduateBlocked() throws Exception {
        mockMvc.perform(delete("/api/v1/cases/1/landmarks")
                        .with(user(undergraduate(3L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(landmarkService);
    }

    @Test
    void clearLandmarks_adminAllowed() throws Exception {
        User adminUser = admin(9L);

        mockMvc.perform(delete("/api/v1/cases/1/landmarks")
                        .with(user(adminUser)))
                .andExpect(status().isOk());

        verify(landmarkService).clearPoints(1L, adminUser);
    }

    // ── POST /predict-landmarks ──────────────────────────────────────────

    @Test
    void predictLandmarks_undergraduateBlocked() throws Exception {
        mockMvc.perform(post("/api/v1/cases/1/predict-landmarks")
                        .with(user(undergraduate(3L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(mlPredictionService);
    }

    @Test
    void predictLandmarks_orthodontistAllowed() throws Exception {
        User ortho = orthodontist(5L);
        when(mlPredictionService.predictForCase(1L, ortho))
                .thenReturn(LandmarkDto.PredictLandmarksResponse.builder()
                        .landmarksPredicted(32)
                        .modelVersion("v1.0")
                        .confidence(0.9)
                        .build());

        mockMvc.perform(post("/api/v1/cases/1/predict-landmarks")
                        .with(user(ortho)))
                .andExpect(status().isOk());

        verify(mlPredictionService).predictForCase(1L, ortho);
    }

    // ── POST /auto-calculate ─────────────────────────────────────────────

    @Test
    void autoCalculate_undergraduateBlocked() throws Exception {
        mockMvc.perform(post("/api/v1/cases/1/auto-calculate")
                        .with(user(undergraduate(3L))))
                .andExpect(status().isForbidden());

        verifyNoInteractions(geometricPARService);
    }

    @Test
    void autoCalculate_adminAllowed() throws Exception {
        User adminUser = admin(9L);
        when(geometricPARService.calculateAndSave(1L, adminUser))
                .thenReturn(LandmarkDto.AutoScoreResponse.builder()
                        .totalWeighted(8)
                        .landmarksUsed(32)
                        .build());

        mockMvc.perform(post("/api/v1/cases/1/auto-calculate")
                        .with(user(adminUser)))
                .andExpect(status().isOk());

        verify(geometricPARService).calculateAndSave(1L, adminUser);
    }
}