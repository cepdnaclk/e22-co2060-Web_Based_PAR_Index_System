package com.parsystem.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestTemplate;

import java.io.File;
import java.util.Optional;

/**
 * Calls the FastAPI ML service from Spring Boot.
 *
 * REQUIREMENT 14 — MLClientService:
 *   - Validates all 3 file paths exist on disk before calling
 *   - Validates returned score is 0–100
 *   - 30s connect / 60s read timeouts (set in RestTemplateConfig)
 *   - On any exception: log warning, return Optional.empty() — never throw
 *   - Adds X-ML-Service-Key header to every request (REQUIREMENT 9)
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class MLClientService {

    // BUG FIX: application.yml defines these under app.ml.service-url /
    // app.ml.secret (see MlPredictionService, which already used the right
    // keys). "ml.service.url"/"ml.service.secret" don't exist anywhere in
    // the config, so these were silently falling back to their defaults —
    // localhost:8000 and an empty secret — meaning this service could never
    // actually reach par-ml in Docker, and any request that did connect
    // would be rejected by the FastAPI service-key middleware anyway.
    @Value("${app.ml.service-url:http://localhost:8000}")
    private String mlServiceUrl;

    // REQUIREMENT 9: Service key for securing FastAPI
    @Value("${app.ml.secret:}")
    private String mlServiceSecret;

    @Qualifier("mlRestTemplate")
    private final RestTemplate restTemplate;
    private final ObjectMapper objectMapper;

    /**
     * Send three STL file paths to ML service and get predicted total PAR.
     *
     * REQUIREMENT 14:
     *  - Validate all 3 file paths exist on disk — return empty if any missing
     *  - Validate returned score is 0–100 — log and return empty if outside range
     *  - On any exception: log warning, return Optional.empty()
     */
    public Optional<Float> predictPAR(
            String upperFilePath,
            String lowerFilePath,
            String buccalFilePath
    ) {
        // REQUIREMENT 14: Validate all 3 file paths exist before calling
        File upperFile  = new File(upperFilePath);
        File lowerFile  = new File(lowerFilePath);
        File buccalFile = new File(buccalFilePath);

        if (!upperFile.exists() || !upperFile.isFile()) {
            log.warn("ML predict skipped — UPPER file not found: {}", upperFilePath);
            return Optional.empty();
        }
        if (!lowerFile.exists() || !lowerFile.isFile()) {
            log.warn("ML predict skipped — LOWER file not found: {}", lowerFilePath);
            return Optional.empty();
        }
        if (!buccalFile.exists() || !buccalFile.isFile()) {
            log.warn("ML predict skipped — BUCCAL file not found: {}", buccalFilePath);
            return Optional.empty();
        }

        try {
            HttpHeaders headers = new HttpHeaders();
            // BUG FIX: do NOT call headers.setContentType(MediaType.MULTIPART_FORM_DATA)
            // here. MULTIPART_FORM_DATA is a fixed MediaType constant with no
            // `boundary` parameter. Setting it explicitly forces RestTemplate to use
            // this exact header verbatim, so the multipart writer can no longer add
            // a boundary, and FastAPI's multipart parser cannot split the body into
            // parts. Leaving Content-Type unset lets FormHttpMessageConverter pick
            // multipart/form-data AND generate the boundary parameter automatically.
            // REQUIREMENT 9: Add service key header to every request
            if (mlServiceSecret != null && !mlServiceSecret.isBlank()) {
                headers.set("X-ML-Service-Key", mlServiceSecret);
            }

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            body.add("upperFile",  new FileSystemResource(upperFile));
            body.add("lowerFile",  new FileSystemResource(lowerFile));
            body.add("buccalFile", new FileSystemResource(buccalFile));

            HttpEntity<MultiValueMap<String, Object>> request = new HttpEntity<>(body, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    mlServiceUrl + "/predict",
                    request,
                    String.class
            );

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                JsonNode json = objectMapper.readTree(response.getBody());
                double totalPAR = json.path("totalPAR").asDouble(-1);

                // REQUIREMENT 14: Validate returned score is 0–100
                if (totalPAR < 0 || totalPAR > 100) {
                    log.warn("ML service returned out-of-range score: {}. Ignoring.", totalPAR);
                    return Optional.empty();
                }
                return Optional.of((float) totalPAR);
            }

        } catch (RestClientException e) {
            // ML service unavailable — log and continue without ML score
            log.warn("ML service unavailable at {}: {}", mlServiceUrl, e.getMessage());
        } catch (Exception e) {
            log.warn("ML prediction failed: {}", e.getMessage());
        }

        return Optional.empty();
    }

    /**
     * Check if ML service is healthy.
     * Used by admin dashboard to show ML service status.
     */
    public boolean isHealthy() {
        try {
            HttpHeaders headers = new HttpHeaders();
            if (mlServiceSecret != null && !mlServiceSecret.isBlank()) {
                headers.set("X-ML-Service-Key", mlServiceSecret);
            }
            // BUG FIX: the headers built above were never attached to the request —
            // getForEntity() was called with no HttpEntity, so the service key never
            // left this method. Use exchange() with the headers wrapped in an entity.
            HttpEntity<Void> req = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    mlServiceUrl + "/health", HttpMethod.GET, req, String.class
            );
            return resp.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Get current ML model status (version, accuracy, etc.)
     */
    public Optional<JsonNode> getMLStatus() {
        try {
            HttpHeaders headers = new HttpHeaders();
            if (mlServiceSecret != null && !mlServiceSecret.isBlank()) {
                headers.set("X-ML-Service-Key", mlServiceSecret);
            }
            HttpEntity<Void> req = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    mlServiceUrl + "/status", HttpMethod.GET, req, String.class
            );
            if (resp.getStatusCode() == HttpStatus.OK && resp.getBody() != null) {
                return Optional.of(objectMapper.readTree(resp.getBody()));
            }
        } catch (Exception e) {
            log.warn("Could not fetch ML status: {}", e.getMessage());
        }
        return Optional.empty();
    }

    /**
     * REQUIREMENT 10: Trigger model rollback via FastAPI.
     */
    public boolean rollback(String version) {
        try {
            HttpHeaders headers = new HttpHeaders();
            if (mlServiceSecret != null && !mlServiceSecret.isBlank()) {
                headers.set("X-ML-Service-Key", mlServiceSecret);
            }
            HttpEntity<Void> req = new HttpEntity<>(headers);
            ResponseEntity<String> resp = restTemplate.exchange(
                    mlServiceUrl + "/rollback/" + version, HttpMethod.POST, req, String.class
            );
            return resp.getStatusCode() == HttpStatus.OK;
        } catch (Exception e) {
            log.warn("ML rollback failed for version {}: {}", version, e.getMessage());
            return false;
        }
    }
}