package com.parsystem.service;

import com.parsystem.entity.AuditLog;
import com.parsystem.entity.User;
import com.parsystem.repository.AuditLogRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    public void log(User performer, String action, String entityType, Long entityId, String detail) {
        AuditLog log = AuditLog.builder()
                .performedBy(performer)
                .action(action)
                .entityType(entityType)
                .entityId(entityId)
                .detail(detail)
                .build();
        auditLogRepository.save(log);
    }
}