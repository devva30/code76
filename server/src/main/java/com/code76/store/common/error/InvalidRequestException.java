package com.code76.store.common.error;

/** Thrown by the service layer when a request is well-formed but semantically invalid. */
public class InvalidRequestException extends RuntimeException {

    private final String field;

    public InvalidRequestException(String field, String message) {
        super(message);
        this.field = field;
    }

    public String getField() {
        return field;
    }
}
