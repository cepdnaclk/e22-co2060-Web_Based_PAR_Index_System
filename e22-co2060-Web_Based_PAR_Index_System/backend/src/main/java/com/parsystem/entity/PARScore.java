package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.*;

import java.time.LocalDateTime;

/**
 * Stores all seven PAR component scores and the computed weighted total.
 * British PAR weighting scheme:
 *   upper anterior  x1, lower anterior x1
 *   buccal left x1, buccal right x1
 *   overjet x6, overbite x2, centreline x4
 */
@Entity
@Table(name = "par_scores")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PARScore {

    public static final int W_UPPER_ANTERIOR = 1;
    public static final int W_LOWER_ANTERIOR = 1;
    public static final int W_BUCCAL_LEFT    = 1;
    public static final int W_BUCCAL_RIGHT   = 1;
    public static final int W_OVERJET        = 6;
    public static final int W_OVERBITE       = 2;
    public static final int W_CENTRELINE     = 4;

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id", nullable = false, unique = true)
    @JsonIgnore
    private OrthoCase orthoCase;

    @Min(0) @Max(10)
    @Column(name = "upper_anterior", nullable = false)
    private int upperAnterior;

    @Min(0) @Max(10)
    @Column(name = "lower_anterior", nullable = false)
    private int lowerAnterior;

    @Min(0) @Max(5)
    @Column(name = "buccal_left", nullable = false)
    private int buccalLeft;

    @Min(0) @Max(5)
    @Column(name = "buccal_right", nullable = false)
    private int buccalRight;

    @Min(0) @Max(5)
    @Column(name = "overjet", nullable = false)
    private int overjet;

    @Min(0) @Max(4)
    @Column(name = "overbite", nullable = false)
    private int overbite;

    @Min(0) @Max(2)
    @Column(name = "centreline", nullable = false)
    private int centreline;

    @Column(name = "total_weighted", nullable = false)
    private int totalWeighted;

    @Column(length = 60)
    private String classification;

    @Column(name = "calculated_at")
    private LocalDateTime calculatedAt;

    /** Applies British PAR weights and returns the total weighted score. */
    public int computeWeighted() {
        return upperAnterior * W_UPPER_ANTERIOR
             + lowerAnterior * W_LOWER_ANTERIOR
             + buccalLeft    * W_BUCCAL_LEFT
             + buccalRight   * W_BUCCAL_RIGHT
             + overjet       * W_OVERJET
             + overbite      * W_OVERBITE
             + centreline    * W_CENTRELINE;
    }
}
