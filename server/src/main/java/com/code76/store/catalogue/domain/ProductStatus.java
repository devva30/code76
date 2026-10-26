package com.code76.store.catalogue.domain;

/** Only {@link #PUBLISHED} products are visible through the public API. */
public enum ProductStatus {
    DRAFT,
    PUBLISHED,
    ARCHIVED
}
