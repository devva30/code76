package com.code76.store.catalogue.service;

import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductDetailDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.dto.ProductSearchRequest;
import com.code76.store.catalogue.dto.SortOption;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.common.error.InvalidRequestException;
import com.code76.store.common.error.ResourceNotFoundException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.EnumSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

import static com.code76.store.catalogue.repository.ProductSpecifications.availableInColors;
import static com.code76.store.catalogue.repository.ProductSpecifications.availableInSizes;
import static com.code76.store.catalogue.repository.ProductSpecifications.hasFit;
import static com.code76.store.catalogue.repository.ProductSpecifications.hasSlugIn;
import static com.code76.store.catalogue.repository.ProductSpecifications.inCategory;
import static com.code76.store.catalogue.repository.ProductSpecifications.inCollection;
import static com.code76.store.catalogue.repository.ProductSpecifications.matchesSearch;
import static com.code76.store.catalogue.repository.ProductSpecifications.priceAtLeast;
import static com.code76.store.catalogue.repository.ProductSpecifications.priceAtMost;
import static com.code76.store.catalogue.repository.ProductSpecifications.publiclyVisible;

/** Public catalogue queries: only published products and active variants are ever returned. */
@Service
@Transactional(readOnly = true)
public class ProductService {

    private final ProductRepository products;
    private final ProductMapper mapper;

    public ProductService(ProductRepository products, ProductMapper mapper) {
        this.products = products;
        this.mapper = mapper;
    }

    public PageResponse<ProductSummaryDto> search(ProductSearchRequest request) {
        SortOption sort = parseSort(request.sort());
        Specification<Product> spec = buildSpecification(request);
        PageRequest pageable = PageRequest.of(request.pageOrDefault(), request.pageSizeOrDefault(), sort.sort());
        Page<Product> page = products.findAll(spec, pageable);
        List<ProductSummaryDto> items = page.getContent().stream().map(mapper::toSummary).toList();
        return new PageResponse<>(items, page.getNumber(), page.getSize(), page.getTotalElements(), page.getTotalPages());
    }

    public ProductDetailDto getBySlug(String slug) {
        Product product = products.findBySlugAndStatus(slug, ProductStatus.PUBLISHED)
                .filter(p -> p.getPublishedAt() != null && p.getVariants().stream().anyMatch(v -> v.isActive()))
                .orElseThrow(() -> new ResourceNotFoundException("No product found for '" + slug + "'."));
        return mapper.toDetail(product);
    }

    Specification<Product> buildSpecification(ProductSearchRequest r) {
        Specification<Product> spec = publiclyVisible();
        if (hasText(r.q())) {
            spec = spec.and(matchesSearch(r.q().trim()));
        }
        if (hasText(r.category())) {
            spec = spec.and(inCategory(r.category()));
        }
        if (hasText(r.collection())) {
            spec = spec.and(inCollection(r.collection()));
        }
        Set<Fit> fits = parseAll("fit", r.fit(), Fit::fromApiValue, Fit.class, "oversized, regular");
        if (!fits.isEmpty()) {
            spec = spec.and(hasFit(fits));
        }
        Set<Size> sizes = parseAll("sizes", r.sizes(), Size::fromApiValue, Size.class, Size.allowedValues());
        if (!sizes.isEmpty()) {
            spec = spec.and(availableInSizes(sizes));
        }
        List<String> slugs = cleaned(r.slugs());
        if (!slugs.isEmpty()) {
            spec = spec.and(hasSlugIn(slugs));
        }
        List<String> colors = cleaned(r.colors());
        if (!colors.isEmpty()) {
            spec = spec.and(availableInColors(colors));
        }
        if (r.minPricePaise() != null) {
            spec = spec.and(priceAtLeast(r.minPricePaise()));
        }
        if (r.maxPricePaise() != null) {
            spec = spec.and(priceAtMost(r.maxPricePaise()));
        }
        return spec;
    }

    static SortOption parseSort(String value) {
        if (!hasText(value)) {
            return SortOption.FEATURED;
        }
        return SortOption.fromApiValue(value).orElseThrow(() ->
                new InvalidRequestException("sort", "must be one of: " + SortOption.allowedValues()));
    }

    private static <E extends Enum<E>> Set<E> parseAll(String field, List<String> raw, Function<String, Optional<E>> parser,
                                                       Class<E> type, String allowed) {
        Set<E> parsed = EnumSet.noneOf(type);
        for (String value : cleaned(raw)) {
            parsed.add(parser.apply(value).orElseThrow(() ->
                    new InvalidRequestException(field, "'" + value + "' is not supported; use one of: " + allowed)));
        }
        return parsed;
    }

    /** Splits comma-separated values, trims, and drops blanks. */
    private static List<String> cleaned(List<String> raw) {
        if (raw == null) {
            return List.of();
        }
        return raw.stream()
                .flatMap(v -> Arrays.stream(v.split(",")))
                .map(String::trim)
                .filter(v -> !v.isEmpty())
                .collect(Collectors.toCollection(java.util.LinkedHashSet::new))
                .stream().toList();
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
