package com.code76.store.payments.gateway;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.MessageDigest;
import java.util.HexFormat;

/**
 * Razorpay proves messages are genuine with HMAC-SHA256 signatures: a fingerprint of the message
 * made with a secret only Razorpay and we know. Anyone can send "I paid", but only Razorpay can sign it.
 */
public final class RazorpaySignatures {

    private RazorpaySignatures() {
    }

    /** Checkout success: signature = HMAC(orderId + "|" + paymentId, key secret). */
    public static boolean isValidPayment(String razorpayOrderId, String razorpayPaymentId, String signature, String keySecret) {
        return matches(hmacHex(razorpayOrderId + "|" + razorpayPaymentId, keySecret), signature);
    }

    /** Webhooks: signature = HMAC(raw request body, webhook secret), sent in X-Razorpay-Signature. */
    public static boolean isValidWebhook(byte[] rawBody, String signature, String webhookSecret) {
        return matches(hmacHex(rawBody, webhookSecret), signature);
    }

    public static String hmacHex(String data, String secret) {
        return hmacHex(data.getBytes(StandardCharsets.UTF_8), secret);
    }

    public static String hmacHex(byte[] data, String secret) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal(data));
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("HmacSHA256 unavailable", e);
        }
    }

    /** Constant-time comparison, so the time taken doesn't leak how much of a forged signature was right. */
    private static boolean matches(String expectedHex, String givenHex) {
        if (givenHex == null) {
            return false;
        }
        return MessageDigest.isEqual(expectedHex.getBytes(StandardCharsets.US_ASCII),
                givenHex.trim().toLowerCase().getBytes(StandardCharsets.US_ASCII));
    }
}
