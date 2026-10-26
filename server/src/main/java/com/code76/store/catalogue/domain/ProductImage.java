package com.code76.store.catalogue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "product_images")
public class ProductImage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "color_id", nullable = false)
    private ProductColor color;

    @Column(nullable = false, length = 500)
    private String url;

    @Column(name = "alt_text", nullable = false, length = 300)
    private String altText;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProductImage() {
    }

    ProductImage(Product product, ProductColor color, String url, String altText, int sortOrder) {
        this.product = product;
        this.color = color;
        this.url = url;
        this.altText = altText;
        this.sortOrder = sortOrder;
    }

    void update(String url, String altText) {
        this.url = url;
        this.altText = altText;
    }

    public Long getId() { return id; }
    public String getUrl() { return url; }
    public String getAltText() { return altText; }
    public int getSortOrder() { return sortOrder; }
}
