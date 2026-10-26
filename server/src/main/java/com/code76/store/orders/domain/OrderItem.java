package com.code76.store.orders.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** One line of an order, copied from the catalogue at the moment of ordering. */
@Entity
@Table(name = "order_items")
public class OrderItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "order_id", nullable = false)
    private CustomerOrder order;

    /** Which stock to release if the order is cancelled or expires. */
    @Column(name = "variant_id")
    private Long variantId;

    @Column(nullable = false, length = 64)
    private String sku;

    @Column(name = "product_slug", nullable = false, length = 120)
    private String productSlug;

    @Column(name = "product_name", nullable = false, length = 160)
    private String productName;

    @Column(name = "color_name", nullable = false, length = 80)
    private String colorName;

    @Column(nullable = false, length = 5)
    private String size;

    @Column(name = "image_url", length = 500)
    private String imageUrl;

    @Column(name = "unit_price_paise", nullable = false)
    private long unitPricePaise;

    @Column(nullable = false)
    private int quantity;

    @Column(name = "line_total_paise", nullable = false)
    private long lineTotalPaise;

    protected OrderItem() {
    }

    public OrderItem(Long variantId, String sku, String productSlug, String productName, String colorName, String size,
                     String imageUrl, long unitPricePaise, int quantity) {
        this.variantId = variantId;
        this.sku = sku;
        this.productSlug = productSlug;
        this.productName = productName;
        this.colorName = colorName;
        this.size = size;
        this.imageUrl = imageUrl;
        this.unitPricePaise = unitPricePaise;
        this.quantity = quantity;
        this.lineTotalPaise = unitPricePaise * quantity;
    }

    void attachTo(CustomerOrder order) {
        this.order = order;
    }

    public Long getVariantId() { return variantId; }
    public String getSku() { return sku; }
    public String getProductSlug() { return productSlug; }
    public String getProductName() { return productName; }
    public String getColorName() { return colorName; }
    public String getSize() { return size; }
    public String getImageUrl() { return imageUrl; }
    public long getUnitPricePaise() { return unitPricePaise; }
    public int getQuantity() { return quantity; }
    public long getLineTotalPaise() { return lineTotalPaise; }
}
