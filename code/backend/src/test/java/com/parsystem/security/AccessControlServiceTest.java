package com.parsystem.service;

import com.parsystem.entity.Model3DFile;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.Patient;
import com.parsystem.entity.TrainingSet;
import com.parsystem.entity.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.access.AccessDeniedException;

import static org.junit.jupiter.api.Assertions.*;

@ExtendWith(MockitoExtension.class)
class AccessControlServiceTest {

    private AccessControlService accessControlService;

    private User admin;
    private User orthodontist;
    private User otherOrthodontist;
    private User undergraduate;

    @BeforeEach
    void setUp() {
        accessControlService = new AccessControlService();

        admin = User.builder().id(1L).role(User.Role.ADMIN).build();
        orthodontist = User.builder().id(2L).role(User.Role.ORTHODONTIST).build();
        otherOrthodontist = User.builder().id(3L).role(User.Role.ORTHODONTIST).build();
        undergraduate = User.builder().id(4L).role(User.Role.UNDERGRADUATE).build();
    }

    // ---- requirePatientReadable ----

    @Test
    void adminCanReadAnyPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        assertDoesNotThrow(() -> accessControlService.requirePatientReadable(patient, admin));
    }

    @Test
    void ownerOrthodontistCanReadOwnPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        assertDoesNotThrow(() -> accessControlService.requirePatientReadable(patient, orthodontist));
    }

    @Test
    void nonOwnerOrthodontistCannotReadPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requirePatientReadable(patient, otherOrthodontist));
    }

    @Test
    void undergraduateCannotReadPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requirePatientReadable(patient, undergraduate));
    }

    @Test
    void nullUserCannotReadPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requirePatientReadable(patient, null));
    }

    // ---- requirePatientWritable ----

    @Test
    void ownerOrthodontistCanWriteNonArchivedPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(false).build();
        assertDoesNotThrow(() -> accessControlService.requirePatientWritable(patient, orthodontist));
    }

    @Test
    void adminCannotWritePatientBecauseNotOrthodontist() {
        // Admin passes the readable check, but the writable check additionally
        // requires the ORTHODONTIST role, which ADMIN does not have.
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(false).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requirePatientWritable(patient, admin));
    }

    @Test
    void nonOwnerOrthodontistCannotWritePatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(false).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requirePatientWritable(patient, otherOrthodontist));
    }

    @Test
    void archivedPatientCannotBeWritten() {
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(true).build();
        assertThrows(IllegalStateException.class,
                () -> accessControlService.requirePatientWritable(patient, orthodontist));
    }

    // ---- requireCaseReadable / requireCaseWritable ----

    @Test
    void ownerOrthodontistCanReadOwnCase() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        assertDoesNotThrow(() -> accessControlService.requireCaseReadable(orthoCase, orthodontist));
    }

    @Test
    void nonOwnerOrthodontistCannotReadCase() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireCaseReadable(orthoCase, otherOrthodontist));
    }

    @Test
    void ownerOrthodontistCanWriteCaseOnNonArchivedPatient() {
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(false).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        assertDoesNotThrow(() -> accessControlService.requireCaseWritable(orthoCase, orthodontist));
    }

    @Test
    void caseOnArchivedPatientCannotBeWritten() {
        Patient patient = Patient.builder().createdBy(orthodontist).isArchived(true).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        assertThrows(IllegalStateException.class,
                () -> accessControlService.requireCaseWritable(orthoCase, orthodontist));
    }

    // ---- requireTrainingSetOwnerOrAdmin ----

    @Test
    void adminCanAccessAnyTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).build();
        assertDoesNotThrow(() -> accessControlService.requireTrainingSetOwnerOrAdmin(trainingSet, admin));
    }

    @Test
    void submitterCanAccessOwnTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).build();
        assertDoesNotThrow(() -> accessControlService.requireTrainingSetOwnerOrAdmin(trainingSet, undergraduate));
    }

    @Test
    void nonSubmitterCannotAccessTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireTrainingSetOwnerOrAdmin(trainingSet, orthodontist));
    }

    @Test
    void trainingSetWithNoSubmitterDeniesNonAdmin() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(null).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireTrainingSetOwnerOrAdmin(trainingSet, undergraduate));
    }

    // ---- requireTrainingSetReviewerOrAdmin ----

    @Test
    void adminCanReviewAnyTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().reviewer(orthodontist).build();
        assertDoesNotThrow(() -> accessControlService.requireTrainingSetReviewerOrAdmin(trainingSet, admin));
    }

    @Test
    void assignedReviewerCanReviewTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().reviewer(orthodontist).build();
        assertDoesNotThrow(() -> accessControlService.requireTrainingSetReviewerOrAdmin(trainingSet, orthodontist));
    }

    @Test
    void nonAssignedReviewerCannotReviewTrainingSet() {
        TrainingSet trainingSet = TrainingSet.builder().reviewer(orthodontist).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireTrainingSetReviewerOrAdmin(trainingSet, otherOrthodontist));
    }

    @Test
    void trainingSetWithNoReviewerDeniesNonAdmin() {
        TrainingSet trainingSet = TrainingSet.builder().reviewer(null).build();
        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireTrainingSetReviewerOrAdmin(trainingSet, orthodontist));
    }

    // ---- requireModelReadable ----

    @Test
    void modelLinkedToReadableCaseIsReadable() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        Model3DFile modelFile = Model3DFile.builder().orthoCase(orthoCase).build();

        assertDoesNotThrow(() -> accessControlService.requireModelReadable(modelFile, orthodontist));
    }

    @Test
    void modelLinkedToUnreadableCaseIsDenied() {
        Patient patient = Patient.builder().createdBy(orthodontist).build();
        OrthoCase orthoCase = OrthoCase.builder().patient(patient).build();
        Model3DFile modelFile = Model3DFile.builder().orthoCase(orthoCase).build();

        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireModelReadable(modelFile, otherOrthodontist));
    }

    @Test
    void modelLinkedToTrainingSetReadableByAdmin() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).build();
        Model3DFile modelFile = Model3DFile.builder().trainingSet(trainingSet).build();

        assertDoesNotThrow(() -> accessControlService.requireModelReadable(modelFile, admin));
    }

    @Test
    void modelLinkedToTrainingSetReadableBySubmitter() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).build();
        Model3DFile modelFile = Model3DFile.builder().trainingSet(trainingSet).build();

        assertDoesNotThrow(() -> accessControlService.requireModelReadable(modelFile, undergraduate));
    }

    @Test
    void modelLinkedToTrainingSetReadableByReviewer() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).reviewer(orthodontist).build();
        Model3DFile modelFile = Model3DFile.builder().trainingSet(trainingSet).build();

        assertDoesNotThrow(() -> accessControlService.requireModelReadable(modelFile, orthodontist));
    }

    @Test
    void modelLinkedToTrainingSetDeniedForUnrelatedUser() {
        TrainingSet trainingSet = TrainingSet.builder().submittedBy(undergraduate).reviewer(orthodontist).build();
        Model3DFile modelFile = Model3DFile.builder().trainingSet(trainingSet).build();

        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireModelReadable(modelFile, otherOrthodontist));
    }

    @Test
    void modelWithNoCaseAndNoTrainingSetIsDenied() {
        Model3DFile modelFile = Model3DFile.builder().build();

        assertThrows(AccessDeniedException.class,
                () -> accessControlService.requireModelReadable(modelFile, admin));
    }
}
