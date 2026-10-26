package com.code76.store.payments.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

/** A Razorpay webhook event id we've already handled. Written only through WebhookEventRepository. */
@Entity
@Table(name = "payment_webhook_events")
public class WebhookEvent {

    @Id
    @Column(name = "event_id", length = 64)
    private String eventId;

    @Column(name = "event_type", nullable = false, length = 60)
    private String eventType;

    @Column(name = "received_at", nullable = false, insertable = false, updatable = false)
    private Instant receivedAt;

    protected WebhookEvent() {
    }

    public String getEventId() { return eventId; }
    public String getEventType() { return eventType; }
    public Instant getReceivedAt() { return receivedAt; }
}
