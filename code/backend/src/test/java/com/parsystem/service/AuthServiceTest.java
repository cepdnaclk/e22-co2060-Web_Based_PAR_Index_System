package com.parsystem.service;

import com.parsystem.dto.AuthDto;
import com.parsystem.entity.User;
import com.parsystem.repository.UserRepository;
import com.parsystem.security.JwtUtil;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    @Mock private UserRepository userRepository;
    @Mock private PasswordEncoder passwordEncoder;
    @Mock private JwtUtil jwtUtil;
    @Mock private AuthenticationManager authenticationManager;
    @Mock private AuditService auditService;

    @InjectMocks private AuthService authService;

    private AuthDto.RegisterRequest registerRequest() {
        AuthDto.RegisterRequest req = new AuthDto.RegisterRequest();
        req.setName("Jane Doe");
        req.setEmail("jane@example.com");
        req.setPassword("password123");
        req.setRole(User.Role.ORTHODONTIST);
        return req;
    }

    @Test
    void registerRejectsDuplicateEmail() {
        AuthDto.RegisterRequest req = registerRequest();
        when(userRepository.existsByEmail("jane@example.com")).thenReturn(true);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.register(req));

        assertEquals("Email already registered.", ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsSelfServiceAdminRole() {
        AuthDto.RegisterRequest req = registerRequest();
        req.setRole(User.Role.ADMIN);
        when(userRepository.existsByEmail("jane@example.com")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.register(req));

        assertEquals("Administrator accounts cannot be created through self-registration.", ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerRejectsDentistRole() {
        AuthDto.RegisterRequest req = registerRequest();
        req.setRole(User.Role.DENTIST);
        when(userRepository.existsByEmail("jane@example.com")).thenReturn(false);

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.register(req));

        assertEquals("DENTIST role is no longer supported. Use ORTHODONTIST instead.", ex.getMessage());
        verify(userRepository, never()).save(any());
    }

    @Test
    void registerSucceedsAndReturnsToken() {
        AuthDto.RegisterRequest req = registerRequest();
        when(userRepository.existsByEmail("jane@example.com")).thenReturn(false);
        when(passwordEncoder.encode("password123")).thenReturn("hashed");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId(1L);
            return u;
        });
        when(jwtUtil.generateToken(any(User.class))).thenReturn("fake-jwt-token");

        AuthDto.AuthResponse response = authService.register(req);

        assertEquals("fake-jwt-token", response.getToken());
        assertEquals("jane@example.com", response.getEmail());
        assertEquals(User.Role.ORTHODONTIST, response.getRole());
        verify(auditService).log(any(User.class), eq("REGISTER"), eq("User"), eq(1L), isNull());
    }

    @Test
    void loginSucceedsAndReturnsToken() {
        AuthDto.LoginRequest req = new AuthDto.LoginRequest();
        req.setEmail("jane@example.com");
        req.setPassword("password123");

        User user = User.builder()
                .id(1L).name("Jane Doe").email("jane@example.com")
                .role(User.Role.ORTHODONTIST).build();

        when(userRepository.findByEmail("jane@example.com")).thenReturn(Optional.of(user));
        when(jwtUtil.generateToken(user)).thenReturn("fake-jwt-token");

        AuthDto.AuthResponse response = authService.login(req);

        assertEquals("fake-jwt-token", response.getToken());
        assertEquals(User.Role.ORTHODONTIST, response.getRole());
        verify(authenticationManager).authenticate(any());
        verify(auditService).log(eq(user), eq("LOGIN"), eq("User"), eq(1L), isNull());
    }

    @Test
    void loginThrowsIfUserVanishesAfterAuthentication() {
        AuthDto.LoginRequest req = new AuthDto.LoginRequest();
        req.setEmail("ghost@example.com");
        req.setPassword("password123");

        when(userRepository.findByEmail("ghost@example.com")).thenReturn(Optional.empty());

        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class,
                () -> authService.login(req));

        assertEquals("User not found.", ex.getMessage());
        verify(jwtUtil, never()).generateToken(any());
    }
}