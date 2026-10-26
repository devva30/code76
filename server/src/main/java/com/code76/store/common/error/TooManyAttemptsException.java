package com.code76.store.common.error;

/** Too many attempts from one place, e.g. failed sign-ins (HTTP 429). */
public class TooManyAttemptsException extends RuntimeException {

    private final long retryAfterSeconds;

    public TooManyAttemptsException(long retryAfterSeconds) {
        this(retryAfterSeconds, "Too many sign-in attempts. Please wait a few minutes and try again.");
    }

    public TooManyAttemptsException(long retryAfterSeconds, String message) {
        super(message);
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
