package com.parsystem.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.parsystem.entity.MLMetrics;
import com.parsystem.entity.TrainingSet;
import com.parsystem.entity.User;
import com.parsystem.repository.MLMetricsRepository;
import com.parsystem.repository.TrainingSetRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * REQUIREMENT 14 — MLService:
 *   - Replace simulateTrainingResult() with real async HTTP POST to FastAPI /train
 *   - Use single-thread ExecutorService — never a thread pool
 *   - Before submitting: check if any MLMetrics record has status=TRAINING — return 409 if yes
 *   - On completion: update MLMetrics with real MAE, loss, val_loss, status=COMPLETED
 *   - On failure: set status=FAILED, log error with detail
 *
 * REQUIREMENT 11: Audit log ML training events
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MLService {

    private final MLMetricsRepository   mlMetricsRepository;
    private final TrainingSetRepository trainingSetRepository;
    private final AuditService          auditService;
    @Qualifier("mlRestTemplate")
    private final RestTemplate          restTemplate;
    private final ObjectMapper          objectMapper;

    // BUG FIX: same wrong-key issue as MLClientService — application.yml
    // has no "ml.service.url"/"ml.service.secret" keys, only app.ml.*, so
    // training requests were silently going to localhost:8000 with no
    // secret instead of the real par-ml container.
    @Value("${app.ml.service-url:http://localhost:8000}")
    private String mlServiceUrl;

    @Value("${app.ml.secret:}")
    private String mlServiceSecret;

    // REQUIREMENT 14: Single-thread executor — never a thread pool
    private final ExecutorService trainingExecutor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "ml-training-thread");
        t.setDaemon(true);
        return t;
    });

    // ── Response records ──────────────────────────────────────────────

    public record MLStatus(
            String currentStatus,
            String latestVersion,
            int totalRuns,
            int approvedDatasets,
            double bestAccuracy,
            MLMetrics latestRun
    ) {}

    // ── Status overview ───────────────────────────────────────────────

    public MLStatus getStatus() {
        List<MLMetrics> allRuns = mlMetricsRepository.findAllByOrderByCreatedAtDesc();
        MLMetrics latest        = allRuns.isEmpty() ? null : allRuns.get(0);

        double bestAccuracy = allRuns.stream()
                .mapToDouble(MLMetrics::getAccuracy)
                .max()
                .orElse(0.0);

        int approvedDatasets = trainingSetRepository
                .findByStatus(TrainingSet.Status.APPROVED).size();

        String status = latest != null ? latest.getStatus() : "NO_RUNS";

        return new MLStatus(
                status,
                latest != null ? latest.getModelVersion() : "N/A",
                allRuns.size(),
                approvedDatasets,
                Math.round(bestAccuracy * 1000.0) / 10.0,
                latest
        );
    }

    // ── Metrics for charts ────────────────────────────────────────────

    public List<MLMetrics> getAllMetrics() {
        return mlMetricsRepository.findCompletedRuns();
    }

    public List<MLMetrics> getMetricsByVersion(String version) {
        return mlMetricsRepository.findByModelVersionOrderByEpochNumberAsc(version);
    }

    public List<MLMetrics> getMyRuns(User user) {
        return mlMetricsRepository.findBySubmittedByIdOrderByCreatedAtDesc(user.getId());
    }

    // ── Start a training run ─────────────────────────────────────────

    /**
     * REQUIREMENT 14: Start real async training via FastAPI.
     * Returns HTTP 409 (via IllegalStateException) if training already in progress.
     *
     * REQUIREMENT 11: Audit ML_TRAINING_STARTED / COMPLETED / FAILED
     */
    public MLMetrics startTraining(String modelVersion, int epochs, User user) {
        // Check there's approved data to train on
        int approved = trainingSetRepository
                .findByStatus(TrainingSet.Status.APPROVED).size();

        if (approved == 0) {
            throw new IllegalStateException(
                    "No approved training datasets found. Submit and get datasets approved first.");
        }

        // REQUIREMENT 14: Check for existing in-progress training — return 409
        if (mlMetricsRepository.existsByStatusTraining()) {
            throw new IllegalStateException(
                    "A training run is already in progress. Please wait for it to complete.");
        }

        MLMetrics run = MLMetrics.builder()
                .modelVersion(modelVersion)
                .epochNumber(epochs)
                .datasetSize(approved)
                .accuracy(0.0)
                .valAccuracy(0.0)
                .loss(0.0)
                .valLoss(0.0)
                .status("TRAINING")
                .submittedBy(user)
                .build();

        MLMetrics saved = mlMetricsRepository.save(run);
        final Long runId = saved.getId();

        // REQUIREMENT 11: Audit log training start
        auditService.log(user, "ML_TRAINING_STARTED", "MLMetrics", runId,
                "version=" + modelVersion + " epochs=" + epochs + " datasetSize=" + approved);

        // REQUIREMENT 14: Fire-and-forget async real HTTP POST to FastAPI /train
        trainingExecutor.submit(() -> runTrainingAsync(runId, modelVersion, epochs, approved, user));

        return mlMetricsRepository.findById(runId).orElse(saved);
    }

    /**
     * REQUIREMENT 14: Real async HTTP POST to FastAPI /train.
     * Updates MLMetrics on completion or failure.
     */
    private void runTrainingAsync(Long runId, String modelVersion, int epochs, int datasetSize, User user) {
        try {
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (mlServiceSecret != null && !mlServiceSecret.isBlank()) {
                headers.set("X-ML-Service-Key", mlServiceSecret);
            }

            Map<String, Object> requestBody = new HashMap<>();
            requestBody.put("model_version", modelVersion);
            requestBody.put("epochs", epochs);
            requestBody.put("dataset_size", datasetSize);

            HttpEntity<Map<String, Object>> request = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    mlServiceUrl + "/train",
                    request,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode json = objectMapper.readTree(response.getBody());

                double finalMae  = json.path("mae").asDouble(0.0);
                double finalLoss = json.path("loss").asDouble(0.0);
                double valLoss   = json.path("val_loss").asDouble(0.0);
                // Accuracy approximated from MAE: lower MAE = higher accuracy
                double accuracy  = Math.max(0.0, 1.0 - finalMae / 50.0);
                double valAcc    = Math.max(0.0, 1.0 - valLoss / 50.0);

                mlMetricsRepository.findById(runId).ifPresent(run -> {
                    run.setAccuracy(accuracy);
                    run.setValAccuracy(valAcc);
                    run.setLoss(finalLoss);
                    run.setValLoss(valLoss);
                    run.setStatus("COMPLETED");
                    run.setTrainedAt(LocalDateTime.now());
                    mlMetricsRepository.save(run);
                });

                // REQUIREMENT 11
                auditService.log(user, "ML_TRAINING_COMPLETED", "MLMetrics", runId,
                        "version=" + modelVersion + " finalMAE=" + finalMae + " finalLoss=" + finalLoss);

                log.info("ML training completed: version={} mae={} loss={}", modelVersion, finalMae, finalLoss);
            } else {
                markTrainingFailed(runId, modelVersion, user,
                        "FastAPI returned status: " + response.getStatusCodeValue());
            }

        } catch (Exception e) {
            markTrainingFailed(runId, modelVersion, user, e.getMessage());
        }
    }

    private void markTrainingFailed(Long runId, String modelVersion, User user, String reason) {
        log.error("ML training failed for version {}: {}", modelVersion, reason);
        mlMetricsRepository.findById(runId).ifPresent(run -> {
            run.setStatus("FAILED");
            mlMetricsRepository.save(run);
        });
        // REQUIREMENT 11
        auditService.log(user, "ML_TRAINING_FAILED", "MLMetrics", runId,
                "version=" + modelVersion + " reason=" + reason);
    }
}
