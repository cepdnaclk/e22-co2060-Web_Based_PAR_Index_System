package com.parsystem.service;

import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.repository.PatientRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PatientService {

    private final PatientRepository patientRepository;
    private final AuditService auditService;
    private final AccessControlService accessControlService;

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

    public Patient getById(Long id, User user) {
        Patient patient = patientRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Patient not found: " + id));
        accessControlService.requirePatientReadable(patient, user);
        return patient;
    }

    @Transactional
    public Patient create(Patient patient, User creator) {
        if (creator.getRole() != User.Role.ORTHODONTIST) {
            throw new IllegalArgumentException("Only orthodontists can create patient records.");
        }
        validatePatient(patient, true);
        patient.setReferenceId(patient.getReferenceId().trim());
        patient.setName(patient.getName().trim());
        if (patient.getContact() != null) {
            patient.setContact(patient.getContact().trim());
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
        Patient p = getById(id, performer);
        accessControlService.requirePatientWritable(p, performer);
        validatePatient(updates, false);
        if (updates.getName() != null) {
            p.setName(updates.getName().trim());
        }
        if (updates.getDateOfBirth() != null) {
            p.setDateOfBirth(updates.getDateOfBirth());
        }
        p.setContact(updates.getContact() != null ? updates.getContact().trim() : null);
        Patient saved = patientRepository.save(p);
        auditService.log(performer, "UPDATE_PATIENT", "Patient", id, null);
        return saved;
    }

    @Transactional
    public void archive(Long id, User performer) {
        Patient p = getById(id, performer);
        accessControlService.requirePatientWritable(p, performer);
        p.setArchived(true);
        patientRepository.save(p);
        auditService.log(performer, "ARCHIVE_PATIENT", "Patient", id, null);
    }

    public List<Patient> search(String query, User user) {
        String safeQuery = query == null ? "" : query.trim();
        if (safeQuery.length() < 2) {
            throw new IllegalArgumentException("Search query must contain at least 2 characters.");
        }
        if (user.getRole() == User.Role.ADMIN) {
            return patientRepository.findByNameContainingIgnoreCaseAndIsArchivedFalse(safeQuery);
        }
        return patientRepository.findByCreatedByIdAndNameContainingIgnoreCaseAndIsArchivedFalse(
                user.getId(), safeQuery);
    }

    private void validatePatient(Patient patient, boolean requireReference) {
        if (requireReference && (patient.getReferenceId() == null || patient.getReferenceId().isBlank())) {
            throw new IllegalArgumentException("Reference ID is required.");
        }
        if (patient.getReferenceId() != null && patient.getReferenceId().length() > 50) {
            throw new IllegalArgumentException("Reference ID must be 50 characters or fewer.");
        }
        if (patient.getName() == null || patient.getName().isBlank()) {
            throw new IllegalArgumentException("Patient name is required.");
        }
        if (patient.getName().length() > 120) {
            throw new IllegalArgumentException("Patient name must be 120 characters or fewer.");
        }
        if (patient.getReferenceId() != null && patient.getReferenceId().isBlank()) {
            throw new IllegalArgumentException("Reference ID cannot be blank.");
        }
        if (patient.getContact() != null && patient.getContact().length() > 100) {
            throw new IllegalArgumentException("Contact must be 100 characters or fewer.");
        }
        LocalDate dob = patient.getDateOfBirth();
        if (dob != null && dob.isAfter(LocalDate.now())) {
            throw new IllegalArgumentException("Date of birth cannot be in the future.");
        }
    }
}