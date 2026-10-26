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

@Entity
@Table(name = "categories")
public class Category {

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

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected Category() {
    }

    public Category(String slug, String name, String description, int sortOrder) {
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

    public void update(String slug, String name, String description, int sortOrder) {
        this.slug = slug;
        this.name = name;
        this.description = description;
        this.sortOrder = sortOrder;
    }
}
