package com.parsystem.repository;

import com.parsystem.entity.OrthoCase;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface OrthoCaseRepository extends JpaRepository<OrthoCase, Long> {
    List<OrthoCase> findByPatientId(Long patientId);
    List<OrthoCase> findByCreatedById(Long userId);
}