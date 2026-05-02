package com.parsystem.controller;

import com.parsystem.dto.LandmarkDto;
import com.parsystem.entity.User;
import com.parsystem.service.GeometricPARService;
import com.parsystem.service.LandmarkService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST API for 3D landmark management and automatic PAR scoring.
 *
 * All endpoints are nested under /api/v1/cases/{id} to keep them
 * consistent with the existing CaseController routes.
 *
 * Endpoints:
 *   POST   /api/v1/cases/{id}/landmarks         — save points for one slot
 *   GET    /api/v1/cases/{id}/landmarks         — retrieve all stored landmarks
 *   DELETE /api/v1/cases/{id}/landmarks         — clear all landmarks
 *   POST   /api/v1/cases/{id}/auto-calculate    — run geometric PAR & save result
 */
@RestController
@RequestMapping("/api/v1/cases/{id}")
@RequiredArgsConstructor
public class LandmarkController {

    private final LandmarkService    landmarkService;
    private final GeometricPARService geometricPARService;

    // ── POST /landmarks ──────────────────────────────────────────────────

    /**
     * Submit (or replace) a batch of 3D landmark points for one arch slot.
     *
     * Request body example:
     * {
     *   "slot": "UPPER",
     *   "points": [
     *     { "name": "R3M",   "x": 12.5, "y": -3.2, "z": 4.0 },
     *     { "name": "R2D",   "x": 10.1, "y": -2.8, "z": 3.9 },
     *     ...
     *   ]
     * }
     *
     * Re-submitting the same slot replaces its previous points atomically.
     */
    @PostMapping("/landmarks")
    public ResponseEntity<List<LandmarkDto.LandmarkResponse>> submitLandmarks(
            @PathVariable Long id,
            @Valid @RequestBody LandmarkDto.SubmitRequest request,
            @AuthenticationPrincipal User user) {

        List<LandmarkDto.LandmarkResponse> saved =
                landmarkService.submitPoints(id, request, user);
        return ResponseEntity.ok(saved);
    }

    // ── GET /landmarks ───────────────────────────────────────────────────

    /**
     * Retrieve all currently stored landmarks for a case.
     * Returns an empty list if none have been placed yet.
     */
    @GetMapping("/landmarks")
    public ResponseEntity<List<LandmarkDto.LandmarkResponse>> getLandmarks(
            @PathVariable Long id) {

        return ResponseEntity.ok(landmarkService.getPoints(id));
    }

    // ── DELETE /landmarks ────────────────────────────────────────────────

    /**
     * Delete all landmark points for a case.
     * Useful when the clinician wants to restart point placement.
     */
    @DeleteMapping("/landmarks")
    public ResponseEntity<Map<String, String>> clearLandmarks(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        landmarkService.clearPoints(id, user);
        return ResponseEntity.ok(Map.of("message", "All landmarks cleared."));
    }

    // ── POST /auto-calculate ─────────────────────────────────────────────

    /**
     * Run the full geometric PAR calculation from stored landmark points.
     *
     * 1. Reads all LandmarkPoint rows for this case from the database.
     * 2. Builds per-arch point maps (UPPER / LOWER / BUCCAL).
     * 3. Applies every British PAR formula geometrically.
     * 4. Saves result to par_scores (same row as manual entry — upsert).
     * 5. Returns the detailed breakdown.
     *
     * The case must have landmarks submitted before calling this endpoint.
     * The case must not be finalised.
     */
    @PostMapping("/auto-calculate")
    public ResponseEntity<LandmarkDto.AutoScoreResponse> autoCalculate(
            @PathVariable Long id,
            @AuthenticationPrincipal User user) {

        LandmarkDto.AutoScoreResponse result =
                geometricPARService.calculateAndSave(id, user);
        return ResponseEntity.ok(result);
    }
}
