package com.code76.store.orders.repository;

import com.code76.store.orders.domain.CartItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface CartItemRepository extends JpaRepository<CartItem, CartItem.Key> {

    /** Oldest first, so the bag keeps the order things were added in. */
    @Query("""
            select ci from CartItem ci
            join fetch ci.variant v
            join fetch v.product
            join fetch v.color
            where ci.id.userId = :userId
            order by ci.createdAt, v.id""")
    List<CartItem> findForUser(@Param("userId") Long userId);

    long countByIdUserId(Long userId);

    // The writes below run as plain SQL. flush/clear makes the next read in the same request see the
    // new quantities instead of a stale copy Hibernate already loaded.

    /** Insert the line, or overwrite its quantity if the SKU is already in the bag. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            insert into cart_items (user_id, variant_id, quantity) values (:userId, :variantId, :quantity)
            on conflict (user_id, variant_id) do update set quantity = excluded.quantity""", nativeQuery = true)
    void upsert(@Param("userId") Long userId, @Param("variantId") Long variantId, @Param("quantity") int quantity);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from cart_items where user_id = :userId and variant_id = :variantId", nativeQuery = true)
    int deleteLine(@Param("userId") Long userId, @Param("variantId") Long variantId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from cart_items where user_id = :userId", nativeQuery = true)
    int deleteAllForUser(@Param("userId") Long userId);
}
