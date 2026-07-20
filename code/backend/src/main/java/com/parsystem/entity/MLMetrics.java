package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "ml_metrics")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class MLMetrics {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "model_version", nullable = false, length = 50)
    private String modelVersion;

    @Column(nullable = false)
    private double accuracy;

    @Column(name = "val_accuracy")
    private double valAccuracy;

    @Column(nullable = false)
    private double loss;

    @Column(name = "val_loss")
    private double valLoss;

    @Column(name = "epoch_number", nullable = false)
    private int epochNumber;

    @Column(name = "dataset_size")
    private int datasetSize;

    // PENDING | TRAINING | COMPLETED | FAILED
    @Column(nullable = false, length = 20)
    @Builder.Default
    private String status = "PENDING";

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by", nullable = false)
    @JsonIgnoreProperties({"passwordHash", "authorities", "hibernateLazyInitializer"})
    private User submittedBy;

    @Column(name = "trained_at")
    private LocalDateTime trainedAt;

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
