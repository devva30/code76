package com.code76.store.catalogue.domain;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** A colourway of a product, with its own ordered images. */
@Entity
@Table(name = "product_colors")
public class ProductColor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, length = 7, columnDefinition = "char(7)")
    private String hex;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @OneToMany(mappedBy = "color", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductImage> images = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProductColor() {
    }

    ProductColor(Product product, String code, String name, String hex, int sortOrder) {
        this.product = product;
        this.code = code;
        this.name = name;
        this.hex = hex;
        this.sortOrder = sortOrder;
    }

    public ProductImage addImage(String url, String altText) {
        ProductImage image = new ProductImage(product, this, url, altText, images.size());
        images.add(image);
        return image;
    }

    public void setName(String name) { this.name = name; }
    public void setHex(String hex) { this.hex = hex; }
    public void setSortOrder(int sortOrder) { this.sortOrder = sortOrder; }

    /**
     * Makes the photos exactly this list, in this order. Existing rows are updated in place so the
     * "one photo per position" rule is never broken half-way through saving.
     */
    public void replaceImages(java.util.List<String[]> urlAndAlt) {
        for (int i = 0; i < urlAndAlt.size(); i++) {
            String[] next = urlAndAlt.get(i);
            if (i < images.size()) {
                images.get(i).update(next[0], next[1]);
            } else {
                images.add(new ProductImage(product, this, next[0], next[1], i));
            }
        }
        while (images.size() > urlAndAlt.size()) {
            images.remove(images.size() - 1);
        }
    }

    public Long getId() { return id; }
    public Product getProduct() { return product; }
    public String getCode() { return code; }
    public String getName() { return name; }
    public String getHex() { return hex; }
    public int getSortOrder() { return sortOrder; }
    public List<ProductImage> getImages() { return images; }
}
