package com.code76.store.payments.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * One Razorpay order created for one of our orders. A customer may try several times
 * (a failed UPI attempt, then a card): those are attempts against the same Razorpay order.
 */
@Entity
@Table(name = "payments")
public class Payment {

    public enum Status { CREATED, PAID, REFUNDED }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", nullable = false)
    private Long orderId;

    @Column(nullable = false, length = 20)
    private String provider = "RAZORPAY";

    @Column(name = "provider_order_id", nullable = false, unique = true, length = 64)
    private String providerOrderId;

    @Column(name = "provider_payment_id", unique = true, length = 64)
    private String providerPaymentId;

    @Column(name = "amount_paise", nullable = false)
    private long amountPaise;

    @Column(nullable = false, length = 3)
    private String currency = "INR";

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Status status = Status.CREATED;

    @Column(name = "failure_reason")
    private String failureReason;

    @Column(name = "refund_id", length = 64)
    private String refundId;

    @Column(name = "paid_at")
    private Instant paidAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Payment() {
    }

    public Payment(Long orderId, String providerOrderId, long amountPaise) {
        this.orderId = orderId;
        this.providerOrderId = providerOrderId;
        this.amountPaise = amountPaise;
    }

    public void markPaid(String providerPaymentId, Instant at) {
        this.providerPaymentId = providerPaymentId;
        this.status = Status.PAID;
        this.paidAt = at;
        this.failureReason = null;
    }

    /** Money came in but the order can't be fulfilled (e.g. paid after it expired and stock ran out). */
    public void markRefunded(String providerPaymentId, String refundId, Instant at) {
        this.providerPaymentId = providerPaymentId;
        this.refundId = refundId;
        this.status = Status.REFUNDED;
        this.paidAt = at;
    }

    public void recordFailure(String reason) {
        this.failureReason = reason == null ? null : reason.substring(0, Math.min(reason.length(), 255));
    }

    public Long getId() { return id; }
    public Long getOrderId() { return orderId; }
    public String getProviderOrderId() { return providerOrderId; }
    public String getProviderPaymentId() { return providerPaymentId; }
    public long getAmountPaise() { return amountPaise; }
    public String getCurrency() { return currency; }
    public Status getStatus() { return status; }
    public String getFailureReason() { return failureReason; }
    public String getRefundId() { return refundId; }
    public Instant getPaidAt() { return paidAt; }
}
