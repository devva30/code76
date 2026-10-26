package com.code76.store.payments;

import com.code76.store.payments.gateway.RazorpaySignatures;
import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.HexFormat;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Signature checks and the live-key safety guard. */
class PaymentRulesTest {

    @Test
    void paymentSignaturesMatchAnIndependentHmac() throws Exception {
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec("s3cret".getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        String expected = HexFormat.of().formatHex(mac.doFinal("order_ABC123|pay_XYZ789".getBytes(StandardCharsets.UTF_8)));

        assertThat(RazorpaySignatures.isValidPayment("order_ABC123", "pay_XYZ789", expected, "s3cret")).isTrue();
        assertThat(RazorpaySignatures.isValidPayment("order_ABC123", "pay_XYZ789", expected.toUpperCase(), "s3cret")).isTrue();
    }

    @Test
    void anyChangeBreaksTheSignature() {
        String good = RazorpaySignatures.hmacHex("order_ABC123|pay_XYZ789", "s3cret");

        assertThat(RazorpaySignatures.isValidPayment("order_ABC123", "pay_OTHER1", good, "s3cret")).isFalse();
        assertThat(RazorpaySignatures.isValidPayment("order_ABC123", "pay_XYZ789", good, "wrong-secret")).isFalse();
        assertThat(RazorpaySignatures.isValidPayment("order_ABC123", "pay_XYZ789", null, "s3cret")).isFalse();
        assertThat(RazorpaySignatures.isValidWebhook("{\"a\":1}".getBytes(StandardCharsets.UTF_8),
                RazorpaySignatures.hmacHex("{\"a\":2}", "whsec"), "whsec")).isFalse();
    }

    @Test
    void liveKeysAreRefusedUnlessExplicitlyAllowed() {
        assertThatThrownBy(() -> new PaymentProperties("rzp_live_abc123", "secret", null, "https://api.razorpay.com/v1", false))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("real money");
        assertThat(new PaymentProperties("rzp_live_abc123", "secret", null, "https://api.razorpay.com/v1", true).enabled()).isTrue();
    }

    @Test
    void keysAreValidatedAndBlankMeansSwitchedOff() {
        assertThat(new PaymentProperties("", "", "", "https://api.razorpay.com/v1", false).enabled()).isFalse();
        assertThatThrownBy(() -> new PaymentProperties("rzp_test_abc123", " ", null, "https://api.razorpay.com/v1", false))
                .hasMessageContaining("KEY_SECRET");
        assertThatThrownBy(() -> new PaymentProperties("pk_something", "secret", null, "https://api.razorpay.com/v1", false))
                .hasMessageContaining("rzp_test_");
        PaymentProperties test = new PaymentProperties("rzp_test_abc123", "secret", null, "https://api.razorpay.com/v1", false);
        assertThat(test.testMode()).isTrue();
        assertThat(test.webhooksEnabled()).isFalse();
        assertThat(test.toString()).doesNotContain("secret").contains("****");
    }
}
