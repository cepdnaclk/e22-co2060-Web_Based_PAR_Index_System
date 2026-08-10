package com.parsystem.dto;

import com.parsystem.entity.LandmarkPoint;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTOs for the landmark / 3D auto-scoring API.
 */
public class LandmarkDto {

    // ── Request: submit a batch of points for one slot ─────────────────

    @Data
    public static class SubmitRequest {

        /** Which arch these points belong to (UPPER / LOWER / BUCCAL). */
        @NotNull
        private LandmarkPoint.Slot slot;

        @NotEmpty
        @Valid
        private List<PointData> points;
    }

    @Data
    public static class PointData {
        @NotBlank
        private String name;   // e.g. "R3M", "R1Mid"
        private double x;
        private double y;
        private double z;
    }

    // ── Response: single stored landmark ───────────────────────────────

    @Data
    @Builder
    public static class LandmarkResponse {
        private Long   id;
        private String slot;
        private String pointName;
        private double x, y, z;
        private LocalDateTime createdAt;
        // Exposes whether a point came from the automated ML prediction or
        // manual placement, and whether a clinician has confirmed it —
        // needed by the frontend to auto-populate predicted points while
        // still visually flagging them as unconfirmed until reviewed.
        private String  source;
        private boolean confirmed;
    }

    // ── Response: result of automatic PAR calculation ──────────────────

    @Data
    @Builder
    public static class AutoScoreResponse {

        // Raw component scores (before weighting)
        private int upperAnteriorRaw;
        private int lowerAnteriorRaw;
        private int overjetRaw;
        private int overbiteRaw;
        private int centrelineRaw;
        private int buccalLeftRaw;   // combined AP + transverse + vertical for left
        private int buccalRightRaw;  // combined AP + transverse + vertical for right

        // Weighted component contributions
        private int upperAnteriorWeighted;   // ×1
        private int lowerAnteriorWeighted;   // ×1
        private int overjetWeighted;         // ×6
        private int overbiteWeighted;        // ×2
        private int centrelineWeighted;      // ×4
        private int buccalLeftWeighted;      // ×1
        private int buccalRightWeighted;     // ×1

        // Final totals
        private int  totalWeighted;
        private String classification;    // null for PRE; text for POST

        // Diagnostics
        private int  landmarksUsed;
        private String message;
    }

    @Data
    @Builder
    public static class PredictLandmarksResponse {
        private int landmarksPredicted;
        private String modelVersion;
        private double confidence;
        private Double mlParEstimate;
        private String mlParModelVersion;
        private String message;
    }

    @Data
    @Builder
    public static class PredictResponse {
        private List<PointData> points;
        private String modelVersion;
        private double confidence;
    }

    @Data
    @Builder
    public static class PredictParResponse {
        private Double estimatedPar;
        private String modelVersion;
    }
}
