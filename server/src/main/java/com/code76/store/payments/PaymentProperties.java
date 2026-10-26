package com.code76.store.payments;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

/**
 * Razorpay settings ({@code app.payments.razorpay.*}), supplied only through environment variables
 * (RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET), never committed.
 *
 * @param keyId          public key id, sent to the browser to open Razorpay Checkout
 * @param keySecret      private; signs API calls and verifies payment signatures
 * @param webhookSecret  private; verifies that webhooks really come from Razorpay
 * @param baseUrl        Razorpay API base URL
 * @param allowLiveKeys  live keys move real money, so they're refused unless this is explicitly true (prod)
 */
@ConfigurationProperties(prefix = "app.payments.razorpay")
public record PaymentProperties(
        String keyId,
        String keySecret,
        String webhookSecret,
        @DefaultValue("https://api.razorpay.com/v1") String baseUrl,
        @DefaultValue("false") boolean allowLiveKeys) {

    public PaymentProperties {
        keyId = blankToNull(keyId);
        keySecret = blankToNull(keySecret);
        webhookSecret = blankToNull(webhookSecret);
        if (keyId != null && keySecret == null) {
            throw new IllegalStateException("RAZORPAY_KEY_ID is set but RAZORPAY_KEY_SECRET is missing.");
        }
        if (keyId != null && !keyId.startsWith("rzp_test_") && !keyId.startsWith("rzp_live_")) {
            throw new IllegalStateException("RAZORPAY_KEY_ID should start with rzp_test_ or rzp_live_.");
        }
        if (keyId != null && keyId.startsWith("rzp_live_") && !allowLiveKeys) {
            throw new IllegalStateException("""
                    A LIVE Razorpay key (rzp_live_…) was configured outside production. Live keys charge real money.
                    Use your Test Mode keys (rzp_test_…) for development. Production enables live keys explicitly.""");
        }
    }

    /** Online payment is switched off until keys are configured. */
    public boolean enabled() {
        return keyId != null;
    }

    public boolean webhooksEnabled() {
        return enabled() && webhookSecret != null;
    }

    public boolean testMode() {
        return keyId != null && keyId.startsWith("rzp_test_");
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    @Override
    public String toString() {
        // Never print secrets, even by accident in a log line.
        return "PaymentProperties[keyId=" + keyId + ", keySecret=" + (keySecret == null ? "unset" : "****")
                + ", webhookSecret=" + (webhookSecret == null ? "unset" : "****") + ", baseUrl=" + baseUrl + "]";
    }
}
