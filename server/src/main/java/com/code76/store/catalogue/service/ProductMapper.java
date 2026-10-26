package com.code76.store.catalogue.service;

import com.code76.store.catalogue.domain.CuratedCollection;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.CategoryRef;
import com.code76.store.catalogue.dto.CatalogueDtos.ColorwayDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ImageDto;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductDetailDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.dto.CatalogueDtos.SizeOptionDto;
import org.springframework.stereotype.Component;

import java.util.Comparator;
import java.util.List;

/**
 * Entity → DTO mapping. Only active variants are exposed; a colourway appears only
 * if it has at least one active variant. Must be called inside a read transaction.
 */
@Component
public class ProductMapper {

    public ProductSummaryDto toSummary(Product p) {
        return new ProductSummaryDto(
                p.getSlug(),
                p.getName(),
                p.getSubtitle(),
                p.getFit().apiValue(),
                p.getFitLabel(),
                new CategoryRef(p.getCategory().getSlug(), p.getCategory().getName()),
                Money.inr(p.getPricePaise()),
                compareAt(p),
                p.isNewArrival(),
                p.getFeaturedRank(),
                p.getPublishedAt(),
                activeSizes(p),
                colorways(p));
    }

    public ProductDetailDto toDetail(Product p) {
        return new ProductDetailDto(
                p.getSlug(),
                p.getName(),
                p.getSubtitle(),
                p.getDescription(),
                p.getFit().apiValue(),
                p.getFitLabel(),
                new CategoryRef(p.getCategory().getSlug(), p.getCategory().getName()),
                p.getCollections().stream().filter(CuratedCollection::isActive).map(CuratedCollection::getSlug).toList(),
                Money.inr(p.getPricePaise()),
                compareAt(p),
                p.isNewArrival(),
                p.getFeaturedRank(),
                p.getPublishedAt(),
                List.copyOf(p.getDetails()),
                List.copyOf(p.getFitNotes()),
                List.copyOf(p.getCareInstructions()),
                activeSizes(p),
                colorways(p));
    }

    private static Money compareAt(Product p) {
        Long compareAt = p.getCompareAtPricePaise();
        return compareAt != null && compareAt > p.getPricePaise() ? Money.inr(compareAt) : null;
    }

    /** Distinct sizes offered by any active variant, in size order. */
    private static List<String> activeSizes(Product p) {
        return p.getVariants().stream()
                .filter(ProductVariant::isActive)
                .map(ProductVariant::getSize)
                .distinct()
                .sorted()
                .map(Size::name)
                .toList();
    }

    /** Same colourway: identical instance, or same persisted id (Hibernate may hand back a proxy). */
    private static boolean sameColor(ProductColor a, ProductColor b) {
        return a == b || (a.getId() != null && a.getId().equals(b.getId()));
    }

    private static List<ColorwayDto> colorways(Product p) {
        return p.getColors().stream()
                .sorted(Comparator.comparingInt(ProductColor::getSortOrder))
                .map(color -> {
                    List<SizeOptionDto> sizes = p.getVariants().stream()
                            .filter(v -> v.isActive() && sameColor(v.getColor(), color))
                            .sorted(Comparator.comparing(ProductVariant::getSize))
                            .map(v -> new SizeOptionDto(v.getSize().name(), v.getSku(), v.isPurchasable()))
                            .toList();
                    List<ImageDto> images = color.getImages().stream()
                            .map(i -> new ImageDto(i.getUrl(), i.getAltText()))
                            .toList();
                    return new ColorwayDto(color.getCode(), color.getName(), color.getHex(), images, sizes);
                })
                .filter(c -> !c.sizes().isEmpty())
                .toList();
    }
}
