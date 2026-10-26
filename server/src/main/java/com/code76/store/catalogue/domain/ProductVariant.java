package com.code76.store.catalogue.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** A sellable SKU: one product in one colour and size. */
@Entity
@Table(name = "product_variants")
public class ProductVariant {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "color_id", nullable = false)
    private ProductColor color;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 5)
    private Size size;

    @Column(nullable = false, unique = true, length = 64)
    private String sku;

    /** Optional override of the product price, in paise. */
    @Column(name = "price_paise")
    private Long pricePaise;

    @Column(nullable = false)
    private boolean active = true;

    @OneToOne(mappedBy = "variant", cascade = CascadeType.ALL, orphanRemoval = true, optional = false)
    private Inventory inventory;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProductVariant() {
    }

    ProductVariant(Product product, ProductColor color, Size size, String sku, int stock) {
        this.product = product;
        this.color = color;
        this.size = size;
        this.sku = sku;
        this.inventory = new Inventory(this, stock);
    }

    /** True when the variant is active and has unreserved stock. */
    public boolean isPurchasable() {
        return active && inventory != null && inventory.available() > 0;
    }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public ProductColor getColor() { return color; }
    public Size getSize() { return size; }
    public String getSku() { return sku; }
    public Long getPricePaise() { return pricePaise; }
    public boolean isActive() { return active; }
    public Inventory getInventory() { return inventory; }

    public void setActive(boolean active) { this.active = active; }
    public void setPricePaise(Long pricePaise) { this.pricePaise = pricePaise; }
}
