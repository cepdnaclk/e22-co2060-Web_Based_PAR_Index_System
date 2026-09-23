package com.parsystem.security;

import com.parsystem.entity.User;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Verifies the real login-to-authenticated-request chain end to end:
 * JwtUtil generates a token -> the same JwtUtil + JwtAuthFilter (both real,
 * neither mocked) accept it on a later request.
 *
 * AuthServiceTest mocks JwtUtil; JwtAuthFilterTest mocks JwtUtil too — so
 * every existing test proves each class is internally correct, but nothing
 * proves the two actually agree on token format, claims, or signing key.
 * This test closes that gap.
 */
class JwtRoundTripIntegrationTest {

    // Valid base64 encoding of exactly 32 raw bytes (0x00..0x1F) — satisfies
    // JwtUtil.key()'s "must decode to at least 32 bytes" check exactly.
    private static final String TEST_SECRET = "AAECAwQFBgcICQoLDA0ODxAREhMUFRYXGBkaGxwdHh8=";

    private JwtUtil jwtUtil;
    private UserDetailsService userDetailsService;
    private JwtAuthFilter filter;

    @BeforeEach
    void setUp() {
        jwtUtil = new JwtUtil();
        ReflectionTestUtils.setField(jwtUtil, "secret", TEST_SECRET);
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", 60_000L); // 1 minute
        ReflectionTestUtils.invokeMethod(jwtUtil, "validateSecret");

        userDetailsService = mock(UserDetailsService.class);
        filter = new JwtAuthFilter(jwtUtil, userDetailsService);
    }

    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void tokenGeneratedByRealJwtUtilIsAcceptedByRealJwtAuthFilter() throws Exception {
        User orthodontist = User.builder()
                .id(1L).email("doctor@example.com")
                .role(User.Role.ORTHODONTIST).build();

        // Real generateToken — same JwtUtil instance the filter will use to validate.
        String token = jwtUtil.generateToken(orthodontist);
        assertNotNull(token);

        when(userDetailsService.loadUserByUsername("doctor@example.com")).thenReturn(orthodontist);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + token);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("doctor@example.com",
                SecurityContextHolder.getContext().getAuthentication().getName());
        assertTrue(SecurityContextHolder.getContext().getAuthentication().getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_ORTHODONTIST")));
        verify(chain).doFilter(request, response);
    }

    @Test
    void expiredTokenFromRealJwtUtilIsRejectedByRealJwtAuthFilter() throws Exception {
        User orthodontist = User.builder()
                .id(1L).email("doctor@example.com")
                .role(User.Role.ORTHODONTIST).build();

        // Force an already-expired token by setting expiration to a negative offset.
        ReflectionTestUtils.setField(jwtUtil, "expirationMs", -1_000L);
        String expiredToken = jwtUtil.generateToken(orthodontist);

        when(userDetailsService.loadUserByUsername("doctor@example.com")).thenReturn(orthodontist);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + expiredToken);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }

    @Test
    void tokenSignedWithDifferentSecretIsRejected() throws Exception {
        // Simulates a forged/tampered token signed with a different key —
        // directly relevant to the confirmed JWT-fallback-secret defect:
        // this proves that IF two different secrets are ever in play,
        // a token from one is correctly rejected by JwtUtil configured
        // with the other.
        JwtUtil attackerJwtUtil = new JwtUtil();
        String differentSecret = "HB8fICEiIyQlJicoKSorLC0uLzAxMjM0NTY3ODk6Ozw9Pj8=";
        ReflectionTestUtils.setField(attackerJwtUtil, "secret", differentSecret);
        ReflectionTestUtils.setField(attackerJwtUtil, "expirationMs", 60_000L);
        ReflectionTestUtils.invokeMethod(attackerJwtUtil, "validateSecret");

        User orthodontist = User.builder()
                .id(1L).email("doctor@example.com")
                .role(User.Role.ORTHODONTIST).build();

        String forgedToken = attackerJwtUtil.generateToken(orthodontist);

        when(userDetailsService.loadUserByUsername("doctor@example.com")).thenReturn(orthodontist);

        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer " + forgedToken);
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }
}