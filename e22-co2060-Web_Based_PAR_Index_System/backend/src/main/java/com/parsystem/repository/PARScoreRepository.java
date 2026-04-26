package com.parsystem.repository;

import com.parsystem.entity.PARScore;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface PARScoreRepository extends JpaRepository<PARScore, Long> {
    Optional<PARScore> findByOrthoCaseId(Long caseId);
}