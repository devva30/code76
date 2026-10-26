package com.code76.store.payments.dto;

import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/** Bodies for starting and confirming an online payment. */
public final class PaymentDtos {

    private PaymentDtos() {
    }

    /** Everything the browser needs to open Razorpay Checkout. Contains no secrets. */
    public record PaymentSessionDto(
            String keyId,
            String razorpayOrderId,
            Money amount,
            String orderNumber,
            String businessName,
            String description,
            Prefill prefill,
            long timeoutSeconds,
            boolean testMode) {
    }

    public record Prefill(String name, String email, String contact) {
    }

    /** What Razorpay Checkout hands the browser after a successful payment. */
    public record VerifyPaymentRequest(
            @NotBlank(message = "is required") @Pattern(regexp = "^order_[A-Za-z0-9]{6,40}$", message = "is not a Razorpay order id")
            String razorpayOrderId,
            @NotBlank(message = "is required") @Pattern(regexp = "^pay_[A-Za-z0-9]{6,40}$", message = "is not a Razorpay payment id")
            String razorpayPaymentId,
            @NotBlank(message = "is required") @Pattern(regexp = "^[a-fA-F0-9]{64}$", message = "is not a valid signature")
            String razorpaySignature) {
    }
}
