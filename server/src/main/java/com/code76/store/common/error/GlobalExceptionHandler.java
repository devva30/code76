package com.code76.store.common.error;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import com.code76.store.payments.gateway.PaymentProviderException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.HttpMediaTypeNotSupportedException;
import org.springframework.validation.BindException;
import org.springframework.validation.FieldError;
import org.springframework.web.HttpRequestMethodNotSupportedException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.async.AsyncRequestNotUsableException;
import org.springframework.web.method.annotation.HandlerMethodValidationException;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.multipart.support.MissingServletRequestPartException;
import org.springframework.web.method.annotation.MethodArgumentTypeMismatchException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;

/** Maps exceptions to the consistent {@link ApiError} body with an appropriate status. */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(ResourceNotFoundException.class)
    ResponseEntity<ApiError> notFound(ResourceNotFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", ex.getMessage(), request, List.of());
    }

    @ExceptionHandler(NoResourceFoundException.class)
    ResponseEntity<ApiError> noRoute(NoResourceFoundException ex, HttpServletRequest request) {
        return build(HttpStatus.NOT_FOUND, "NOT_FOUND", "No endpoint matches this path.", request, List.of());
    }

    /** Bean-validation failures on bound query parameters (e.g. pageSize=500). */
    @ExceptionHandler(BindException.class)
    ResponseEntity<ApiError> bindFailure(BindException ex, HttpServletRequest request) {
        List<ApiError.FieldProblem> problems = ex.getBindingResult().getAllErrors().stream()
                .map(e -> e instanceof FieldError fe
                        ? new ApiError.FieldProblem(fe.getField(), fe.isBindingFailure() ? "has an invalid value" : fe.getDefaultMessage())
                        : new ApiError.FieldProblem(e.getObjectName(), e.getDefaultMessage()))
                .sorted(Comparator.comparing(ApiError.FieldProblem::field))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more request parameters are invalid.", request, problems);
    }

    @ExceptionHandler(HandlerMethodValidationException.class)
    ResponseEntity<ApiError> methodValidation(HandlerMethodValidationException ex, HttpServletRequest request) {
        List<ApiError.FieldProblem> problems = ex.getParameterValidationResults().stream()
                .flatMap(r -> r.getResolvableErrors().stream()
                        .map(e -> new ApiError.FieldProblem(r.getMethodParameter().getParameterName(), e.getDefaultMessage())))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more request parameters are invalid.", request, problems);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    ResponseEntity<ApiError> constraintViolation(ConstraintViolationException ex, HttpServletRequest request) {
        List<ApiError.FieldProblem> problems = ex.getConstraintViolations().stream()
                .map(v -> new ApiError.FieldProblem(v.getPropertyPath().toString(), v.getMessage()))
                .toList();
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more request parameters are invalid.", request, problems);
    }

    @ExceptionHandler(MethodArgumentTypeMismatchException.class)
    ResponseEntity<ApiError> typeMismatch(MethodArgumentTypeMismatchException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more request parameters are invalid.", request,
                List.of(new ApiError.FieldProblem(ex.getName(), "has an invalid value")));
    }

    @ExceptionHandler(InvalidRequestException.class)
    ResponseEntity<ApiError> invalidRequest(InvalidRequestException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "One or more request parameters are invalid.", request,
                List.of(new ApiError.FieldProblem(ex.getField(), ex.getMessage())));
    }

    @ExceptionHandler(InvalidCredentialsException.class)
    ResponseEntity<ApiError> invalidCredentials(InvalidCredentialsException ex, HttpServletRequest request) {
        return build(HttpStatus.UNAUTHORIZED, "INVALID_CREDENTIALS", ex.getMessage(), request, List.of());
    }

    @ExceptionHandler(TooManyAttemptsException.class)
    ResponseEntity<ApiError> tooManyAttempts(TooManyAttemptsException ex, HttpServletRequest request) {
        ApiError body = new ApiError(Instant.now(), 429, "TOO_MANY_ATTEMPTS", ex.getMessage(), request.getRequestURI(), List.of());
        return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS)
                .header(HttpHeaders.RETRY_AFTER, String.valueOf(ex.getRetryAfterSeconds()))
                .body(body);
    }

    @ExceptionHandler(ConflictException.class)
    ResponseEntity<ApiError> conflict(ConflictException ex, HttpServletRequest request) {
        return build(HttpStatus.CONFLICT, ex.getCode(), ex.getMessage(), request, ex.getProblems());
    }

    @ExceptionHandler(ApiException.class)
    ResponseEntity<ApiError> apiException(ApiException ex, HttpServletRequest request) {
        return build(ex.getStatus(), ex.getCode(), ex.getMessage(), request, ex.getProblems());
    }

    /** Razorpay unreachable or refusing: log the detail here, show the customer a calm message. */
    @ExceptionHandler(PaymentProviderException.class)
    ResponseEntity<ApiError> paymentProvider(PaymentProviderException ex, HttpServletRequest request) {
        log.error("Payment provider error on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return build(HttpStatus.BAD_GATEWAY, "PAYMENT_PROVIDER_ERROR",
                "We couldn't reach our payment provider. You haven't been charged twice; please try again in a moment.", request, List.of());
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    ResponseEntity<ApiError> uploadTooLarge(MaxUploadSizeExceededException ex, HttpServletRequest request) {
        return build(HttpStatus.CONTENT_TOO_LARGE, "FILE_TOO_LARGE", "Images can be at most 10 MB.", request, List.of());
    }

    @ExceptionHandler(MissingServletRequestPartException.class)
    ResponseEntity<ApiError> missingPart(MissingServletRequestPartException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "EMPTY_FILE", "Choose a file to upload.", request, List.of());
    }

    /** Missing, empty or malformed JSON body. */
    @ExceptionHandler(HttpMessageNotReadableException.class)
    ResponseEntity<ApiError> unreadableBody(HttpMessageNotReadableException ex, HttpServletRequest request) {
        return build(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "The request body is missing or is not valid JSON.", request, List.of());
    }

    @ExceptionHandler(HttpMediaTypeNotSupportedException.class)
    ResponseEntity<ApiError> unsupportedMediaType(HttpMediaTypeNotSupportedException ex, HttpServletRequest request) {
        return build(HttpStatus.UNSUPPORTED_MEDIA_TYPE, "UNSUPPORTED_MEDIA_TYPE", "Send the request body as application/json.", request, List.of());
    }

    @ExceptionHandler(HttpRequestMethodNotSupportedException.class)
    ResponseEntity<ApiError> methodNotAllowed(HttpRequestMethodNotSupportedException ex, HttpServletRequest request) {
        return build(HttpStatus.METHOD_NOT_ALLOWED, "METHOD_NOT_ALLOWED", "This method is not supported for this endpoint.", request, List.of());
    }

    /** The visitor closed the page mid-download: nothing to answer and nothing to log as an error. */
    @ExceptionHandler(AsyncRequestNotUsableException.class)
    void clientWentAway(AsyncRequestNotUsableException ex, HttpServletRequest request) {
        log.debug("Client disconnected during {} {}", request.getMethod(), request.getRequestURI());
    }

    /** Last resort: log the detail server-side, return nothing sensitive to the client. */
    @ExceptionHandler(Exception.class)
    ResponseEntity<ApiError> unexpected(Exception ex, HttpServletRequest request) {
        log.error("Unhandled error on {} {}", request.getMethod(), request.getRequestURI(), ex);
        return build(HttpStatus.INTERNAL_SERVER_ERROR, "INTERNAL_ERROR", "Something went wrong. Please try again.", request, List.of());
    }

    private ResponseEntity<ApiError> build(HttpStatus status, String code, String message, HttpServletRequest request,
                                           List<ApiError.FieldProblem> problems) {
        ApiError body = new ApiError(Instant.now(), status.value(), code, message, request.getRequestURI(), problems);
        return ResponseEntity.status(status).body(body);
    }
}
