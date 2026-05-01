package com.parsystem.service;

import com.parsystem.dto.AuthDto;
import com.parsystem.entity.PasswordResetToken;
import com.parsystem.entity.User;
import com.parsystem.repository.PasswordResetTokenRepository;
import com.parsystem.repository.UserRepository;
import com.parsystem.security.JwtUtil;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtil jwtUtil;
    private final AuthenticationManager authenticationManager;
    private final AuditService auditService;
    private final PasswordResetTokenRepository tokenRepository;

    public AuthDto.AuthResponse register(AuthDto.RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new IllegalArgumentException("Email already registered.");
        }

        // Admin accounts are pre-seeded — public registration cannot grant ADMIN role
        if (request.getRole() == User.Role.ADMIN) {
            throw new IllegalArgumentException("Administrator accounts cannot be created through self-registration.");
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

    @Transactional
    public void forgotPassword(AuthDto.ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("User not found with email: " + request.getEmail()));

        // Create token
        String tokenString = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token(tokenString)
                .user(user)
                .expiryDate(LocalDateTime.now().plusMinutes(15))
                .build();
        tokenRepository.save(resetToken);

        // Simulate Email
        System.out.println("==========================================================");
        System.out.println("[SIMULATED EMAIL] Password Reset Requested");
        System.out.println("User: " + user.getEmail());
        System.out.println("Reset Link: http://localhost:5173/reset-password?token=" + tokenString);
        System.out.println("==========================================================");
        
        auditService.log(user, "FORGOT_PASSWORD", "User", user.getId(), null);
    }

    @Transactional
    public void resetPassword(AuthDto.ResetPasswordRequest request) {
        PasswordResetToken resetToken = tokenRepository.findByToken(request.getToken())
                .orElseThrow(() -> new IllegalArgumentException("Invalid password reset token."));

        if (resetToken.isExpired()) {
            tokenRepository.delete(resetToken);
            throw new IllegalArgumentException("Password reset token has expired.");
        }

        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);

        // Invalidate token
        tokenRepository.delete(resetToken);

        auditService.log(user, "RESET_PASSWORD", "User", user.getId(), null);
    }
}
