package com.code76.store.accounts.service;

import com.code76.store.accounts.dto.AccountDtos.WishlistResponse;
import com.code76.store.accounts.repository.WishlistItemRepository;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.catalogue.service.ProductMapper;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

/**
 * A customer's saved products. Every operation returns the whole list so the frontend can
 * simply replace its copy. Unpublished products are kept in the table but never shown.
 */
@Service
@Transactional
public class WishlistService {

    static final int MAX_ITEMS = 100;

    private final WishlistItemRepository items;
    private final ProductRepository products;
    private final ProductMapper mapper;

    public WishlistService(WishlistItemRepository items, ProductRepository products, ProductMapper mapper) {
        this.items = items;
        this.products = products;
        this.mapper = mapper;
    }

    @Transactional(readOnly = true)
    public WishlistResponse list(Long userId) {
        List<ProductSummaryDto> visible = items.findForUser(userId).stream()
                .map(item -> item.getProduct())
                .filter(WishlistService::isVisible)
                .map(mapper::toSummary)
                .toList();
        return new WishlistResponse(visible);
    }

    public WishlistResponse add(Long userId, String slug) {
        Product product = findVisible(slug)
                .orElseThrow(() -> new ResourceNotFoundException("No product found for '" + slug + "'."));
        if (items.countByIdUserId(userId) >= MAX_ITEMS) {
            throw new ConflictException("WISHLIST_FULL", "Your wishlist is full (" + MAX_ITEMS + " pieces). Remove something to add more.");
        }
        items.insertIfAbsent(userId, product.getId());
        return list(userId);
    }

    /** Removing something that isn't there is fine: the result is the same. */
    public WishlistResponse remove(Long userId, String slug) {
        items.deleteBySlug(userId, slug);
        return list(userId);
    }

    /**
     * Folds a signed-out visitor's browser wishlist into their account on sign-in.
     * Unknown or unpublished slugs are skipped rather than failing the whole merge.
     */
    public WishlistResponse merge(Long userId, List<String> slugs) {
        long count = items.countByIdUserId(userId);
        for (String slug : new LinkedHashSet<>(slugs)) {
            if (count >= MAX_ITEMS) {
                break;
            }
            Optional<Product> product = findVisible(slug);
            if (product.isPresent()) {
                count += items.insertIfAbsent(userId, product.get().getId());
            }
        }
        return list(userId);
    }

    private Optional<Product> findVisible(String slug) {
        return products.findBySlugAndStatus(slug, ProductStatus.PUBLISHED).filter(WishlistService::isVisible);
    }

    private static boolean isVisible(Product p) {
        return p.getStatus() == ProductStatus.PUBLISHED
                && p.getPublishedAt() != null
                && p.getVariants().stream().anyMatch(ProductVariant::isActive);
    }
}
