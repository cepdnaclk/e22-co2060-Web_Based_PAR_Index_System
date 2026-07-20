package com.parsystem.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Primary;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestTemplate;

@Configuration
public class RestTemplateConfig {

    @Bean
    @Primary
    public RestTemplate restTemplate() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        // REQUIREMENT 14: 30s connect, 60s read per spec
        factory.setConnectTimeout(30_000);
        factory.setReadTimeout(60_000);
        return new RestTemplate(factory);
    }
}
