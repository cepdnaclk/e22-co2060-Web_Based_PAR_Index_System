package com.parsystem.security;

import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class JwtAuthFilterTest {

    private final JwtUtil jwtUtil = mock(JwtUtil.class);
    private final UserDetailsService userDetailsService = mock(UserDetailsService.class);
    private final JwtAuthFilter filter = new JwtAuthFilter(jwtUtil, userDetailsService);

    @AfterEach
    void clearContext() {
        // SecurityContextHolder is thread-local static state; must not leak between tests.
        SecurityContextHolder.clearContext();
    }

    @Test
    void noAuthorizationHeader_passesThroughUnauthenticated() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(jwtUtil, userDetailsService);
        verify(chain).doFilter(request, response);
    }

    @Test
    void malformedAuthorizationHeader_passesThroughUnauthenticated() throws Exception {
        // Present but not "Bearer <token>" — e.g. Basic auth header.
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verifyNoInteractions(jwtUtil, userDetailsService);
        verify(chain).doFilter(request, response);
    }

    @Test
    void validToken_setsAuthentication() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer valid.token.here");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("doctor@example.com")
                .password("x")
                .roles("ORTHODONTIST")
                .build();

        when(jwtUtil.extractUsername("valid.token.here")).thenReturn("doctor@example.com");
        when(userDetailsService.loadUserByUsername("doctor@example.com")).thenReturn(userDetails);
        when(jwtUtil.isValid("valid.token.here", userDetails)).thenReturn(true);

        filter.doFilter(request, response, chain);

        assertNotNull(SecurityContextHolder.getContext().getAuthentication());
        assertEquals("doctor@example.com",
                SecurityContextHolder.getContext().getAuthentication().getName());
        verify(chain).doFilter(request, response);
    }

    @Test
    void invalidOrExpiredToken_doesNotAuthenticate() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer bad.token.here");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        UserDetails userDetails = User.withUsername("doctor@example.com")
                .password("x")
                .roles("ORTHODONTIST")
                .build();

        when(jwtUtil.extractUsername("bad.token.here")).thenReturn("doctor@example.com");
        when(userDetailsService.loadUserByUsername("doctor@example.com")).thenReturn(userDetails);
        when(jwtUtil.isValid("bad.token.here", userDetails)).thenReturn(false);

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }

    @Test
    void unknownUser_doesNotAuthenticate() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.addHeader("Authorization", "Bearer some.token.here");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        when(jwtUtil.extractUsername("some.token.here")).thenReturn("ghost@example.com");
        when(userDetailsService.loadUserByUsername("ghost@example.com"))
                .thenThrow(new UsernameNotFoundException("ghost@example.com"));

        filter.doFilter(request, response, chain);

        assertNull(SecurityContextHolder.getContext().getAuthentication());
        verify(chain).doFilter(request, response);
    }
}