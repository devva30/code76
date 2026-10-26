package com.code76.store.payments;

/**
 * The Razorpay keys payments use right now: the ones saved in the admin, or else the server's
 * environment settings. Secrets never leave the server.
 *
 * @param source where they came from: "admin", "server" (environment) or "none"
 */
public record PaymentKeys(String keyId, String keySecret, String webhookSecret, String source) {

    public static final PaymentKeys NONE = new PaymentKeys(null, null, null, "none");

    static PaymentKeys fromEnvironment(PaymentProperties env) {
        return env.enabled() ? new PaymentKeys(env.keyId(), env.keySecret(), env.webhookSecret(), "server") : NONE;
    }

    /** Online payment is switched off until keys are set. */
    public boolean enabled() {
        return keyId != null && keySecret != null;
    }

    public boolean webhooksEnabled() {
        return enabled() && webhookSecret != null;
    }

    public boolean testMode() {
        return keyId != null && keyId.startsWith("rzp_test_");
    }

    @Override
    public String toString() {
        // Never print secrets, even by accident in a log line.
        return "PaymentKeys[keyId=" + keyId + ", source=" + source + ", keySecret=" + (keySecret == null ? "unset" : "****")
                + ", webhookSecret=" + (webhookSecret == null ? "unset" : "****") + "]";
    }
}
