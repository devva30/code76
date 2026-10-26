package com.code76.store.common.error;

import org.springframework.http.HttpStatus;

import java.util.List;

/** An error with a specific status and code, returned as-is in the standard error body. */
public class ApiException extends RuntimeException {

    private final HttpStatus status;
    private final String code;
    private final List<ApiError.FieldProblem> problems;

    public ApiException(HttpStatus status, String code, String message) {
        this(status, code, message, List.of());
    }

    /** With per-field messages, so a form can mark exactly which fields need attention. */
    public ApiException(HttpStatus status, String code, String message, List<ApiError.FieldProblem> problems) {
        super(message);
        this.status = status;
        this.code = code;
        this.problems = List.copyOf(problems);
    }

    public HttpStatus getStatus() {
        return status;
    }

    public String getCode() {
        return code;
    }

    public List<ApiError.FieldProblem> getProblems() {
        return problems;
    }
}
