package com.code76.store.payments.repository;

import com.code76.store.payments.domain.WebhookEvent;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/** Remembers which Razorpay webhook events were already handled (Razorpay may resend them). */
public interface WebhookEventRepository extends JpaRepository<WebhookEvent, String> {

    /** Returns 1 the first time an event id is seen, 0 for a repeat. */
    @Modifying
    @Query(value = "insert into payment_webhook_events (event_id, event_type) values (:eventId, :eventType) on conflict do nothing",
            nativeQuery = true)
    int recordFirstDelivery(@Param("eventId") String eventId, @Param("eventType") String eventType);
}
