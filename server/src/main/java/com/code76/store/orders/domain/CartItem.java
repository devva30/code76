package com.code76.store.orders.domain;

import com.code76.store.catalogue.domain.ProductVariant;
import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EmbeddedId;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.MapsId;
import jakarta.persistence.Table;

import java.io.Serializable;
import java.time.Instant;
import java.util.Objects;

/** One SKU in a signed-in customer's bag. Written with upserts (see CartItemRepository). */
@Entity
@Table(name = "cart_items")
public class CartItem {

    @EmbeddedId
    private Key id;

    @MapsId("variantId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "variant_id")
    private ProductVariant variant;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected CartItem() {
    }

    public Key getId() { return id; }
    public ProductVariant getVariant() { return variant; }
    public int getQuantity() { return quantity; }
    public Instant getCreatedAt() { return createdAt; }

    @Embeddable
    public static class Key implements Serializable {

        @Column(name = "user_id")
        private Long userId;

        @Column(name = "variant_id")
        private Long variantId;

        protected Key() {
        }

        public Key(Long userId, Long variantId) {
            this.userId = userId;
            this.variantId = variantId;
        }

        public Long getUserId() { return userId; }
        public Long getVariantId() { return variantId; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(userId, k.userId) && Objects.equals(variantId, k.variantId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, variantId);
        }
    }
}
