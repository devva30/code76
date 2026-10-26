package com.code76.store.common.error;

/**
 * Sign-in failed. Deliberately says nothing about which part was wrong, so the API
 * cannot be used to discover which emails have accounts.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Email or password is incorrect.");
    }
}
