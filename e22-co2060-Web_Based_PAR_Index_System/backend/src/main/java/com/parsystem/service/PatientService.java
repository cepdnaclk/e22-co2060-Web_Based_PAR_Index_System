package com.parsystem.service;

import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patientRepository;
    private final AuditService auditService;

    /**
     * ADMIN  → sees all patients (read-only in UI).
     * ORTHODONTIST → sees their own patients.
     */
    public List<Patient> getAllForUser(User user) {
        if (user.getRole() == User.Role.ADMIN) {
            return patientRepository.findAll();
        }
        // Orthodontist sees patients they created
        return patientRepository.findByCreatedByIdAndIsArchivedFalse(user.getId());
    }

    public Patient getById(Long id) {
        return patientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Patient not found: " + id));
    }

    @Transactional
    public Patient create(Patient patient, User creator) {
        if (creator.getRole() != User.Role.ORTHODONTIST) {
            throw new IllegalArgumentException("Only orthodontists can create patient records.");
        }
        if (patientRepository.findByReferenceId(patient.getReferenceId()).isPresent()) {
            throw new IllegalArgumentException("Reference ID already exists: " + patient.getReferenceId());
        }
        patient.setCreatedBy(creator);
        Patient saved = patientRepository.save(patient);
        auditService.log(creator, "CREATE_PATIENT", "Patient", saved.getId(), null);
        return saved;
    }

    @Transactional
    public Patient update(Long id, Patient updates, User performer) {
        Patient p = getById(id);
        p.setName(updates.getName());
        p.setDateOfBirth(updates.getDateOfBirth());
        p.setContact(updates.getContact());
        Patient saved = patientRepository.save(p);
        auditService.log(performer, "UPDATE_PATIENT", "Patient", id, null);
        return saved;
    }

    @Transactional
    public void archive(Long id, User performer) {
        Patient p = getById(id);
        p.setArchived(true);
        patientRepository.save(p);
        auditService.log(performer, "ARCHIVE_PATIENT", "Patient", id, null);
    }

    public List<Patient> search(String query) {
        return patientRepository.findByNameContainingIgnoreCaseAndIsArchivedFalse(query);
    }
}
