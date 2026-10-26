package com.code76.store.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;

/**
 * Exact origins allowed to call the API cross-origin ({@code app.cors.allowed-origins}).
 * Wildcards are rejected so production can never be opened up by accident.
 */
@ConfigurationProperties(prefix = "app.cors")
public record CorsProperties(List<String> allowedOrigins) {

    public CorsProperties {
        allowedOrigins = allowedOrigins == null ? List.of() : allowedOrigins.stream()
                .map(String::trim)
                .filter(o -> !o.isEmpty())
                .toList();
        if (allowedOrigins.stream().anyMatch(o -> o.contains("*"))) {
            throw new IllegalArgumentException("app.cors.allowed-origins must list exact origins; wildcards are not allowed");
        }
    }
}
