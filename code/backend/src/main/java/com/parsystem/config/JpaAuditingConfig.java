package com.parsystem.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

/**
 * Moved out of ParSystemApplication so that @WebMvcTest slices (which always
 * load the @SpringBootApplication class as their context root, and cannot
 * exclude annotations declared directly on it) don't try to build a JPA
 * auditing handler against an empty entity metamodel. No behavior change —
 * @EnableJpaAuditing still applies to the full application context exactly
 * as before; it's just declared on a separate @Configuration bean now,
 * which slice tests correctly exclude.
 */
@Configuration
@EnableJpaAuditing
public class JpaAuditingConfig {
}