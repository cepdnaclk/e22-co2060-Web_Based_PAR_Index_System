package com.parsystem.config;

import com.parsystem.entity.User;
import com.parsystem.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;

@Configuration
@RequiredArgsConstructor
public class AdminSeedConfig {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Bean
    @Transactional
    CommandLineRunner seedAdmins() {
        return args -> {
            ensureAdmin("e22014@eng.pdn.ac.lk", "Admin E22014");
            ensureAdmin("e22035@eng.pdn.ac.lk", "Admin E22035");
        };
    }

    private void ensureAdmin(String email, String name) {
        User admin = userRepository.findByEmail(email).orElseGet(User::new);
        boolean changed = false;

        if (admin.getId() == null) {
            changed = true;
        }

        if (!name.equals(admin.getName())) {
            admin.setName(name);
            changed = true;
        }

        if (!email.equalsIgnoreCase(admin.getEmail())) {
            admin.setEmail(email);
            changed = true;
        }

        if (admin.getRole() != User.Role.ADMIN) {
            admin.setRole(User.Role.ADMIN);
            changed = true;
        }

        if (!admin.isActive()) {
            admin.setActive(true);
            changed = true;
        }

        // Seeded admins should always have a known login so startup repairs
        // stale manual DB edits or old roles without requiring a separate reset.
        String defaultAdminPasswordHash = passwordEncoder.encode("admin");
        if (admin.getPasswordHash() == null || !passwordEncoder.matches("admin", admin.getPasswordHash())) {
            admin.setPasswordHash(defaultAdminPasswordHash);
            changed = true;
        }

        if (changed) {
            userRepository.save(admin);
        }
    }
}
