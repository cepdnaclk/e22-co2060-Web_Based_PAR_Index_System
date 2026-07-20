package com.parsystem.repository;

import com.parsystem.entity.TrainingSet;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;

public interface TrainingSetRepository extends JpaRepository<TrainingSet, Long> {

    List<TrainingSet> findBySubmittedById(Long userId);

    List<TrainingSet> findByReviewerId(Long reviewerId);

    List<TrainingSet> findByStatus(TrainingSet.Status status);

    // REQUIREMENT 14: Count approved datasets (used by MLService for status)
    @Query("SELECT COUNT(ts) FROM TrainingSet ts WHERE ts.status = 'APPROVED'")
    long countApproved();

    // Approved sets that have all 3 model files (used by dataset_preprocessor validation context)
    @Query("SELECT ts FROM TrainingSet ts LEFT JOIN FETCH ts.modelFiles WHERE ts.status = 'APPROVED'")
    List<TrainingSet> findApprovedWithModelFiles();
}
