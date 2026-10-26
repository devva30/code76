package com.code76.store.common.error;

import java.time.Instant;
import java.util.List;

/**
 * The single error shape returned by every endpoint.
 *
 * @param status  HTTP status code
 * @param error   short machine-friendly code, e.g. {@code NOT_FOUND}, {@code VALIDATION_FAILED}
 * @param message human-readable summary safe to show to users
 * @param path    request path
 * @param errors  per-field problems for validation failures (empty otherwise)
 */
public record ApiError(Instant timestamp, int status, String error, String message, String path, List<FieldProblem> errors) {

    public record FieldProblem(String field, String message) {
    }
}
