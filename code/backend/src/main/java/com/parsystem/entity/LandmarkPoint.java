package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.time.LocalDateTime;

/**
 * A named 3D landmark point placed by a clinician on a dental scan model.
 *
 * Slots:
 *   UPPER  — upper arch segment (teeth 3R … 3L)
 *   LOWER  — lower arch segment (teeth 3R … 3L)
 *   BUCCAL — buccal view used for overjet reference points
 *
 * Point-name conventions (examples):
 *   Anterior  : R3M, R2D, R2M, R1D, R1M, L1M, L1D, L2M, L2D, L3M
 *   Incisors  : R1Mid, R1Low, L1M, R1M, R1D
 *   Molars    : R6MB, R6MP, R6DB, R6DP, R6GB, R6M, R4BT, R4PT, R5BT, R5PT
 *               (same pattern for L-side)
 *   Buccal    : LCover
 */
@Entity
@Table(name = "landmark_points")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LandmarkPoint {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false)
    @JsonIgnore
    private OrthoCase orthoCase;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @NotNull
    private Slot slot;

    @Column(name = "point_name", nullable = false, length = 50)
    @NotBlank
    private String pointName;

    @Column(nullable = false)
    private double x;

    @Column(nullable = false)
    private double y;

    @Column(nullable = false)
    private double z;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }

    public enum Slot { UPPER, LOWER, BUCCAL }
}
