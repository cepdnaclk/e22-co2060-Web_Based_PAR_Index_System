package com.parsystem.controller;

import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/patients")
@RequiredArgsConstructor
public class PatientController {

    private final PatientService patientService;

    /** ORTHODONTIST sees their own patients; ADMIN sees all (read-only). */
    @GetMapping
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<List<Patient>> getAll(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(patientService.getAllForUser(user));
    }

    /** Both ORTHODONTIST and ADMIN can view a patient record. */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<Patient> getById(@PathVariable Long id) {
        return ResponseEntity.ok(patientService.getById(id));
    }

    /** Only ORTHODONTIST can create patients. */
    @PostMapping
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<Patient> create(
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        Patient patient = Patient.builder()
                .referenceId(body.get("referenceId"))
                .name(body.get("name"))
                .dateOfBirth(body.get("dateOfBirth") != null && !body.get("dateOfBirth").isBlank()
                        ? LocalDate.parse(body.get("dateOfBirth")) : null)
                .contact(body.get("contact"))
                .build();

        return ResponseEntity.ok(patientService.create(patient, user));
    }

    /** Only ORTHODONTIST can update patients. */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<Patient> update(
            @PathVariable Long id,
            @RequestBody Map<String, String> body,
            @AuthenticationPrincipal User user) {

        Patient updates = Patient.builder()
                .name(body.get("name"))
                .dateOfBirth(body.get("dateOfBirth") != null && !body.get("dateOfBirth").isBlank()
                        ? LocalDate.parse(body.get("dateOfBirth")) : null)
                .contact(body.get("contact"))
                .build();

        return ResponseEntity.ok(patientService.update(id, updates, user));
    }

    /** Only ORTHODONTIST can archive patients. */
    @PatchMapping("/{id}/archive")
    @PreAuthorize("hasRole('ORTHODONTIST')")
    public ResponseEntity<Void> archive(@PathVariable Long id,
                                         @AuthenticationPrincipal User user) {
        patientService.archive(id, user);
        return ResponseEntity.noContent().build();
    }

    /** ORTHODONTIST and ADMIN can search. */
    @GetMapping("/search")
    @PreAuthorize("hasAnyRole('ORTHODONTIST','ADMIN')")
    public ResponseEntity<List<Patient>> search(@RequestParam String query) {
        return ResponseEntity.ok(patientService.search(query));
    }
}
