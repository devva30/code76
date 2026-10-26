package com.code76.store.payments.api;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.payments.PaymentKeysService;
import com.code76.store.payments.PaymentKeysService.PaymentKeysStatus;
import com.code76.store.payments.PaymentKeysService.SaveKeysRequest;
import com.code76.store.payments.PaymentKeysService.TestKeysRequest;
import com.code76.store.payments.PaymentKeysService.TestResult;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Admin → Store settings → Payments: the Razorpay keys checkout uses. Secrets go in, never come out. */
@RestController
public class AdminPaymentKeysController {

    public record RemoveKeysRequest(@Size(max = 200) String currentPassword) {
    }

    private final PaymentKeysService keys;

    public AdminPaymentKeysController(PaymentKeysService keys) {
        this.keys = keys;
    }

    @GetMapping("/api/admin/settings/payments")
    public PaymentKeysStatus status() {
        return keys.status();
    }

    @PutMapping("/api/admin/settings/payments")
    public PaymentKeysStatus save(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody SaveKeysRequest body) {
        return keys.save(body, admin);
    }

    @PostMapping("/api/admin/settings/payments/remove")
    public PaymentKeysStatus remove(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody RemoveKeysRequest body) {
        return keys.remove(admin, body.currentPassword());
    }

    @PostMapping("/api/admin/settings/payments/test")
    public TestResult test(@Valid @RequestBody TestKeysRequest body) {
        return keys.test(body);
    }
}
