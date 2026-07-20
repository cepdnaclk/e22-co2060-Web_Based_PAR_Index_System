package com.parsystem.service;

import com.parsystem.entity.Model3DFile;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.Patient;
import com.parsystem.entity.TrainingSet;
import com.parsystem.entity.User;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
public class AccessControlService {

    public void requirePatientReadable(Patient patient, User user) {
        if (isAdmin(user)) return;
        if (isOrthodontist(user) && isOwner(patient, user)) return;
        throw new AccessDeniedException("You do not have access to this patient record.");
    }

    public void requirePatientWritable(Patient patient, User user) {
        requirePatientReadable(patient, user);
        if (!isOrthodontist(user)) {
            throw new AccessDeniedException("Only orthodontists can modify patient records.");
        }
        if (patient.isArchived()) {
            throw new IllegalStateException("Archived patient records cannot be modified.");
        }
    }

    public void requireCaseReadable(OrthoCase orthoCase, User user) {
        requirePatientReadable(orthoCase.getPatient(), user);
    }

    public void requireCaseWritable(OrthoCase orthoCase, User user) {
        requirePatientWritable(orthoCase.getPatient(), user);
    }

    public void requireTrainingSetOwnerOrAdmin(TrainingSet trainingSet, User user) {
        if (isAdmin(user)) return;
        if (trainingSet.getSubmittedBy() != null
                && trainingSet.getSubmittedBy().getId().equals(user.getId())) {
            return;
        }
        throw new AccessDeniedException("You do not have access to this training set.");
    }

    public void requireTrainingSetReviewerOrAdmin(TrainingSet trainingSet, User user) {
        if (isAdmin(user)) return;
        if (trainingSet.getReviewer() != null
                && trainingSet.getReviewer().getId().equals(user.getId())) {
            return;
        }
        throw new AccessDeniedException("You can only review assigned submissions.");
    }

    public void requireModelReadable(Model3DFile modelFile, User user) {
        if (modelFile.getOrthoCase() != null) {
            requireCaseReadable(modelFile.getOrthoCase(), user);
            return;
        }
        if (modelFile.getTrainingSet() != null) {
            TrainingSet ts = modelFile.getTrainingSet();
            if (isAdmin(user)) return;
            if (ts.getReviewer() != null && ts.getReviewer().getId().equals(user.getId())) return;
            if (ts.getSubmittedBy() != null && ts.getSubmittedBy().getId().equals(user.getId())) return;
        }
        throw new AccessDeniedException("You do not have access to this model file.");
    }

    private boolean isOwner(Patient patient, User user) {
        return patient.getCreatedBy() != null && patient.getCreatedBy().getId().equals(user.getId());
    }

    private boolean isAdmin(User user) {
        return user != null && user.getRole() == User.Role.ADMIN;
    }

    private boolean isOrthodontist(User user) {
        return user != null && user.getRole() == User.Role.ORTHODONTIST;
    }
}
