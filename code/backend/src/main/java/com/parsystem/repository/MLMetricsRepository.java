package com.parsystem.repository;

import com.parsystem.entity.MLMetrics;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface MLMetricsRepository extends JpaRepository<MLMetrics, Long> {

    List<MLMetrics> findAllByOrderByCreatedAtDesc();

    List<MLMetrics> findBySubmittedByIdOrderByCreatedAtDesc(Long userId);

    Optional<MLMetrics> findTopByOrderByAccuracyDesc();

    @Query("SELECT m FROM MLMetrics m WHERE m.status = 'COMPLETED' ORDER BY m.trainedAt DESC")
    List<MLMetrics> findCompletedRuns();

    List<MLMetrics> findByModelVersionOrderByEpochNumberAsc(String modelVersion);

    // REQUIREMENT 14: Check if any training is currently in progress
    @Query("SELECT COUNT(m) > 0 FROM MLMetrics m WHERE m.status = 'TRAINING'")
    boolean existsByStatusTraining();
}
