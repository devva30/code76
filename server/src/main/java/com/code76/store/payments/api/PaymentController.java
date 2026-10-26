package com.code76.store.payments.api;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.orders.dto.OrderDtos.OrderDetailDto;
import com.code76.store.orders.service.OrderNumberGenerator;
import com.code76.store.payments.dto.PaymentDtos.PaymentSessionDto;
import com.code76.store.payments.dto.PaymentDtos.VerifyPaymentRequest;
import com.code76.store.payments.service.PaymentService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Paying for one of the signed-in customer's orders. */
@RestController
@Validated
@RequestMapping("/api/me/orders/{orderNumber}/payment")
public class PaymentController {

    private final PaymentService payments;

    public PaymentController(PaymentService payments) {
        this.payments = payments;
    }

    /** Creates (or reuses) the Razorpay order and returns what the browser needs to open Checkout. */
    @PostMapping
    public PaymentSessionDto start(@AuthenticationPrincipal AccountPrincipal me,
                                   @PathVariable @Pattern(regexp = OrderNumberGenerator.PATTERN, message = "must be a valid order number") String orderNumber) {
        return payments.start(me.getId(), orderNumber);
    }

    /** Called with Razorpay's signed result; confirms the order only after checking it with Razorpay. */
    @PostMapping("/verify")
    public OrderDetailDto verify(@AuthenticationPrincipal AccountPrincipal me,
                                 @PathVariable @Pattern(regexp = OrderNumberGenerator.PATTERN, message = "must be a valid order number") String orderNumber,
                                 @Valid @RequestBody VerifyPaymentRequest body) {
        return payments.verify(me.getId(), orderNumber, body);
    }
}
