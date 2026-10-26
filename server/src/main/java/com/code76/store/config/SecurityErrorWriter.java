package com.code76.store.config;

import com.code76.store.common.error.ApiError;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.web.csrf.CsrfException;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.time.Instant;
import java.util.List;

/**
 * Security rejections happen before any controller runs, so they can't use GlobalExceptionHandler.
 * This writes the same {@link ApiError} body so the frontend sees one consistent error format.
 */
public class SecurityErrorWriter {

    private final JsonMapper json;

    public SecurityErrorWriter(JsonMapper json) {
        this.json = json;
    }

    /** No session, or the session expired. */
    public void unauthenticated(HttpServletRequest request, HttpServletResponse response, AuthenticationException ex) throws IOException {
        write(request, response, 401, "UNAUTHENTICATED", "Please sign in to continue.");
    }

    /** Signed in but not allowed, or the CSRF token is missing/stale (the frontend refetches it and retries). */
    public void accessDenied(HttpServletRequest request, HttpServletResponse response, AccessDeniedException ex) throws IOException {
        if (ex instanceof CsrfException) {
            write(request, response, 403, "CSRF_TOKEN_INVALID", "Your security token is missing or has expired. Please try again.");
        } else {
            write(request, response, 403, "FORBIDDEN", "You don't have permission to do that.");
        }
    }

    private void write(HttpServletRequest request, HttpServletResponse response, int status, String code, String message) throws IOException {
        response.setStatus(status);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        json.writeValue(response.getOutputStream(), new ApiError(Instant.now(), status, code, message, request.getRequestURI(), List.of()));
    }
}
