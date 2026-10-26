package com.code76.store.payments.api;

import com.code76.store.payments.service.PaymentService;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

/**
 * Razorpay calls this directly (server to server) when a payment succeeds or fails, so orders are
 * confirmed even if the customer closed the browser before returning. It's public, but every call
 * must carry a valid X-Razorpay-Signature made with the webhook secret.
 */
@RestController
public class RazorpayWebhookController {

    private final PaymentService payments;

    public RazorpayWebhookController(PaymentService payments) {
        this.payments = payments;
    }

    @PostMapping("/api/webhooks/razorpay")
    public Map<String, String> receive(@RequestBody byte[] rawBody,
                                       @RequestHeader(value = "X-Razorpay-Signature", required = false) String signature,
                                       @RequestHeader(value = "X-Razorpay-Event-Id", required = false) String eventId) {
        // The signature covers the exact bytes Razorpay sent, so the body is read raw, not re-serialised.
        payments.handleWebhook(rawBody, signature, eventId);
        return Map.of("status", "ok");
    }
}
