package com.code76.store.catalogue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.MapsId;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** Stock for one variant. Reserved units are held for carts/orders (later phases). */
@Entity
@Table(name = "inventory")
public class Inventory {

    @Id
    @Column(name = "variant_id")
    private Long variantId;

    @MapsId
    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id")
    private ProductVariant variant;

    @Column(name = "quantity_on_hand", nullable = false)
    private int quantityOnHand;

    @Column(name = "quantity_reserved", nullable = false)
    private int quantityReserved;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Inventory() {
    }

    Inventory(ProductVariant variant, int quantityOnHand) {
        if (quantityOnHand < 0) {
            throw new IllegalArgumentException("Stock cannot be negative");
        }
        this.variant = variant;
        this.quantityOnHand = quantityOnHand;
    }

    /** Units that can still be sold. */
    public int available() {
        return Math.max(0, quantityOnHand - quantityReserved);
    }

    public int getQuantityOnHand() { return quantityOnHand; }
    public int getQuantityReserved() { return quantityReserved; }

    public void setQuantityOnHand(int quantityOnHand) {
        if (quantityOnHand < 0) {
            throw new IllegalArgumentException("Stock cannot be negative");
        }
        this.quantityOnHand = quantityOnHand;
    }
}
