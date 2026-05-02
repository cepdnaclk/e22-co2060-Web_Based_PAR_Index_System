// ══════════════════════════════════════════════════════════════════════
//  PAR Score DTOs
// ══════════════════════════════════════════════════════════════════════
package com.parsystem.dto;

import lombok.Builder;
import lombok.Data;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.time.LocalDateTime;
public class PARScoreDto {

    @Data
    public static class CalculateRequest {
        @Min(0) @Max(10) private int upperAnterior;
        @Min(0) @Max(10) private int lowerAnterior;
        @Min(0) @Max(5)  private int buccalLeft;
        @Min(0) @Max(5)  private int buccalRight;
        @Min(0) @Max(5)  private int overjet;
        @Min(0) @Max(4)  private int overbite;
        @Min(0) @Max(2)  private int centreline;
    }

    @Data @Builder
    public static class Response {
        private Long id;
        private int upperAnterior;
        private int lowerAnterior;
        private int buccalLeft;
        private int buccalRight;
        private int overjet;
        private int overbite;
        private int centreline;
        private int totalWeighted;
        private String classification;
        private LocalDateTime calculatedAt;
    }
}
