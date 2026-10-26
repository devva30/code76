package com.code76.store.catalogue.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** A curated grouping of products (named to avoid clashing with java.util.Collection). */
@Entity
@Table(name = "collections")
public class CuratedCollection {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 80)
    private String slug;

    @Column(nullable = false, length = 120)
    private String name;

    private String description;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false)
    private boolean active = true;

    @Column(nullable = false, length = 80)
    private String eyebrow = "";

    @Column(nullable = false, length = 600)
    private String intro = "";

    @Column(name = "banner_url", length = 500)
    private String bannerUrl;

    @Column(name = "banner_alt", nullable = false, length = 300)
    private String bannerAlt = "";

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected CuratedCollection() {
    }

    public CuratedCollection(String slug, String name, String description, int sortOrder) {
        this.slug = slug;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
    }

    public Long getId() { return id; }
    public String getSlug() { return slug; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public int getSortOrder() { return sortOrder; }
    public boolean isActive() { return active; }

    public void setActive(boolean active) { this.active = active; }
    public String getEyebrow() { return eyebrow; }
    public String getIntro() { return intro; }
    public String getBannerUrl() { return bannerUrl; }
    public String getBannerAlt() { return bannerAlt; }

    public void update(String slug, String name, String description, int sortOrder, boolean active,
                       String eyebrow, String intro, String bannerUrl, String bannerAlt) {
        this.slug = slug;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
        this.active = active;
        this.eyebrow = eyebrow;
        this.intro = intro;
        this.bannerUrl = bannerUrl;
        this.bannerAlt = bannerAlt;
    }
}
