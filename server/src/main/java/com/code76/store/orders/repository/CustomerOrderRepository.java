package com.code76.store.orders.repository;

import com.code76.store.orders.domain.CustomerOrder;
import jakarta.persistence.LockModeType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface CustomerOrderRepository extends JpaRepository<CustomerOrder, Long> {

    /** Customers only ever see their own orders: the user id is always part of the lookup. */
    Optional<CustomerOrder> findByOrderNumberAndUserId(String orderNumber, Long userId);

    Optional<CustomerOrder> findByUserIdAndIdempotencyKey(Long userId, String idempotencyKey);

    Page<CustomerOrder> findByUserIdOrderByPlacedAtDescIdDesc(Long userId, Pageable pageable);

    boolean existsByOrderNumber(String orderNumber);

    /** Locks the row, so a cancel and the expiry job can never both release the same stock. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.orderNumber = :orderNumber and o.userId = :userId")
    Optional<CustomerOrder> lockByOrderNumberAndUserId(@Param("orderNumber") String orderNumber, @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select o from CustomerOrder o where o.id = :id")
    Optional<CustomerOrder> lockById(@Param("id") Long id);

    /**
     * Overdue unpaid orders, locked. SKIP LOCKED means two servers running the job at once
     * simply share the work instead of waiting for each other.
     */
    @Query(value = """
            select * from orders
            where status = 'PENDING_PAYMENT' and expires_at <= :now
            order by expires_at
            limit :batch
            for update skip locked""", nativeQuery = true)
    List<CustomerOrder> lockOverdue(@Param("now") Instant now, @Param("batch") int batch);
}
