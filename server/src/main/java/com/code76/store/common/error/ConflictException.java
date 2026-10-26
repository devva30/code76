package com.code76.store.common.error;

import java.util.List;

/**
 * The request is valid but clashes with the current state (HTTP 409): an email already registered,
 * a size that just sold out, an order that can no longer be cancelled. Optional per-item problems
 * (e.g. which bag lines need attention) are returned in the error body's {@code errors} list.
 */
public class ConflictException extends RuntimeException {

    private final String code;
    private final List<ApiError.FieldProblem> problems;

    public ConflictException(String code, String message) {
        this(code, message, List.of());
    }

    public ConflictException(String code, String message, List<ApiError.FieldProblem> problems) {
        super(message);
        this.code = code;
        this.problems = List.copyOf(problems);
    }

    public String getCode() {
        return code;
    }

    public List<ApiError.FieldProblem> getProblems() {
        return problems;
    }
}
