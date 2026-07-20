package com.parsystem.service;

import com.parsystem.entity.Patient;
import com.parsystem.entity.User;
import com.parsystem.repository.PatientRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PatientServiceTest {

    @Mock private PatientRepository patientRepository;
    @Mock private AuditService auditService;
    @Mock private AccessControlService accessControlService;

    @InjectMocks private PatientService patientService;

    private User orthodontist;

    @BeforeEach
    void setUp() {
        orthodontist = User.builder().id(1L).role(User.Role.ORTHODONTIST).build();
    }

    @Test
    void createRejectsDuplicateReferenceIds() {
        Patient patient = Patient.builder()
                .referenceId("ABC-123")
                .name("Jane Doe")
                .dateOfBirth(LocalDate.of(2000, 1, 1))
                .build();

        when(patientRepository.findByReferenceId("ABC-123")).thenReturn(Optional.of(patient));

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> patientService.create(patient, orthodontist));

        assertTrue(ex.getMessage().contains("already exists"));
        verify(patientRepository, never()).save(any());
    }

    @Test
    void updateAllowsPartialFieldsWithoutNullPointer() {
        Patient existing = Patient.builder()
                .id(10L)
                .referenceId("ABC-123")
                .name("Old Name")
                .dateOfBirth(LocalDate.of(1999, 1, 1))
                .build();
        Patient updates = Patient.builder()
                .name("New Name")
                .build();

        when(patientRepository.findById(10L)).thenReturn(Optional.of(existing));

        doNothing().when(accessControlService).requirePatientReadable(existing, orthodontist);
        doNothing().when(accessControlService).requirePatientWritable(existing, orthodontist);
        when(patientRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Patient saved = patientService.update(10L, updates, orthodontist);

        assertEquals("New Name", saved.getName());
        assertEquals(LocalDate.of(1999, 1, 1), saved.getDateOfBirth());
    }
}
