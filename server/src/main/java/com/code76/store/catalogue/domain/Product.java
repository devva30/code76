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
import jakarta.persistence.JoinTable;
import jakarta.persistence.ManyToMany;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.annotations.UpdateTimestamp;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "products")
public class Product {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 120)
    private String slug;

    @Column(nullable = false, length = 160)
    private String name;

    @Column(length = 200)
    private String subtitle;

    @Column(nullable = false)
    private String description = "";

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Fit fit;

    @Column(name = "fit_label", nullable = false, length = 60)
    private String fitLabel;

    @Column(name = "price_paise", nullable = false)
    private long pricePaise;

    @Column(name = "compare_at_price_paise")
    private Long compareAtPricePaise;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ProductStatus status = ProductStatus.DRAFT;

    @Column(name = "new_arrival", nullable = false)
    private boolean newArrival;

    @Column(name = "featured_rank", nullable = false)
    private int featuredRank = 1000;

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(nullable = false, columnDefinition = "text[]")
    private List<String> details = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "fit_notes", nullable = false, columnDefinition = "text[]")
    private List<String> fitNotes = new ArrayList<>();

    @JdbcTypeCode(SqlTypes.ARRAY)
    @Column(name = "care_instructions", nullable = false, columnDefinition = "text[]")
    private List<String> careInstructions = new ArrayList<>();

    @Column(name = "published_at")
    private Instant publishedAt;

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    private List<ProductColor> colors = new ArrayList<>();

    @OneToMany(mappedBy = "product", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("id ASC")
    private List<ProductVariant> variants = new ArrayList<>();

    @ManyToMany
    @JoinTable(
            name = "product_collections",
            joinColumns = @JoinColumn(name = "product_id"),
            inverseJoinColumns = @JoinColumn(name = "collection_id"))
    @OrderBy("sortOrder ASC")
    private Set<CuratedCollection> collections = new LinkedHashSet<>();

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Product() {
    }

    public Product(String slug, String name, Category category, Fit fit, String fitLabel, long pricePaise) {
        this.slug = slug;
        this.name = name;
        this.category = category;
        this.fit = fit;
        this.fitLabel = fitLabel;
        this.pricePaise = pricePaise;
    }

    /** Adds a colourway and keeps both sides of the association in sync. */
    public ProductColor addColor(String code, String name, String hex) {
        ProductColor color = new ProductColor(this, code, name, hex, colors.size());
        colors.add(color);
        return color;
    }

    /** Adds a sellable SKU for a colour/size, with its stock record. */
    public ProductVariant addVariant(ProductColor color, Size size, String sku, int stock) {
        ProductVariant variant = new ProductVariant(this, color, size, sku, stock);
        variants.add(variant);
        return variant;
    }

    /** Hidden from the store but kept, with its order history intact. */
    public void unpublish(ProductStatus to) {
        this.status = to;
    }

    /** Removes a colourway and all its sizes (the caller checks nothing is held for unpaid orders). */
    public void removeColor(ProductColor color) {
        variants.removeIf(v -> v.getColor() == color);
        colors.remove(color);
    }

    /** Puts the product on sale. Its first publish date is kept, so "Newest" order doesn't jump on republish. */
    public void publish(Instant at) {
        this.status = ProductStatus.PUBLISHED;
        if (this.publishedAt == null) {
            this.publishedAt = at;
        }
    }

    public boolean isPublished() {
        return status == ProductStatus.PUBLISHED;
    }

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public String getSubtitle() { return subtitle; }
    public String getDescription() { return description; }
    public Category getCategory() { return category; }
    public Fit getFit() { return fit; }
    public String getFitLabel() { return fitLabel; }
    public long getPricePaise() { return pricePaise; }
    public Long getCompareAtPricePaise() { return compareAtPricePaise; }
    public ProductStatus getStatus() { return status; }
    public boolean isNewArrival() { return newArrival; }
    public int getFeaturedRank() { return featuredRank; }
    public List<String> getDetails() { return details; }
    public List<String> getFitNotes() { return fitNotes; }
    public List<String> getCareInstructions() { return careInstructions; }
    public Instant getPublishedAt() { return publishedAt; }
    public List<ProductColor> getColors() { return colors; }
    public List<ProductVariant> getVariants() { return variants; }
    public Set<CuratedCollection> getCollections() { return collections; }

    public void setName(String name) { this.name = name; }
    public void setSlug(String slug) { this.slug = slug; }
    public void setCategory(Category category) { this.category = category; }
    public void setFit(Fit fit) { this.fit = fit; }
    public void setFitLabel(String fitLabel) { this.fitLabel = fitLabel; }
    public void setPricePaise(long pricePaise) { this.pricePaise = pricePaise; }
    public void setSubtitle(String subtitle) { this.subtitle = subtitle; }
    public void setDescription(String description) { this.description = description; }
    public void setCompareAtPricePaise(Long compareAtPricePaise) { this.compareAtPricePaise = compareAtPricePaise; }
    public void setStatus(ProductStatus status) { this.status = status; }
    public void setNewArrival(boolean newArrival) { this.newArrival = newArrival; }
    public void setFeaturedRank(int featuredRank) { this.featuredRank = featuredRank; }
    public void setDetails(List<String> details) { this.details = new ArrayList<>(details); }
    public void setFitNotes(List<String> fitNotes) { this.fitNotes = new ArrayList<>(fitNotes); }
    public void setCareInstructions(List<String> care) { this.careInstructions = new ArrayList<>(care); }
}
