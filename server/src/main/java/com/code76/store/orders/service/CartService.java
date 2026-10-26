package com.code76.store.orders.service;

import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductImage;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.ImageDto;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.repository.ProductVariantRepository;
import com.code76.store.catalogue.service.ProductMapper;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.settings.StoreSettingsService;
import com.code76.store.orders.domain.CartItem;
import com.code76.store.orders.dto.OrderDtos.AddCartItemRequest;
import com.code76.store.orders.dto.OrderDtos.CartDto;
import com.code76.store.orders.dto.OrderDtos.CartLineDto;
import com.code76.store.orders.dto.OrderDtos.LineIssue;
import com.code76.store.orders.repository.CartItemRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

/**
 * A signed-in customer's bag. Prices are always read from the catalogue at the moment the bag is
 * shown, never taken from the browser. Every change returns the whole bag so the frontend can replace its copy.
 */
@Service
@Transactional
public class CartService {

    private final CartItemRepository items;
    private final ProductVariantRepository variants;
    private final ProductMapper mapper;
    private final StoreSettingsService settings;

    public CartService(CartItemRepository items, ProductVariantRepository variants, ProductMapper mapper, StoreSettingsService settings) {
        this.items = items;
        this.variants = variants;
        this.mapper = mapper;
        this.settings = settings;
    }

    @Transactional(readOnly = true)
    public CartDto get(Long userId) {
        return build(items.findForUser(userId));
    }

    /** Adds to the bag. Adding a SKU that is already there increases its quantity (up to the per-line limit). */
    public CartDto add(Long userId, AddCartItemRequest request) {
        ProductVariant variant = findChoice(request.slug(), request.color(), request.size());
        requireSellable(variant);
        int current = currentQuantity(userId, variant);
        if (current == 0 && items.countByIdUserId(userId) >= settings.rules().maxCartLines()) {
            throw new ConflictException("CART_FULL", "Your bag is full (" + settings.rules().maxCartLines() + " different pieces). Check out or remove something first.");
        }
        int wanted = Math.min(settings.rules().maxQuantityPerLine(), current + request.quantity());
        requireStock(variant, wanted);
        items.upsert(userId, variant.getId(), wanted);
        return get(userId);
    }

    /** Sets a line's quantity; 0 removes it. Lowering a quantity is always allowed, even if stock ran low. */
    public CartDto setQuantity(Long userId, String sku, int quantity) {
        ProductVariant variant = variants.findBySku(sku).orElseThrow(CartService::notInBag);
        int current = currentQuantity(userId, variant);
        if (current == 0) {
            throw notInBag();
        }
        if (quantity == 0) {
            items.deleteLine(userId, variant.getId());
            return get(userId);
        }
        if (quantity > current) {
            requireSellable(variant);
            requireStock(variant, quantity);
        }
        items.upsert(userId, variant.getId(), Math.min(quantity, settings.rules().maxQuantityPerLine()));
        return get(userId);
    }

    public CartDto remove(Long userId, String sku) {
        variants.findBySku(sku).ifPresent(v -> items.deleteLine(userId, v.getId()));
        return get(userId);
    }

    public CartDto clear(Long userId) {
        items.deleteAllForUser(userId);
        return get(userId);
    }

    /**
     * Folds a signed-out visitor's browser bag into their account on sign-in. Anything no longer
     * available is skipped, and quantities are trimmed to what's in stock, rather than failing.
     */
    public CartDto merge(Long userId, List<AddCartItemRequest> incoming) {
        long lines = items.countByIdUserId(userId);
        for (AddCartItemRequest request : incoming) {
            ProductVariant variant;
            try {
                variant = findChoice(request.slug(), request.color(), request.size());
            } catch (ResourceNotFoundException gone) {
                continue;
            }
            int available = variant.getInventory().available();
            if (!isSellable(variant) || available == 0) {
                continue;
            }
            int current = currentQuantity(userId, variant);
            if (current == 0 && lines >= settings.rules().maxCartLines()) {
                continue;
            }
            int wanted = Math.min(Math.min(settings.rules().maxQuantityPerLine(), current + request.quantity()), Math.max(current, available));
            items.upsert(userId, variant.getId(), wanted);
            if (current == 0) {
                lines++;
            }
        }
        return get(userId);
    }

    /** The bag as shown to the customer, with a problem flagged on any line that can't be bought as-is. */
    public CartDto build(List<CartItem> cartItems) {
        List<CartLineDto> lines = cartItems.stream().map(this::toLine).toList();
        long subtotal = lines.stream().mapToLong(l -> l.lineTotal().amountPaise()).sum();
        long shipping = settings.rules().shippingFor(subtotal);
        int itemCount = lines.stream().mapToInt(CartLineDto::quantity).sum();
        boolean ready = !lines.isEmpty() && lines.stream().allMatch(l -> l.issue() == null);
        return new CartDto(lines, itemCount, Money.inr(subtotal), Money.inr(shipping), Money.inr(subtotal + shipping),
                Money.inr(settings.rules().freeShippingThresholdPaise()), settings.rules().maxQuantityPerLine(), ready);
    }

    public static long unitPricePaise(ProductVariant variant) {
        return variant.getPricePaise() != null ? variant.getPricePaise() : variant.getProduct().getPricePaise();
    }

    public static boolean isSellable(ProductVariant variant) {
        Product p = variant.getProduct();
        return variant.isActive() && p.getStatus() == ProductStatus.PUBLISHED && p.getPublishedAt() != null;
    }

    /** First photo of the line's colour, used for bag and order thumbnails. */
    public static ImageDto imageFor(ProductVariant variant) {
        List<ProductImage> images = variant.getColor().getImages();
        return images.isEmpty() ? null : new ImageDto(images.getFirst().getUrl(), images.getFirst().getAltText());
    }

    private CartLineDto toLine(CartItem item) {
        ProductVariant v = item.getVariant();
        int available = v.getInventory().available();
        LineIssue issue = !isSellable(v) ? LineIssue.UNAVAILABLE
                : available == 0 ? LineIssue.SOLD_OUT
                : available < item.getQuantity() ? LineIssue.NOT_ENOUGH_STOCK
                : null;
        long unit = unitPricePaise(v);
        return new CartLineDto(v.getSku(), mapper.toSummary(v.getProduct()), v.getColor().getCode(), v.getColor().getName(),
                v.getSize().name(), imageFor(v), Money.inr(unit), item.getQuantity(), Money.inr(unit * item.getQuantity()),
                available, issue);
    }

    private ProductVariant findChoice(String slug, String color, String size) {
        Size parsed = Size.fromApiValue(size).orElseThrow(() -> new ResourceNotFoundException("That size isn't available."));
        return variants.findByChoice(slug, color, parsed)
                .orElseThrow(() -> new ResourceNotFoundException("That colour and size isn't available."));
    }

    private int currentQuantity(Long userId, ProductVariant variant) {
        return items.findById(new CartItem.Key(userId, variant.getId())).map(CartItem::getQuantity).orElse(0);
    }

    private static void requireSellable(ProductVariant variant) {
        if (!isSellable(variant)) {
            throw new ConflictException("UNAVAILABLE", "This piece is no longer available.");
        }
    }

    private static void requireStock(ProductVariant variant, int quantity) {
        int available = variant.getInventory().available();
        if (available == 0) {
            throw new ConflictException("SOLD_OUT", "Sorry, " + variant.getSize() + " in " + variant.getColor().getName() + " just sold out.");
        }
        if (quantity > available) {
            throw new ConflictException("NOT_ENOUGH_STOCK", "Only " + available + " left in this size.");
        }
    }

    private static ResourceNotFoundException notInBag() {
        return new ResourceNotFoundException("That item isn't in your bag.");
    }
}
