package com.code76.store.orders.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** A placed order. Named CustomerOrder because ORDER is a reserved word in SQL. */
@Entity
@Table(name = "orders")
public class CustomerOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_number", nullable = false, unique = true, length = 20)
    private String orderNumber;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private OrderStatus status = OrderStatus.PENDING_PAYMENT;

    @Column(nullable = false, length = 3)
    private String currency = "INR";

    @Column(name = "subtotal_paise", nullable = false)
    private long subtotalPaise;

    @Column(name = "shipping_paise", nullable = false)
    private long shippingPaise;

    @Column(name = "total_paise", nullable = false)
    private long totalPaise;

    @Embedded
    private ShippingAddress shippingAddress;

    @Column(name = "idempotency_key", nullable = false, length = 64)
    private String idempotencyKey;

    @Column(name = "expires_at")
    private Instant expiresAt;

    @Column(name = "placed_at", nullable = false)
    private Instant placedAt;

    /** When the order was cancelled or expired. */
    @Column(name = "closed_at")
    private Instant closedAt;

    @Column(name = "paid_at")
    private Instant paidAt;

    @Column(name = "shipped_at")
    private Instant shippedAt;

    @Column(name = "delivered_at")
    private Instant deliveredAt;

    @Column(length = 80)
    private String courier;

    @Column(name = "tracking_number", length = 80)
    private String trackingNumber;

    @Column(name = "tracking_url", length = 500)
    private String trackingUrl;

    @Column(name = "cancel_reason", length = 300)
    private String cancelReason;

    @OneToMany(mappedBy = "order", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id")
    private List<OrderItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CustomerOrder() {
    }

    public CustomerOrder(String orderNumber, Long userId, ShippingAddress shippingAddress, String idempotencyKey,
                         Instant placedAt, Instant expiresAt) {
        this.orderNumber = orderNumber;
        this.userId = userId;
        this.shippingAddress = shippingAddress;
        this.idempotencyKey = idempotencyKey;
        this.placedAt = placedAt;
        this.expiresAt = expiresAt;
    }

    public void addItem(OrderItem item) {
        item.attachTo(this);
        items.add(item);
        subtotalPaise += item.getLineTotalPaise();
    }

    public void setShippingPaise(long shippingPaise) {
        this.shippingPaise = shippingPaise;
        this.totalPaise = subtotalPaise + shippingPaise;
    }

    public boolean isAwaitingPayment() {
        return status == OrderStatus.PENDING_PAYMENT;
    }

    /** Ends an unpaid order. The caller releases the reserved stock in the same transaction. */
    public void close(OrderStatus outcome, Instant at) {
        if (outcome != OrderStatus.CANCELLED && outcome != OrderStatus.EXPIRED) {
            throw new IllegalArgumentException("Only CANCELLED or EXPIRED close an order");
        }
        if (!isAwaitingPayment()) {
            throw new IllegalStateException("Order " + orderNumber + " is " + status + " and can no longer be closed");
        }
        this.status = outcome;
        this.closedAt = at;
        this.expiresAt = null;
    }

    /**
     * Payment received. Normally from PENDING_PAYMENT; also from EXPIRED when a payment lands just
     * after the hold ended and the caller managed to secure the stock again.
     */
    public void markPaid(Instant at) {
        if (status != OrderStatus.PENDING_PAYMENT && status != OrderStatus.EXPIRED) {
            throw new IllegalStateException("Order " + orderNumber + " is " + status + " and can't be marked paid");
        }
        this.status = OrderStatus.CONFIRMED;
        this.paidAt = at;
        this.expiresAt = null;
        this.closedAt = null;
    }

    /** Handed to the courier. Only paid (confirmed) orders can ship. */
    public void markShipped(String courier, String trackingNumber, String trackingUrl, Instant at) {
        require(OrderStatus.CONFIRMED, "shipped");
        this.status = OrderStatus.SHIPPED;
        this.courier = courier;
        this.trackingNumber = trackingNumber;
        this.trackingUrl = trackingUrl;
        this.shippedAt = at;
    }

    public void markDelivered(Instant at) {
        require(OrderStatus.SHIPPED, "delivered");
        this.status = OrderStatus.DELIVERED;
        this.deliveredAt = at;
    }

    /** Cancelled by the store. Allowed until it ships; the caller releases or restocks and refunds. */
    public void cancelByStore(String reason, Instant at) {
        if (status != OrderStatus.PENDING_PAYMENT && status != OrderStatus.CONFIRMED) {
            throw new IllegalStateException("Order " + orderNumber + " is " + status + " and can no longer be cancelled");
        }
        this.status = OrderStatus.CANCELLED;
        this.cancelReason = reason;
        this.closedAt = at;
        this.expiresAt = null;
    }

    private void require(OrderStatus expected, String action) {
        if (status != expected) {
            throw new IllegalStateException("Order " + orderNumber + " is " + status + " and can't be marked " + action);
        }
    }

    public Long getId() { return id; }
    public Instant getPaidAt() { return paidAt; }
    public Instant getShippedAt() { return shippedAt; }
    public Instant getDeliveredAt() { return deliveredAt; }
    public String getCourier() { return courier; }
    public String getTrackingNumber() { return trackingNumber; }
    public String getTrackingUrl() { return trackingUrl; }
    public String getCancelReason() { return cancelReason; }
    public String getOrderNumber() { return orderNumber; }
    public Long getUserId() { return userId; }
    public OrderStatus getStatus() { return status; }
    public String getCurrency() { return currency; }
    public long getSubtotalPaise() { return subtotalPaise; }
    public long getShippingPaise() { return shippingPaise; }
    public long getTotalPaise() { return totalPaise; }
    public ShippingAddress getShippingAddress() { return shippingAddress; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public Instant getExpiresAt() { return expiresAt; }
    public Instant getPlacedAt() { return placedAt; }
    public Instant getClosedAt() { return closedAt; }
    public List<OrderItem> getItems() { return items; }
}
