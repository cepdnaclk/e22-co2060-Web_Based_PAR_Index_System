package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "training_sets")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingSet {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "submitted_by", nullable = false)
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "passwordHash"})
    private User submittedBy;

    @Column(name = "anonymised_label", nullable = false, length = 200)
    private String anonymisedLabel;

    @Column(name = "ground_truth_par", nullable = false)
    private int groundTruthPar;

    @Column(name = "source_description", columnDefinition = "TEXT")
    private String sourceDescription;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.PENDING;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "reviewer_id")
    @JsonIgnoreProperties({"hibernateLazyInitializer", "handler", "passwordHash"})
    private User reviewer;

    @Column(name = "reviewer_comment", columnDefinition = "TEXT")
    private String reviewerComment;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "ml_dataset_version", length = 50)
    private String mlDatasetVersion;

    @OneToMany(mappedBy = "trainingSet", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JsonIgnoreProperties({"trainingSet", "orthoCase", "uploadedBy"})
    @Builder.Default
    private List<Model3DFile> modelFiles = new ArrayList<>();

    @Column(name = "submitted_at", updatable = false)
    private LocalDateTime submittedAt;

    @PrePersist
    protected void onCreate() {
        submittedAt = LocalDateTime.now();
    }

    public enum Status { PENDING, APPROVED, REJECTED }
}
