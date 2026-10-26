package com.code76.store.catalogue.repository;

import com.code76.store.catalogue.domain.CuratedCollection;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Inventory;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.domain.Size;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import jakarta.persistence.criteria.Subquery;
import org.springframework.data.jpa.domain.Specification;

import java.util.Arrays;
import java.util.Collection;
import java.util.List;
import java.util.Locale;

/**
 * Composable, parameter-bound filters for the public catalogue. Every value reaches
 * the database as a bind parameter (no string concatenation), so input is never executable.
 */
public final class ProductSpecifications {

    private ProductSpecifications() {
    }

    /** Published products that still have at least one active variant. */
    public static Specification<Product> publiclyVisible() {
        return (root, query, cb) -> {
            Subquery<Long> active = query.subquery(Long.class);
            Root<ProductVariant> v = active.from(ProductVariant.class);
            active.select(cb.literal(1L)).where(cb.equal(v.get("product"), root), cb.isTrue(v.get("active")));
            return cb.and(
                    cb.equal(root.get("status"), ProductStatus.PUBLISHED),
                    cb.isNotNull(root.get("publishedAt")),
                    cb.exists(active));
        };
    }

    /** Case-insensitive match on name, subtitle or any colour name. */
    /**
     * Every whitespace-separated word must appear in the name, subtitle, fit label or a colour name,
     * so "noir oversized" finds the oversized tee in Noir. LIKE wildcards in the input are matched literally.
     */
    public static Specification<Product> matchesSearch(String term) {
        List<String> words = Arrays.stream(term.toLowerCase(Locale.ROOT).trim().split("\\s+"))
                .filter(w -> !w.isEmpty())
                .limit(8)
                .toList();
        return (root, query, cb) -> cb.and(words.stream().map(word -> {
            String pattern = "%" + escapeLike(word) + "%";
            Subquery<Long> colorMatch = query.subquery(Long.class);
            Root<ProductColor> c = colorMatch.from(ProductColor.class);
            colorMatch.select(cb.literal(1L))
                    .where(cb.equal(c.get("product"), root), cb.like(cb.lower(c.get("name")), pattern, '\\'));
            return cb.or(
                    cb.like(cb.lower(root.get("name")), pattern, '\\'),
                    cb.like(cb.lower(cb.coalesce(root.get("subtitle"), "")), pattern, '\\'),
                    cb.like(cb.lower(root.get("fitLabel")), pattern, '\\'),
                    cb.exists(colorMatch));
        }).toArray(Predicate[]::new));
    }

    public static Specification<Product> hasSlugIn(Collection<String> slugs) {
        return (root, query, cb) -> root.get("slug").in(slugs);
    }

    public static Specification<Product> inCategory(String categorySlug) {
        return (root, query, cb) -> cb.equal(root.join("category").get("slug"), categorySlug);
    }

    public static Specification<Product> inCollection(String collectionSlug) {
        return (root, query, cb) -> {
            Subquery<Long> member = query.subquery(Long.class);
            Root<Product> p = member.from(Product.class);
            Join<Product, CuratedCollection> c = p.join("collections");
            member.select(cb.literal(1L))
                    .where(cb.equal(p, root), cb.equal(c.get("slug"), collectionSlug), cb.isTrue(c.get("active")));
            return cb.exists(member);
        };
    }

    public static Specification<Product> hasFit(Collection<Fit> fits) {
        return (root, query, cb) -> root.get("fit").in(fits);
    }

    /** Has an active, in-stock variant in any of the given sizes. */
    public static Specification<Product> availableInSizes(Collection<Size> sizes) {
        return (root, query, cb) -> {
            Subquery<Long> sized = query.subquery(Long.class);
            Root<ProductVariant> v = sized.from(ProductVariant.class);
            Join<ProductVariant, Inventory> inv = v.join("inventory");
            sized.select(cb.literal(1L)).where(
                    cb.equal(v.get("product"), root),
                    cb.isTrue(v.get("active")),
                    v.get("size").in(sizes),
                    cb.greaterThan(cb.diff(inv.<Integer>get("quantityOnHand"), inv.<Integer>get("quantityReserved")), 0));
            return cb.exists(sized);
        };
    }

    /** Has an active variant in a colour whose name or code matches (case-insensitive). */
    public static Specification<Product> availableInColors(Collection<String> colors) {
        Collection<String> wanted = colors.stream().map(c -> c.trim().toLowerCase(Locale.ROOT)).toList();
        return (root, query, cb) -> {
            Subquery<Long> colored = query.subquery(Long.class);
            Root<ProductVariant> v = colored.from(ProductVariant.class);
            Join<ProductVariant, ProductColor> c = v.join("color");
            colored.select(cb.literal(1L)).where(
                    cb.equal(v.get("product"), root),
                    cb.isTrue(v.get("active")),
                    cb.or(cb.lower(c.get("name")).in(wanted), cb.lower(c.get("code")).in(wanted)));
            return cb.exists(colored);
        };
    }

    public static Specification<Product> priceAtLeast(long minPaise) {
        return (root, query, cb) -> cb.greaterThanOrEqualTo(root.get("pricePaise"), minPaise);
    }

    public static Specification<Product> priceAtMost(long maxPaise) {
        return (root, query, cb) -> cb.lessThanOrEqualTo(root.get("pricePaise"), maxPaise);
    }

    /** Escapes LIKE wildcards so user input is matched literally. */
    static String escapeLike(String value) {
        return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
    }
}
