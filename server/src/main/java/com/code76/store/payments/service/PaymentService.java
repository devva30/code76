package com.code76.store.payments.service;

import com.code76.store.accounts.repository.UserAccountRepository;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.repository.InventoryRepository;
import com.code76.store.common.error.ApiException;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.orders.domain.CustomerOrder;
import com.code76.store.orders.domain.OrderItem;
import com.code76.store.orders.domain.OrderStatus;
import com.code76.store.orders.dto.OrderDtos.OrderDetailDto;
import com.code76.store.orders.repository.CustomerOrderRepository;
import com.code76.store.orders.service.OrderEvents;
import com.code76.store.orders.service.OrderService;
import com.code76.store.payments.PaymentKeysService;
import com.code76.store.payments.domain.Payment;
import com.code76.store.payments.dto.PaymentDtos.PaymentSessionDto;
import com.code76.store.payments.dto.PaymentDtos.Prefill;
import com.code76.store.payments.dto.PaymentDtos.VerifyPaymentRequest;
import com.code76.store.payments.gateway.PaymentProviderException;
import com.code76.store.payments.gateway.RazorpayGateway;
import com.code76.store.payments.gateway.RazorpayGateway.RzpPayment;
import com.code76.store.payments.gateway.RazorpaySignatures;
import com.code76.store.payments.repository.PaymentRepository;
import com.code76.store.payments.repository.WebhookEventRepository;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.json.JsonMapper;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Online payment with Razorpay. The browser is never trusted to say "I paid": every success is
 * checked with Razorpay's signature AND by asking Razorpay directly, and amounts must match exactly.
 * The browser callback and Razorpay's webhook both end in {@link #settle}, which is safe to run twice.
 */
@Service
public class PaymentService {

    private static final Logger log = LoggerFactory.getLogger(PaymentService.class);
    private static final String CURRENCY = "INR";

    private final CustomerOrderRepository orders;
    private final PaymentRepository payments;
    private final WebhookEventRepository webhookEvents;
    private final InventoryRepository inventory;
    private final UserAccountRepository users;
    private final OrderService orderService;
    private final RazorpayGateway gateway;
    private final PaymentKeysService keys;
    private final JsonMapper json;
    private final Clock clock;
    private final OrderEvents events;

    public PaymentService(CustomerOrderRepository orders, PaymentRepository payments, WebhookEventRepository webhookEvents,
                          InventoryRepository inventory, UserAccountRepository users, OrderService orderService,
                          RazorpayGateway gateway, PaymentKeysService keys, JsonMapper json, Clock clock, OrderEvents events) {
        this.orders = orders;
        this.payments = payments;
        this.webhookEvents = webhookEvents;
        this.inventory = inventory;
        this.users = users;
        this.orderService = orderService;
        this.gateway = gateway;
        this.keys = keys;
        this.json = json;
        this.clock = clock;
        this.events = events;
    }

    // ---- 1. Start: the customer clicks Pay ----

    @Transactional
    public PaymentSessionDto start(Long userId, String orderNumber) {
        requireEnabled();
        CustomerOrder order = orders.lockByOrderNumberAndUserId(orderNumber, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No order found for '" + orderNumber + "'."));
        if (!order.isAwaitingPayment()) {
            throw new ConflictException("ORDER_NOT_PAYABLE", "This order is " + order.getStatus().apiValue().replace('_', ' ') + " and can't be paid.");
        }
        if (!orderService.canPay(order)) {
            throw new ConflictException("PAYMENT_WINDOW_CLOSED", "The time to pay for this order has run out.");
        }
        // Clicking Pay again reuses the same Razorpay order, so retries never create duplicates.
        Payment payment = payments.findFirstByOrderIdAndStatusOrderByIdDesc(order.getId(), Payment.Status.CREATED)
                .filter(p -> p.getAmountPaise() == order.getTotalPaise())
                .orElseGet(() -> payments.save(new Payment(order.getId(),
                        gateway.createOrder(order.getTotalPaise(), CURRENCY, order.getOrderNumber(),
                                Map.of("order_number", order.getOrderNumber())).id(),
                        order.getTotalPaise())));

        String email = users.findById(userId).map(u -> u.getEmail()).orElse(null);
        long secondsLeft = Duration.between(clock.instant(), order.getExpiresAt()).toSeconds();
        return new PaymentSessionDto(keys.current().keyId(), payment.getProviderOrderId(), Money.inr(payment.getAmountPaise()),
                order.getOrderNumber(), "CODE76", "Order " + order.getOrderNumber(),
                new Prefill(order.getShippingAddress().getFullName(), email, "+91" + order.getShippingAddress().getPhone()),
                secondsLeft, keys.current().testMode());
    }

    // ---- 2. Verify: the browser returns from Razorpay Checkout ----

    @Transactional
    public OrderDetailDto verify(Long userId, String orderNumber, VerifyPaymentRequest request) {
        requireEnabled();
        CustomerOrder owned = orders.findByOrderNumberAndUserId(orderNumber, userId)
                .orElseThrow(() -> new ResourceNotFoundException("No order found for '" + orderNumber + "'."));
        Payment payment = payments.lockByProviderOrderId(request.razorpayOrderId())
                .filter(p -> p.getOrderId().equals(owned.getId()))
                .orElseThrow(PaymentService::verificationFailed);

        // a) Only Razorpay (or someone holding our secret) can produce this signature.
        if (!RazorpaySignatures.isValidPayment(request.razorpayOrderId(), request.razorpayPaymentId(),
                request.razorpaySignature(), keys.current().keySecret())) {
            log.warn("Order {}: payment signature did not verify", orderNumber);
            throw verificationFailed();
        }
        // b) Ask Razorpay directly: right order, right amount, really successful?
        RzpPayment rzp = gateway.fetchPayment(request.razorpayPaymentId());
        if (!matches(payment, rzp)) {
            log.warn("Order {}: Razorpay payment {} doesn't match (order {}, {} {}, {})", orderNumber, rzp.id(),
                    rzp.orderId(), rzp.amount(), rzp.currency(), rzp.status());
            throw verificationFailed();
        }
        settle(payment, rzp);
        return orderService.toDetail(orders.findById(owned.getId()).orElseThrow());
    }

    // ---- 3. Webhook: Razorpay tells us directly ----

    @JsonIgnoreProperties(ignoreUnknown = true)
    record WebhookBody(String event, Payload payload) {
        @JsonIgnoreProperties(ignoreUnknown = true)
        record Payload(Entity payment) {
        }

        @JsonIgnoreProperties(ignoreUnknown = true)
        record Entity(RzpPayment entity) {
        }

        RzpPayment paymentEntity() {
            return payload == null || payload.payment() == null ? null : payload.payment().entity();
        }
    }

    @Transactional
    public void handleWebhook(byte[] rawBody, String signature, String eventId) {
        if (!keys.current().webhooksEnabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "WEBHOOKS_DISABLED", "Webhooks are not configured.");
        }
        if (!RazorpaySignatures.isValidWebhook(rawBody, signature, keys.current().webhookSecret())) {
            log.warn("Rejected a webhook with an invalid signature");
            throw new ApiException(HttpStatus.BAD_REQUEST, "INVALID_SIGNATURE", "Webhook signature is invalid.");
        }
        WebhookBody body;
        try {
            body = json.readValue(rawBody, WebhookBody.class);
        } catch (JacksonException e) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "MALFORMED_REQUEST", "Webhook body is not valid JSON.");
        }
        String id = eventId == null || eventId.isBlank() ? RazorpaySignatures.hmacHex(rawBody, "event-id") : eventId;
        if (webhookEvents.recordFirstDelivery(id, String.valueOf(body.event())) == 0) {
            log.debug("Webhook {} already handled", id);
            return;
        }
        RzpPayment rzp = body.paymentEntity();
        if (rzp == null || rzp.orderId() == null) {
            return;
        }
        switch (String.valueOf(body.event())) {
            case "payment.captured", "order.paid" -> payments.lockByProviderOrderId(rzp.orderId()).ifPresent(payment -> {
                if (matches(payment, rzp)) {
                    settle(payment, rzp);
                } else {
                    log.warn("Webhook payment {} doesn't match our payment for {}", rzp.id(), rzp.orderId());
                }
            });
            case "payment.failed" -> payments.lockByProviderOrderId(rzp.orderId())
                    .filter(p -> p.getStatus() == Payment.Status.CREATED)
                    .ifPresent(p -> p.recordFailure(rzp.errorDescription()));
            default -> log.debug("Ignoring webhook event {}", body.event());
        }
    }

    // ---- Store-side refund (admin cancels a paid order) ----

    /** Refunds the payment that paid for this order in full. Called inside the cancel transaction. */
    @Transactional
    public String refundPaidOrder(CustomerOrder order) {
        Payment paid = payments.findByOrderId(order.getId()).stream()
                .filter(p -> p.getStatus() == Payment.Status.PAID)
                .findFirst()
                .orElseThrow(() -> new ConflictException("NO_PAYMENT_TO_REFUND", "No completed payment was found for this order."));
        requireEnabled();
        String refundId = gateway.refund(paid.getProviderPaymentId(), paid.getAmountPaise());
        paid.markRefunded(paid.getProviderPaymentId(), refundId, clock.instant());
        return refundId;
    }

    // ---- Settle: turn a verified payment into a confirmed order (or a refund) ----

    /** Must be called with the payment row locked. Running it twice for the same payment is harmless. */
    private void settle(Payment payment, RzpPayment rzp) {
        if (payment.getStatus() != Payment.Status.CREATED) {
            return; // already handled by the other path (browser or webhook)
        }
        CustomerOrder order = orders.lockById(payment.getOrderId()).orElseThrow();
        RzpPayment collected = ensureCaptured(rzp);
        Instant now = clock.instant();

        if (order.getStatus() == OrderStatus.PENDING_PAYMENT) {
            for (OrderItem item : order.getItems()) {
                if (item.getVariantId() != null && inventory.commitReserved(item.getVariantId(), item.getQuantity()) == 0) {
                    log.error("Order {}: no reservation to commit for {} x {}", order.getOrderNumber(), item.getQuantity(), item.getSku());
                }
            }
            order.markPaid(now);
            payment.markPaid(collected.id(), now);
            events.record(order.getId(), "PAID", "Payment received", OrderEvents.RAZORPAY);
            log.info("Order {} paid ({} paise, payment {})", order.getOrderNumber(), collected.amount(), collected.id());
        } else if (order.getStatus() == OrderStatus.EXPIRED && sellAgain(order)) {
            order.markPaid(now);
            payment.markPaid(collected.id(), now);
            events.record(order.getId(), "PAID", "Payment arrived after the hold ended; the pieces were still available, so the order is confirmed", OrderEvents.RAZORPAY);
            log.info("Order {} paid after its hold expired; stock was still available, so it's confirmed", order.getOrderNumber());
        } else {
            // Expired with stock gone, cancelled by the customer, or already paid: give the money back.
            String refundId = gateway.refund(collected.id(), collected.amount());
            payment.markRefunded(collected.id(), refundId, now);
            events.record(order.getId(), "REFUNDED", "A payment arrived but couldn't be used, so it was refunded in full", OrderEvents.SYSTEM);
            log.warn("Order {} is {}; payment {} refunded ({})", order.getOrderNumber(), order.getStatus(), collected.id(), refundId);
        }
    }

    /** Some accounts approve ("authorize") first and collect ("capture") separately; collect it now. */
    private RzpPayment ensureCaptured(RzpPayment rzp) {
        if (!"authorized".equals(rzp.status())) {
            return rzp;
        }
        try {
            return gateway.capture(rzp.id(), rzp.amount(), rzp.currency());
        } catch (PaymentProviderException e) {
            // Auto-capture may have beaten us to it.
            RzpPayment latest = gateway.fetchPayment(rzp.id());
            if ("captured".equals(latest.status())) {
                return latest;
            }
            throw e;
        }
    }

    /** Re-secures every line of a late-paid order, all or nothing. */
    private boolean sellAgain(CustomerOrder order) {
        List<OrderItem> sold = new ArrayList<>();
        for (OrderItem item : order.getItems()) {
            if (item.getVariantId() == null || inventory.sellUnreserved(item.getVariantId(), item.getQuantity()) == 0) {
                sold.forEach(s -> inventory.restock(s.getVariantId(), s.getQuantity()));
                return false;
            }
            sold.add(item);
        }
        return true;
    }

    private static boolean matches(Payment payment, RzpPayment rzp) {
        return payment.getProviderOrderId().equals(rzp.orderId())
                && rzp.amount() == payment.getAmountPaise()
                && CURRENCY.equals(rzp.currency())
                && rzp.isSuccessful();
    }

    private void requireEnabled() {
        if (!keys.current().enabled()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "PAYMENTS_UNAVAILABLE", "Online payment isn't set up yet.");
        }
    }

    private static ApiException verificationFailed() {
        return new ApiException(HttpStatus.BAD_REQUEST, "PAYMENT_VERIFICATION_FAILED",
                "We couldn't confirm this payment here. If money was taken, your order will update once Razorpay confirms it, so please don't pay twice.");
    }
}
