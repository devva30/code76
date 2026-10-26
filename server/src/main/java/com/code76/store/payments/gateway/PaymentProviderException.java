package com.code76.store.payments.gateway;

/** Razorpay couldn't be reached or rejected a call (HTTP 502 to our client; details are only logged). */
public class PaymentProviderException extends RuntimeException {

    public PaymentProviderException(String message, Throwable cause) {
        super(message, cause);
    }
}
