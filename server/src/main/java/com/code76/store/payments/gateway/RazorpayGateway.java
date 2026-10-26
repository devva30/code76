package com.code76.store.payments.gateway;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;

import java.util.Map;

/** The few Razorpay API calls the shop needs. Amounts are always integer paise. */
public interface RazorpayGateway {

    RzpOrder createOrder(long amountPaise, String currency, String receipt, Map<String, String> notes);

    RzpPayment fetchPayment(String paymentId);

    /** For accounts that don't auto-capture: turns an "authorized" payment into a completed one. */
    RzpPayment capture(String paymentId, long amountPaise, String currency);

    /** Full refund; returns Razorpay's refund id. */
    String refund(String paymentId, long amountPaise);

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RzpOrder(String id, long amount, String currency, String status) {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RzpPayment(String id, @JsonProperty("order_id") String orderId, long amount, String currency, String status,
                      @JsonProperty("error_description") String errorDescription) {

        /** "authorized" = approved but not yet collected; "captured" = money collected. */
        public boolean isSuccessful() {
            return "authorized".equals(status) || "captured".equals(status);
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    record RzpRefund(String id) {
    }
}
