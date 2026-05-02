package com.parsystem.controller;

import com.parsystem.entity.AuditLog;
import com.parsystem.entity.User;
import com.parsystem.repository.AuditLogRepository;
import com.parsystem.service.UserService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1")
@RequiredArgsConstructor
public class UserController {

    private final UserService userService;
    private final AuditLogRepository auditLogRepository;

    /** Current authenticated user profile */
    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMe(@AuthenticationPrincipal User user) {
        return ResponseEntity.ok(Map.of(
                "id",    user.getId(),
                "name",  user.getName(),
                "email", user.getEmail(),
                "role",  user.getRole()
        ));
    }

    /** Admin: list all users */
    @GetMapping("/admin/users")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<User>> getAllUsers() {
        return ResponseEntity.ok(userService.getAll());
    }

    /** Admin: activate or deactivate a user */
    @PatchMapping("/admin/users/{id}/active")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> setActive(@PathVariable Long id,
                                          @RequestParam boolean active) {
        userService.setActive(id, active);
        return ResponseEntity.noContent().build();
    }

    /**
     * Admin: change a user's role.
     * Valid roles are ADMIN, ORTHODONTIST, UNDERGRADUATE.
     * DENTIST role has been removed from the system.
     */
    @PatchMapping("/admin/users/{id}/role")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<Void> changeRole(@PathVariable Long id,
                                           @RequestParam User.Role role) {
        if (role == User.Role.DENTIST) {
            throw new IllegalArgumentException(
                    "DENTIST role is no longer supported. Use ORTHODONTIST instead.");
        }
        userService.changeRole(id, role);
        return ResponseEntity.noContent().build();
    }

    /** Admin: paginated audit log */
    @GetMapping("/admin/audit")
    @PreAuthorize("hasRole('ADMIN')")
    public ResponseEntity<List<AuditLog>> getAuditLog(
            @RequestParam(defaultValue = "0")  int page,
            @RequestParam(defaultValue = "50") int size) {
        var pageable = PageRequest.of(page, size, Sort.by("performedAt").descending());
        return ResponseEntity.ok(auditLogRepository.findAllByOrderByPerformedAtDesc(pageable).getContent());
    }
}
