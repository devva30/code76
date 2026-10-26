package com.code76.store.catalogue.dto;

import java.time.Instant;
import java.util.List;

/**
 * Public API shapes for the catalogue. Entities are never serialised directly.
 * Money is always integer paise ({@code amountPaise}) with an explicit currency.
 */
public final class CatalogueDtos {

    private CatalogueDtos() {
    }

    public record Money(long amountPaise, String currency) {
        public static Money inr(long paise) {
            return new Money(paise, "INR");
        }
    }

    public record CategoryRef(String slug, String name) {
    }

    public record ImageDto(String url, String alt) {
    }

    /** One size of a colourway. {@code available} = active variant with unreserved stock. */
    public record SizeOptionDto(String size, String sku, boolean available) {
    }

    public record ColorwayDto(String code, String name, String hex, List<ImageDto> images, List<SizeOptionDto> sizes) {
    }

    /** Listing card data. */
    public record ProductSummaryDto(
            String slug,
            String name,
            String subtitle,
            String fit,
            String fitLabel,
            CategoryRef category,
            Money price,
            Money compareAtPrice,
            boolean newArrival,
            int featuredRank,
            Instant publishedAt,
            List<String> sizes,
            List<ColorwayDto> colorways) {
    }

    /** Full product page data. */
    public record ProductDetailDto(
            String slug,
            String name,
            String subtitle,
            String description,
            String fit,
            String fitLabel,
            CategoryRef category,
            List<String> collections,
            Money price,
            Money compareAtPrice,
            boolean newArrival,
            int featuredRank,
            Instant publishedAt,
            List<String> details,
            List<String> fitNotes,
            List<String> care,
            List<String> sizes,
            List<ColorwayDto> colorways) {
    }

    public record CategoryDto(String slug, String name, String description, long productCount) {
    }

    /** A collection page: its title, small heading, intro and optional banner, all set in the admin. */
    public record CollectionDto(String slug, String name, String description, String eyebrow, String intro, ImageDto banner,
                                long productCount) {
    }

    /** Filter options that actually exist in the live catalogue. */
    public record FacetsDto(List<ColorFacet> colors, List<String> sizes) {
    }

    public record ColorFacet(String name, String hex) {
    }

    public record PageResponse<T>(List<T> items, int page, int pageSize, long totalItems, int totalPages) {
    }
}
