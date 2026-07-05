package com.parsystem.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

/**
 * HTTP client used to call the Python ML landmark-prediction microservice.
 * Built manually (rather than via RestTemplateBuilder) to avoid API
 * differences between Spring Boot versions around timeout configuration.
 */
@Configuration
public class RestClientConfig {

    @Bean
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(5_000);  // ms
        factory.setReadTimeout(60_000);    // ms — safety margin; requests should now take seconds, not minutes
        return new RestTemplate(factory);
    }
}
