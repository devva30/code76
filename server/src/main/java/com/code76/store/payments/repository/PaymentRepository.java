package com.code76.store.payments.repository;

import com.code76.store.payments.domain.Payment;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {

    /** The open (not yet paid) Razorpay order for one of our orders, reused if the customer clicks Pay again. */
    Optional<Payment> findFirstByOrderIdAndStatusOrderByIdDesc(Long orderId, Payment.Status status);

    /** Locked, so the browser's "verify" and Razorpay's webhook can't both settle the same payment. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Payment p where p.providerOrderId = :providerOrderId")
    Optional<Payment> lockByProviderOrderId(@Param("providerOrderId") String providerOrderId);

    List<Payment> findByOrderId(Long orderId);
}
