package com.parsystem.exception;

import jakarta.persistence.OptimisticLockException;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.orm.ObjectOptimisticLockingFailureException;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MaxUploadSizeExceededException;

import java.util.HashMap;
import java.util.Map;

/**
 * REQUIREMENT 7: Handle OptimisticLockException with HTTP 409.
 * Two orthodontists opening the same case simultaneously must not silently overwrite each other.
 *
 * BUG FIX: IllegalStateException was previously ALWAYS mapped to HTTP 409, which
 * collided with the real optimistic-lock 409 handling on the frontend. The frontend's
 * finalize() treats any 409 as "another user edited this case" and silently retries —
 * so genuine business-rule failures (case already finalised, no PAR score, score is 0)
 * were being masked by a blind retry instead of shown to the user immediately.
 *
 * Fix: split IllegalStateException into two cases —
 *   - "already finalised" / "not currently finalised" → still 409 (it IS a state conflict)
 *   - everything else (missing/zero PAR score, validation-style business rules) → 422
 * Only true concurrency conflicts (OptimisticLockException) and "already finalised"
 * style state conflicts should trigger the frontend's silent-retry path.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> handleBadRequest(IllegalArgumentException ex) {
        return error(HttpStatus.BAD_REQUEST, ex.getMessage());
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> handleConflict(IllegalStateException ex) {
        String msg = ex.getMessage() == null ? "" : ex.getMessage();

        // Genuine state/concurrency conflicts — keep as 409 so the frontend's
        // "reload and retry once" logic still applies (e.g. two tabs finalising
        // the same case, or unfinalize() called on a case that isn't finalised).
        boolean isStateConflict =
                msg.contains("already finalised") ||
                msg.contains("not currently finalised");

        if (isStateConflict) {
            return error(HttpStatus.CONFLICT, msg);
        }

        // Business-rule failures (missing PAR score, score is 0, etc.) are NOT
        // conflicts — retrying won't fix them. Use 422 so the frontend shows the
        // real message immediately instead of silently reloading and retrying.
        return error(HttpStatus.UNPROCESSABLE_ENTITY, msg);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> handleBadCredentials(BadCredentialsException ex) {
        return error(HttpStatus.UNAUTHORIZED, "Invalid email or password.");
    }

    @ExceptionHandler(AccessDeniedException.class)
    public ResponseEntity<Map<String, Object>> handleAccessDenied(AccessDeniedException ex) {
        return error(HttpStatus.FORBIDDEN, "You do not have permission to perform this action.");
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> handleMaxUpload(MaxUploadSizeExceededException ex) {
        return error(HttpStatus.PAYLOAD_TOO_LARGE, "File too large. Maximum allowed size is 50 MB.");
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        Map<String, String> fieldErrors = new HashMap<>();
        for (FieldError fe : ex.getBindingResult().getFieldErrors()) {
            fieldErrors.put(fe.getField(), fe.getDefaultMessage());
        }
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("message", "Validation failed");
        body.put("errors", fieldErrors);
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    public ResponseEntity<Map<String, Object>> handleTypeMismatch(MethodArgumentTypeMismatchException ex) {
        return error(HttpStatus.BAD_REQUEST, "Invalid value for parameter '" + ex.getName() + "'.");
    }

    /**
     * REQUIREMENT 7: Optimistic locking exception — two users edited the same case concurrently.
     * Returns HTTP 409 Conflict with a clear message to the user.
     * CaseDetail.jsx: if API returns 409, show "Case updated by another user — refreshing..." and reload.
     */
    @ExceptionHandler({OptimisticLockException.class, ObjectOptimisticLockingFailureException.class})
    public ResponseEntity<Map<String, Object>> handleOptimisticLock(Exception ex) {
        log.warn("Optimistic lock conflict: {}", ex.getMessage());
        return error(HttpStatus.CONFLICT,
                "This case was modified by another user. Please refresh and re-apply your changes.");
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleGeneral(Exception ex) {
        log.error("Unhandled exception", ex);
        return error(HttpStatus.INTERNAL_SERVER_ERROR, "An unexpected error occurred.");
    }

    private ResponseEntity<Map<String, Object>> error(HttpStatus status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("success", false);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }
}