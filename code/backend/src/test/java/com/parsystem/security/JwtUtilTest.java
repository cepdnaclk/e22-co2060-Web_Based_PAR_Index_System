package com.parsystem.security;

import org.junit.jupiter.api.Test;
import org.springframework.security.core.userdetails.User;
import org.springframework.test.util.ReflectionTestUtils;

import java.nio.charset.StandardCharsets;
import java.util.Base64;

import static org.junit.jupiter.api.Assertions.*;

class JwtUtilTest {

    @Test
    void generateAndValidateToken() {
        JwtUtil jwtUtil = new JwtUtil();
        String secret = Base64.getEncoder().encodeToString("01234567890123456789012345678901".getBytes(StandardCharsets.UTF_8));
        ReflectionTestUtils.setField(jwtUtil, "secret", secret);
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 60_000L);
        jwtUtil.validateSecret();

        var userDetails = User.withUsername("doctor@example.com")
                .password("x")
                .roles("ORTHODONTIST")
                .build();

        String token = jwtUtil.generateToken(userDetails);
        assertTrue(jwtUtil.isValid(token, userDetails));
        assertEquals("doctor@example.com", jwtUtil.extractUsername(token));
    }
}
