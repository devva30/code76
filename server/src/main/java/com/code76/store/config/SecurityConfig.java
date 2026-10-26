package com.code76.store.config;

import com.code76.store.admin.AdminAccess;
import jakarta.servlet.DispatcherType;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.context.DelegatingSecurityContextRepository;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.context.RequestAttributeSecurityContextRepository;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;

/**
 * Who may call what.
 * <ul>
 *   <li>Catalogue and sign-in/up endpoints: anyone.</li>
 *   <li>{@code /api/me/**}: signed-in customers only.</li>
 *   <li>{@code /api/admin/**}: admins only, re-checked against the database on every request (AdminAccess).</li>
 *   <li>{@code /media/**}: uploaded images, public.</li>
 *   <li>{@code /api/webhooks/razorpay}: Razorpay's servers. No session or CSRF token (it isn't a browser);
 *       instead every call must carry a valid HMAC signature, checked in PaymentService.</li>
 *   <li>Anything else: denied unless signed in (secure by default for future endpoints).</li>
 * </ul>
 * Sessions are an HttpOnly cookie stored server-side (Spring Session JDBC). Every POST/PUT/DELETE
 * must carry the CSRF token from {@code GET /api/auth/csrf} in the {@code X-XSRF-TOKEN} header.
 */
@Configuration(proxyBeanMethods = false)
@EnableWebSecurity
@EnableConfigurationProperties(CorsProperties.class)
public class SecurityConfig {

    public static final String CSRF_HEADER = "X-XSRF-TOKEN";

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, SecurityContextRepository securityContextRepository,
                                    CsrfTokenRepository csrfTokenRepository, SecurityErrorWriter errors,
                                    ObjectProvider<AdminAccess> adminAccess) throws Exception {
        http
                .cors(Customizer.withDefaults())
                .csrf(csrf -> csrf.csrfTokenRepository(csrfTokenRepository).ignoringRequestMatchers("/api/webhooks/**"))
                .securityContext(context -> context.securityContextRepository(securityContextRepository))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers("/api/health", "/api/products", "/api/products/**", "/api/categories", "/api/collections", "/api/facets", "/api/site").permitAll()
                        .requestMatchers("/api/auth/**").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/webhooks/razorpay").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/newsletter").permitAll()
                        .requestMatchers("/api/me/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/media/**").permitAll()
                        .requestMatchers("/api/admin/**").access((authentication, context) -> {
                            AdminAccess access = adminAccess.getIfAvailable();
                            return access == null ? new AuthorizationDecision(false) : access.authorize(authentication, context);
                        })
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(errors::unauthenticated)
                        .accessDeniedHandler(errors::accessDenied))
                // This is a JSON API: no login page, no browser password pop-up, no redirects.
                .formLogin(AbstractHttpConfigurer::disable)
                .httpBasic(AbstractHttpConfigurer::disable)
                .logout(AbstractHttpConfigurer::disable)
                .requestCache(AbstractHttpConfigurer::disable);
        return http.build();
    }

    /** Where "who is signed in" is kept between requests: the server-side session. */
    @Bean
    SecurityContextRepository securityContextRepository() {
        return new DelegatingSecurityContextRepository(
                new RequestAttributeSecurityContextRepository(), new HttpSessionSecurityContextRepository());
    }

    @Bean
    CsrfTokenRepository csrfTokenRepository() {
        HttpSessionCsrfTokenRepository repository = new HttpSessionCsrfTokenRepository();
        repository.setHeaderName(CSRF_HEADER);
        return repository;
    }

    @Bean
    SecurityErrorWriter securityErrorWriter(JsonMapper jsonMapper) {
        return new SecurityErrorWriter(jsonMapper);
    }

    /**
     * Only the listed frontend origins may call the API from a browser, with cookies.
     * No origins configured → no CORS at all, so browsers block cross-origin calls (fails closed).
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(CorsProperties cors) {
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        if (cors.allowedOrigins().isEmpty()) {
            return source;
        }
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(cors.allowedOrigins());
        config.setAllowedMethods(List.of("GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Accept", "Content-Type", CSRF_HEADER));
        config.setAllowCredentials(true);
        config.setMaxAge(3600L);
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }
}
