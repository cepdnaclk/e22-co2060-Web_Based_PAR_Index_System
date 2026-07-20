package com.parsystem.repository;

import com.parsystem.entity.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDateTime;

public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    Page<AuditLog> findAllByOrderByPerformedAtDesc(Pageable pageable);

    Page<AuditLog> findByPerformedAtBetweenOrderByPerformedAtDesc(
            LocalDateTime from,
            LocalDateTime to,
            Pageable pageable);
}