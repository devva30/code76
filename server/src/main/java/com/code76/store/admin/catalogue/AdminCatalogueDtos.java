package com.code76.store.admin.catalogue;

import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** What the admin product, collection and category editors send and receive. */
public final class AdminCatalogueDtos {

    private AdminCatalogueDtos() {
    }

    static final String SLUG = "^[a-z0-9]+(-[a-z0-9]+)*$";
    static final String HEX = "^#[0-9A-Fa-f]{6}$";

    // ---- products ----

    public record ProductRow(Long id, String slug, String name, String status, String fit, String category, Money price,
                             Money compareAtPrice, boolean newArrival, int featuredRank, String thumbnail, int colorCount,
                             List<String> sizes, int stock, boolean live) {
    }

    public record SizeRow(Long variantId, String size, String sku, boolean active, int stock, int reserved, int available, Long pricePaise) {
    }

    public record ImageRef(
            @NotBlank(message = "is required") @Size(max = 500) String url,
            @Size(max = 300, message = "must be at most 300 characters") String alt) {
    }

    public record ColorDetail(Long id, String code, String name, String hex, int sortOrder, List<ImageRef> images, List<SizeRow> sizes) {
    }

    public record ProductDetail(Long id, String slug, String name, String subtitle, String description, String status, String fit,
                                String fitLabel, String categorySlug, List<String> collections, Money price, Money compareAtPrice,
                                boolean newArrival, int featuredRank, List<String> details, List<String> fitNotes, List<String> care,
                                Instant publishedAt, List<ColorDetail> colors, boolean hasOrders) {
    }

    public record ProductRequest(
            @NotBlank(message = "is required") @Size(max = 160, message = "must be at most 160 characters") String name,
            @Size(max = 120, message = "must be at most 120 characters") @Pattern(regexp = "^$|" + SLUG, message = "may only use lower-case letters, numbers and dashes") String slug,
            @Size(max = 200, message = "must be at most 200 characters") String subtitle,
            @Size(max = 4000, message = "must be at most 4000 characters") String description,
            @NotBlank(message = "is required") @Pattern(regexp = SLUG, message = "must be a valid category") String categorySlug,
            @NotBlank(message = "is required") @Pattern(regexp = "^(oversized|regular)$", message = "must be oversized or regular") String fit,
            @NotBlank(message = "is required") @Size(max = 60, message = "must be at most 60 characters") String fitLabel,
            @NotNull(message = "is required") @Positive(message = "must be more than ₹0") @Max(value = 100_000_000, message = "is too high") Long pricePaise,
            @Positive(message = "must be more than ₹0") Long compareAtPricePaise,
            boolean newArrival,
            @Size(max = 12, message = "can have at most 12 lines") List<@Size(max = 300) String> details,
            @Size(max = 12, message = "can have at most 12 lines") List<@Size(max = 300) String> fitNotes,
            @Size(max = 12, message = "can have at most 12 lines") List<@Size(max = 300) String> care,
            @Size(max = 20) List<@Pattern(regexp = SLUG) String> collections) {
    }

    public record StatusRequest(@NotBlank @Pattern(regexp = "^(draft|published|archived)$", message = "must be draft, published or archived") String status) {
    }

    public record ColorRequest(
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String name,
            @NotBlank(message = "is required") @Pattern(regexp = HEX, message = "must be a colour like #1A1A1A") String hex) {
    }

    public record ColorUpdateRequest(
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String name,
            @NotBlank(message = "is required") @Pattern(regexp = HEX, message = "must be a colour like #1A1A1A") String hex,
            @NotNull @Size(max = 12, message = "can have at most 12 photos") List<@Valid ImageRef> images) {
    }

    public record SizeUpdate(
            @NotBlank @Pattern(regexp = "^(XXS|XS|S|M|L|XL|XXL|XXXL)$", message = "is not a size we sell") String size,
            boolean active,
            @PositiveOrZero(message = "can't be negative") @Max(value = 100_000, message = "is too high") int stock,
            @Positive(message = "must be more than ₹0") Long pricePaise) {
    }

    public record SizesRequest(@NotNull @Size(max = 8) List<@Valid SizeUpdate> sizes) {
    }

    public record ReorderRequest(@NotNull @Size(min = 1, max = 500) List<@NotNull Long> ids) {
    }

    // ---- categories and collections ----

    public record CategoryRow(Long id, String slug, String name, String description, int sortOrder, long productCount) {
    }

    public record CategoryRequest(
            @NotBlank(message = "is required") @Size(max = 80) @Pattern(regexp = SLUG, message = "may only use lower-case letters, numbers and dashes") String slug,
            @NotBlank(message = "is required") @Size(max = 120, message = "must be at most 120 characters") String name,
            @Size(max = 500, message = "must be at most 500 characters") String description,
            @Min(0) @Max(10_000) int sortOrder) {
    }

    public record CollectionRow(Long id, String slug, String name, String description, int sortOrder, boolean active,
                                String eyebrow, String intro, String bannerUrl, String bannerAlt, long productCount) {
    }

    public record CollectionRequest(
            @NotBlank(message = "is required") @Size(max = 80) @Pattern(regexp = SLUG, message = "may only use lower-case letters, numbers and dashes") String slug,
            @NotBlank(message = "is required") @Size(max = 120, message = "must be at most 120 characters") String name,
            @Size(max = 500, message = "must be at most 500 characters") String description,
            @Min(0) @Max(10_000) int sortOrder,
            boolean active,
            @Size(max = 80, message = "must be at most 80 characters") String eyebrow,
            @Size(max = 600, message = "must be at most 600 characters") String intro,
            @Size(max = 500) String bannerUrl,
            @Size(max = 300, message = "must be at most 300 characters") String bannerAlt) {
    }
}
