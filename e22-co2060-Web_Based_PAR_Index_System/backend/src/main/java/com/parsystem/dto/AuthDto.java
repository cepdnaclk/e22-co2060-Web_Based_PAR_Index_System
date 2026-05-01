package com.parsystem.dto;

import com.parsystem.entity.*;
import jakarta.validation.constraints.*;
import lombok.*;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

// ══════════════════════════════════════════════════════════════════════
//  Auth DTOs
// ══════════════════════════════════════════════════════════════════════

public class AuthDto {

    @Data
    public static class RegisterRequest {
        @NotBlank  private String name;
        @Email @NotBlank private String email;
        @NotBlank @Size(min = 8) private String password;
        @NotNull   private User.Role role;
    }

    @Data
    public static class LoginRequest {
        @Email @NotBlank private String email;
        @NotBlank        private String password;
    }

    @Data @Builder
    public static class AuthResponse {
        private String token;
        private String name;
        private String email;
        private User.Role role;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  Patient DTOs
// ══════════════════════════════════════════════════════════════════════

class PatientDto {

    @Data
    public static class CreateRequest {
        @NotBlank @Size(max = 50)  private String referenceId;
        @NotBlank @Size(max = 120) private String name;
        private LocalDate dateOfBirth;
        @Size(max = 100) private String contact;
    }

    @Data @Builder
    public static class Response {
        private Long id;
        private String referenceId;
        private String name;
        private LocalDate dateOfBirth;
        private String contact;
        private boolean isArchived;
        private LocalDateTime createdAt;
        private int totalCases;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  Case DTOs
// ══════════════════════════════════════════════════════════════════════

class CaseDto {

    @Data
    public static class CreateRequest {
        @NotNull private Long patientId;
        @NotNull private OrthoCase.Stage stage;
        private String notes;
    }

    @Data @Builder
    public static class Response {
        private Long id;
        private Long patientId;
        private String patientName;
        private OrthoCase.Stage stage;
        private boolean isFinalized;
        private String notes;
        private PARScoreDto.Response parScore;
        private List<Model3DFileDto.Response> modelFiles;
        private LocalDateTime createdAt;
    }
}


// ══════════════════════════════════════════════════════════════════════
//  3D Model File DTOs
// ══════════════════════════════════════════════════════════════════════

class Model3DFileDto {

    @Data @Builder
    public static class Response {
        private Long id;
        private Model3DFile.Slot slot;
        private String fileName;
        private String mimeType;
        private double fileSizeMb;
        private LocalDateTime uploadedAt;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  Training Set DTOs
// ══════════════════════════════════════════════════════════════════════

class TrainingSetDto {

    @Data
    public static class CreateRequest {
        @NotBlank @Size(max = 200) private String anonymisedLabel;
        @NotNull @Min(0) @Max(100) private Integer groundTruthPar;
        private String sourceDescription;
    }

    @Data
    public static class ReviewRequest {
        @NotNull private TrainingSet.Status status;   // APPROVED or REJECTED
        private String reviewerComment;
    }

    @Data @Builder
    public static class Response {
        private Long id;
        private String anonymisedLabel;
        private int groundTruthPar;
        private String sourceDescription;
        private TrainingSet.Status status;
        private String reviewerComment;
        private List<Model3DFileDto.Response> modelFiles;
        private LocalDateTime submittedAt;
    }
}

// ══════════════════════════════════════════════════════════════════════
//  Generic API Response wrapper
// ══════════════════════════════════════════════════════════════════════

@Data @Builder
class ApiResponse<T> {
    private boolean success;
    private String message;
    private T data;

    public static <T> ApiResponse<T> ok(T data) {
        return ApiResponse.<T>builder().success(true).data(data).build();
    }

    public static <T> ApiResponse<T> ok(String message, T data) {
        return ApiResponse.<T>builder().success(true).message(message).data(data).build();
    }

    public static <T> ApiResponse<T> error(String message) {
        return ApiResponse.<T>builder().success(false).message(message).build();
    }
}