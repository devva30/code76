package com.code76.store.catalogue.dto;

import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * Query parameters for {@code GET /api/products}. Lists accept repeated or
 * comma-separated values, e.g. {@code ?fit=oversized,regular&sizes=M&sizes=L}.
 *
 * @param q             free-text search (name, subtitle, colour)
 * @param category      category slug
 * @param collection    collection slug
 * @param fit           fits: oversized, regular
 * @param sizes         sizes with stock: XS … XXL
 * @param colors        colour names or codes, e.g. Noir, sand
 * @param minPricePaise lower price bound in paise (inclusive)
 * @param maxPricePaise upper price bound in paise (inclusive)
 * @param sort          featured | newest | price_asc | price_desc | name
 * @param page          zero-based page index
 * @param pageSize      items per page, 1–48
 */
public record ProductSearchRequest(
        @Size(max = 100, message = "must be at most 100 characters") String q,
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "must be a valid slug") String category,
        @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "must be a valid slug") String collection,
        @Size(max = 5, message = "must list at most 5 values") List<String> fit,
        @Size(max = 8, message = "must list at most 8 values") List<String> sizes,
        @Size(max = 20, message = "must list at most 20 values") List<String> colors,
        /** Exact products by slug, e.g. to show a guest's saved bag or wishlist. */
        @Size(max = 100, message = "must list at most 100 values") List<String> slugs,
        @PositiveOrZero(message = "must be zero or more") Long minPricePaise,
        @PositiveOrZero(message = "must be zero or more") Long maxPricePaise,
        String sort,
        @Min(value = 0, message = "must be zero or more") Integer page,
        @Min(value = 1, message = "must be at least 1") @Max(value = 48, message = "must be at most 48") Integer pageSize) {

    public static final int DEFAULT_PAGE_SIZE = 12;

    public int pageOrDefault() {
        return page == null ? 0 : page;
    }

    public int pageSizeOrDefault() {
        return pageSize == null ? DEFAULT_PAGE_SIZE : pageSize;
    }

    @AssertTrue(message = "minPricePaise must not be greater than maxPricePaise")
    boolean isPriceRangeValid() {
        return minPricePaise == null || maxPricePaise == null || minPricePaise <= maxPricePaise;
    }

    public static ProductSearchRequest empty() {
        return new ProductSearchRequest(null, null, null, null, null, null, null, null, null, null, null, null);
    }
}
