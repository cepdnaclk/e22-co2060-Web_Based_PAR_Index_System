package com.parsystem.controller;

import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.service.PatientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
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

    @GetMapping
    public ResponseEntity<List<Patient>> getAll(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(patientService.getAllForUser(user));
    }

    @GetMapping("/{id}")
    public ResponseEntity<Patient> getById(@PathVariable Long id) {
        return ResponseEntity.ok(patientService.getById(id));
    }

    /**
     * FIXED: Accept JSON body with individual fields instead of full Patient entity.
     * Frontend sends: { referenceId, name, dateOfBirth, contact }
     */
    @PostMapping
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

    @PutMapping("/{id}")
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

    @PatchMapping("/{id}/archive")
    public ResponseEntity<Void> archive(@PathVariable Long id,
                                         @AuthenticationPrincipal User user) {
        patientService.archive(id, user);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/search")
    public ResponseEntity<List<Patient>> search(@RequestParam String query) {
        return ResponseEntity.ok(patientService.search(query));
    }
}
