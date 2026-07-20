package com.parsystem;

import jakarta.annotation.PostConstruct;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;
import org.springframework.scheduling.annotation.EnableAsync;

@SpringBootApplication
@EnableJpaAuditing
@EnableAsync
public class ParSystemApplication {

    public static void main(String[] args) {
        SpringApplication.run(ParSystemApplication.class, args);
    }

    @PostConstruct
    public void validateEnv() {
        // DB_PASSWORD is optional in dev — yaml default is used if not set
        // JWT_SECRET is optional in dev — yaml default is used if not set
        // In production, set these as real environment variables
    }
}