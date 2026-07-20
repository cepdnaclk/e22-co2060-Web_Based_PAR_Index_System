package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "ortho_cases")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonIgnoreProperties({"hibernateLazyInitializer", "handler"})
public class OrthoCase {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Include only safe patient fields — avoid circular reference
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "patient_id", nullable = false)
    @JsonIgnoreProperties({"cases", "createdBy", "updatedAt", "hibernateLazyInitializer"})
    private Patient patient;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "created_by", nullable = false)
    @JsonIgnoreProperties({"passwordHash", "authorities", "updatedAt", "hibernateLazyInitializer", "handler"})
    private User createdBy;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Stage stage;

    // BUG FIX: Lombok generates the getter isFinalized() for this boolean field
    // (since the field name already starts with "is"), but Jackson's default
    // bean-property naming strips the "is" prefix from boolean getters when
    // serializing, producing the JSON key "finalized" instead of "isFinalized".
    // The frontend reads `c.isFinalized` everywhere (finalized badge, the
    // pre-treatment-case guard, the ML auto-prompt effect, etc.), so it was
    // always seeing `undefined` and silently rendering cases as "Draft" even
    // after a successful finalize on the backend. Pinning the JSON property
    // name here makes the wire contract explicit and independent of Lombok's
    // getter-naming behavior.
    @Column(name = "is_finalized", nullable = false)
    @Builder.Default
    @JsonProperty("isFinalized")
    private boolean isFinalized = false;

    @Column(columnDefinition = "TEXT")
    private String notes;

    @Column(name = "ml_predicted_score")
    private Float mlPredictedScore;

    // REQUIREMENT 1: ML confidence note for display in CaseDetail
    @Column(name = "ml_confidence_note", length = 500)
    private String mlConfidenceNote;

    // REQUIREMENT 7: Optimistic locking — JPA Hibernate handles concurrency automatically
    @Version
    @Column(name = "version", nullable = false)
    @Builder.Default
    private int version = 0;

    // REQUIREMENT 2: PRE/POST case pairing — explicit link to the PRE case
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "pre_case_id")
    @JsonIgnoreProperties({"parScore", "modelFiles", "patient", "createdBy", "hibernateLazyInitializer", "handler"})
    private OrthoCase preCase;

    // REQUIREMENT 3: Finalization audit trail
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "finalized_by")
    @JsonIgnoreProperties({"passwordHash", "authorities", "updatedAt", "hibernateLazyInitializer", "handler"})
    private User finalizedBy;

    @Column(name = "finalized_at")
    private LocalDateTime finalizedAt;

    // FIXED: use LAZY + @JsonIgnoreProperties to break circular reference
    @OneToOne(mappedBy = "orthoCase", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JsonIgnoreProperties({"orthoCase"})
    private PARScore parScore;

    @OneToMany(mappedBy = "orthoCase", cascade = CascadeType.ALL, fetch = FetchType.EAGER)
    @JsonIgnoreProperties({"orthoCase", "trainingSet", "uploadedBy"})
    @Builder.Default
    private List<Model3DFile> modelFiles = new ArrayList<>();

    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    @JsonIgnore
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Stage { PRE, POST }
}