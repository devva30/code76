package com.code76.store.accounts.domain;

import com.code76.store.catalogue.domain.Product;
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

/** One product saved to one customer's wishlist. Rows are written with an idempotent insert (see repository). */
@Entity
@Table(name = "wishlist_items")
public class WishlistItem {

    @EmbeddedId
    private Key id;

    @MapsId("productId")
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id")
    private Product product;

    @Column(name = "created_at", nullable = false, insertable = false, updatable = false)
    private Instant createdAt;

    protected WishlistItem() {
    }

    public Key getId() { return id; }
    public Product getProduct() { return product; }
    public Instant getCreatedAt() { return createdAt; }

    @Embeddable
    public static class Key implements Serializable {

        @Column(name = "user_id")
        private Long userId;

        @Column(name = "product_id")
        private Long productId;

        protected Key() {
        }

        public Key(Long userId, Long productId) {
            this.userId = userId;
            this.productId = productId;
        }

        public Long getUserId() { return userId; }
        public Long getProductId() { return productId; }

        @Override
        public boolean equals(Object o) {
            return o instanceof Key k && Objects.equals(userId, k.userId) && Objects.equals(productId, k.productId);
        }

        @Override
        public int hashCode() {
            return Objects.hash(userId, productId);
        }
    }
}
