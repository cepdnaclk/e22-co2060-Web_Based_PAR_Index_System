package com.parsystem.service;

import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.LandmarkPoint;
import com.parsystem.entity.Model3DFile;
import com.parsystem.entity.OrthoCase;
import com.parsystem.entity.User;
import com.parsystem.repository.LandmarkPointRepository;
import com.parsystem.repository.OrthoCaseRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Calls the Python ML landmark-prediction microservice (see /ml-service)
 * for a clinical case's uploaded 3D models, and stores the results as
 * ML_PREDICTED, unconfirmed LandmarkPoint rows.
 *
 * These predictions are ALWAYS unconfirmed on arrival. A clinician must
 * review and confirm (or overwrite via the normal /landmarks endpoint,
 * which is always MANUAL + confirmed) before GeometricPARService will
 * treat the case as ready for a clinically-trustworthy auto-calculate.
 *
 * If the ML service is disabled or unreachable, this fails loudly with a
 * clear message rather than silently producing no landmarks — clinicians
 * should never mistake "no prediction happened" for "no discrepancy found".
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MlPredictionService {

    private final RestTemplate restTemplate;
    private final OrthoCaseRepository caseRepo;
    private final LandmarkPointRepository landmarkRepo;
    private final AuditService auditService;

    @Value("${app.ml.service-url}")
    private String mlServiceUrl;

    @Value("${app.ml.enabled}")
    private boolean mlEnabled;

    @Value("${app.storage.base-dir}")
    private String baseDir;

    @Transactional
    public LandmarkDto.PredictLandmarksResponse predictForCase(Long caseId, User performer) {
        if (!mlEnabled) {
            throw new IllegalStateException(
                "The ML service is not enabled on this deployment. " +
                "Set ML_SERVICE_ENABLED=true and ML_SERVICE_URL once the ml-service " +
                "container is running. Landmark detection is geometric and needs no " +
                "training data, so it works as soon as the service is up.");
        }

        OrthoCase orthoCase = caseRepo.findById(caseId)
                .orElseThrow(() -> new IllegalArgumentException("Case not found: " + caseId));

        if (orthoCase.isFinalized()) {
            throw new IllegalStateException("Cannot predict landmarks for a finalised case.");
        }

        List<Model3DFile> files = orthoCase.getModelFiles();
        if (files.isEmpty()) {
            throw new IllegalStateException(
                "Case has no uploaded 3D models. Upload UPPER/LOWER/BUCCAL models first.");
        }

        int totalPredicted = 0;
        String modelVersion = null;
        double confidenceSum = 0;
        int confidenceCount = 0;

        for (Model3DFile file : files) {
            LandmarkDto.PredictResponse response = callMlService(file);
            if (response == null || response.getPoints() == null || response.getPoints().isEmpty()) {
                log.warn("ML service returned no points for case {} slot {}", caseId, file.getSlot());
                continue;
            }

            LandmarkPoint.Slot slot = LandmarkPoint.Slot.valueOf(file.getSlot().name());

            // Only replace previously ML_PREDICTED points for this slot —
            // never touch clinician-confirmed MANUAL points.
            landmarkRepo.findByOrthoCaseIdAndSlot(caseId, slot).stream()
                    .filter(p -> p.getSource() == LandmarkPoint.Source.ML_PREDICTED)
                    .forEach(p -> landmarkRepo.deleteById(p.getId()));

            List<LandmarkPoint> entities = response.getPoints().stream()
                    .map(pd -> LandmarkPoint.builder()
                            .orthoCase(orthoCase)
                            .slot(slot)
                            .pointName(pd.getName())
                            .x(pd.getX())
                            .y(pd.getY())
                            .z(pd.getZ())
                            .source(LandmarkPoint.Source.ML_PREDICTED)
                            .confirmed(false)
                            .build())
                    .collect(Collectors.toList());

            landmarkRepo.saveAll(entities);
            totalPredicted += entities.size();
            modelVersion = response.getModelVersion();
            confidenceSum += response.getConfidence();
            confidenceCount++;
        }

        double avgConfidence = confidenceCount > 0 ? confidenceSum / confidenceCount : 0;

        auditService.log(performer, "ML_PREDICT_LANDMARKS", "OrthoCase", caseId,
                "predicted=" + totalPredicted + "; modelVersion=" + modelVersion);

        // Optional cross-check: ML PAR-score estimate, from the trained
        // regressor (features.py + train_regressor.py). Best-effort —
        // absence (regressor not trained yet) is expected and non-fatal.
        Double mlParEstimate = null;
        String mlParModelVersion = null;
        try {
            LandmarkDto.PredictParResponse parResponse = callParEstimate(files);
            if (parResponse != null) {
                mlParEstimate = parResponse.getEstimatedPar();
                mlParModelVersion = parResponse.getModelVersion();
            }
        } catch (Exception e) {
            log.debug("ML PAR estimate unavailable for case {}: {}", caseId, e.getMessage());
        }

        return LandmarkDto.PredictLandmarksResponse.builder()
                .landmarksPredicted(totalPredicted)
                .modelVersion(modelVersion)
                .confidence(avgConfidence)
                .mlParEstimate(mlParEstimate)
                .mlParModelVersion(mlParModelVersion)
                .message("Predicted " + totalPredicted + " landmark(s) using automatic geometric detection. " +
                         "Review and confirm before finalising this case — " +
                         "predictions are not used in auto-calculate until confirmed.")
                .build();
    }

    private LandmarkDto.PredictResponse callMlService(Model3DFile file) {
        Path absolutePath = Paths.get(baseDir).resolve(file.getStoragePath()).normalize().toAbsolutePath();
        
        Map<String, String> body = Map.of(
                "slot", file.getSlot().name(),
                "meshPath", absolutePath.toString()
        );

        try {
            return restTemplate.postForObject(
                    mlServiceUrl + "/predict",
                    new HttpEntity<>(body),
                    LandmarkDto.PredictResponse.class);
        } catch (org.springframework.web.client.HttpStatusCodeException e) {
            // The ML service WAS reached — it returned an error (e.g. 404
            // mesh file not found on its side, 400 bad slot, 500 internal).
            // Surface the real reason instead of implying the service is down.
            log.error("ML service returned {} for {}: {}", e.getStatusCode(), absolutePath, e.getResponseBodyAsString());
            String detail = e.getResponseBodyAsString();
            throw new IllegalStateException(
                "ML service rejected the request for " + file.getSlot() + " (" + absolutePath + "): " +
                (detail != null && !detail.isBlank() ? detail : e.getStatusCode().toString()));
        } catch (RestClientException e) {
            // Genuine network-level failure — connection refused, DNS, timeout, etc.
            log.error("ML service unreachable for {}: {}", absolutePath, e.getMessage());
            throw new IllegalStateException(
                "Could not reach the ML landmark-prediction service at " + mlServiceUrl +
                ". Is the ml-service container running?", e);
        }
    }

    /** Optional PAR-score cross-check from the trained regressor. Returns null if unavailable (e.g. not yet trained). */
    private LandmarkDto.PredictParResponse callParEstimate(List<Model3DFile> files) {
        Model3DFile upper = files.stream().filter(f -> f.getSlot() == Model3DFile.Slot.UPPER).findFirst().orElse(null);
        Model3DFile lower = files.stream().filter(f -> f.getSlot() == Model3DFile.Slot.LOWER).findFirst().orElse(null);
        if (upper == null || lower == null) return null;

        Map<String, String> body = Map.of(
                "upperMeshPath", Paths.get(baseDir).resolve(upper.getStoragePath()).normalize().toAbsolutePath().toString(),
                "lowerMeshPath", Paths.get(baseDir).resolve(lower.getStoragePath()).normalize().toAbsolutePath().toString()
        );

        try {
            return restTemplate.postForObject(
                    mlServiceUrl + "/predict-par",
                    new HttpEntity<>(body),
                    LandmarkDto.PredictParResponse.class);
        } catch (RestClientException e) {
            // Expected when the regressor hasn't been trained yet (HTTP 503) — not an error.
            return null;
        }
    }
}
