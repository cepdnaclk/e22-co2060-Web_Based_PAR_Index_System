package com.parsystem.repository;

import com.parsystem.entity.TrainingSet;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TrainingSetRepository extends JpaRepository<TrainingSet, Long> {
    List<TrainingSet> findBySubmittedById(Long userId);
    List<TrainingSet> findByReviewerId(Long reviewerId);
    List<TrainingSet> findByStatus(TrainingSet.Status status);
}