package com.code76.store.common.error;

/** Thrown when a requested resource does not exist or is not publicly visible. */
public class ResourceNotFoundException extends RuntimeException {

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
