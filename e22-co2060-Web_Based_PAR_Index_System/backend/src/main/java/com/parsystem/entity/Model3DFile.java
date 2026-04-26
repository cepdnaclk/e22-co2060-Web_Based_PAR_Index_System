package com.parsystem.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "model3d_files")
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Model3DFile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "case_id")
    @JsonIgnore
    private OrthoCase orthoCase;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "training_set_id")
    @JsonIgnore
    private TrainingSet trainingSet;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Slot slot;

    @Column(name = "file_name", nullable = false, length = 255)
    private String fileName;

    @Column(name = "mime_type", nullable = false, length = 100)
    private String mimeType;

    @Column(name = "file_size_mb", nullable = false, precision = 8, scale = 2)
    private BigDecimal fileSizeMb;

    @Column(name = "storage_path", nullable = false, length = 500)
    @JsonIgnore
    private String storagePath;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "uploaded_by", nullable = false)
    @JsonIgnore
    private User uploadedBy;

    @Column(name = "uploaded_at", updatable = false)
    private LocalDateTime uploadedAt;

    @PrePersist
    protected void onCreate() {
        uploadedAt = LocalDateTime.now();
    }

    public enum Slot { UPPER, LOWER, BUCCAL }
}
