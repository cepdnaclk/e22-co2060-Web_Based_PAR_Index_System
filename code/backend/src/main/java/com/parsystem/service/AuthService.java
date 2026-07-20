package com.parsystem.service;

import com.parsystem.dto.AuthDto;
import com.parsystem.entity.User;
import com.parsystem.repository.UserRepository;
import com.parsystem.security.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final AuditService auditService;

    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered.");
        }

        // Admin accounts are pre-seeded — public registration cannot grant ADMIN role
        if (request.getRole() == User.Role.ADMIN) {
            throw new IllegalArgumentException("Administrator accounts cannot be created through self-registration.");
        }

        // BUG FIX: DENTIST was removed from the system (see UserController's
        // changeRole(), which explicitly rejects it: "DENTIST role is no
        // longer supported. Use ORTHODONTIST instead."), but registration
        // never enforced the same rule. The frontend's Register.jsx doesn't
        // offer DENTIST as an option, but the API itself accepted it, and a
        // DENTIST account has no reachable endpoints anywhere in
        // SecurityConfig — it's a permanently locked-out account with no
        // self-service or admin path to fix it short of editing the database.
        if (request.getRole() == User.Role.DENTIST) {
            throw new IllegalArgumentException(
                    "DENTIST role is no longer supported. Use ORTHODONTIST instead.");
        }

        User user = User.builder()
                .name(request.getName())
                .email(request.getEmail())
                .passwordHash(passwordEncoder.encode(request.getPassword()))
                .role(request.getRole())
                .isActive(true)
                .build();

        userRepository.save(user);
        auditService.log(user, "REGISTER", "User", user.getId(), null);

        String token = jwtUtil.generateToken(user);
        return AuthDto.AuthResponse.builder()
                .token(token)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }

    public AuthDto.AuthResponse login(AuthDto.LoginRequest request) {
        authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword()));

        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found."));

        auditService.log(user, "LOGIN", "User", user.getId(), null);

        String token = jwtUtil.generateToken(user);
        return AuthDto.AuthResponse.builder()
                .token(token)
                .name(user.getName())
                .email(user.getEmail())
                .role(user.getRole())
                .build();
    }
}