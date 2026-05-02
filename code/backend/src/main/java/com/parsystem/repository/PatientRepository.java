package com.parsystem.repository;

import com.parsystem.entity.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import java.util.List;
import java.util.Optional;

public interface PatientRepository extends JpaRepository<Patient, Long> {
    List<Patient> findByCreatedByIdAndIsArchivedFalse(Long userId);
    Optional<Patient> findByReferenceId(String referenceId);
    List<Patient> findByNameContainingIgnoreCaseAndIsArchivedFalse(String name);
}