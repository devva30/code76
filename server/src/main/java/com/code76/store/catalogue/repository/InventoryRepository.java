package com.code76.store.catalogue.repository;

import com.code76.store.catalogue.domain.Inventory;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Stock holds. Each method is a single conditional UPDATE, so the database itself guarantees
 * that two customers can never both take the last unit: one statement wins, the other changes 0 rows.
 */
public interface InventoryRepository extends JpaRepository<Inventory, Long> {

    /** Holds {@code quantity} units if that many are still unreserved. Returns 1 on success, 0 if not enough stock. */
    @Modifying
    @Query(value = """
            update inventory set quantity_reserved = quantity_reserved + :quantity
            where variant_id = :variantId and quantity_on_hand - quantity_reserved >= :quantity""", nativeQuery = true)
    int reserve(@Param("variantId") Long variantId, @Param("quantity") int quantity);

    /** Order paid: the held units are now sold (leave the shelf and the hold). */
    @Modifying
    @Query(value = """
            update inventory set quantity_on_hand = quantity_on_hand - :quantity, quantity_reserved = quantity_reserved - :quantity
            where variant_id = :variantId and quantity_reserved >= :quantity""", nativeQuery = true)
    int commitReserved(@Param("variantId") Long variantId, @Param("quantity") int quantity);

    /** Sells units that aren't held: used when a payment arrives after the order's hold was released. */
    @Modifying
    @Query(value = """
            update inventory set quantity_on_hand = quantity_on_hand - :quantity
            where variant_id = :variantId and quantity_on_hand - quantity_reserved >= :quantity""", nativeQuery = true)
    int sellUnreserved(@Param("variantId") Long variantId, @Param("quantity") int quantity);

    /** Puts units back on the shelf (undoing sellUnreserved when a late order can't be completed). */
    @Modifying
    @Query(value = "update inventory set quantity_on_hand = quantity_on_hand + :quantity where variant_id = :variantId", nativeQuery = true)
    int restock(@Param("variantId") Long variantId, @Param("quantity") int quantity);

    /** Gives held units back (order cancelled or expired). */
    @Modifying
    @Query(value = """
            update inventory set quantity_reserved = quantity_reserved - :quantity
            where variant_id = :variantId and quantity_reserved >= :quantity""", nativeQuery = true)
    int release(@Param("variantId") Long variantId, @Param("quantity") int quantity);
}
