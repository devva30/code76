package com.code76.store.orders.dto;

import com.code76.store.catalogue.dto.CatalogueDtos.ImageDto;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** Request and response bodies for the bag and orders. All money is in paise. */
public final class OrderDtos {

    private OrderDtos() {
    }

    static final String SLUG = "^[a-z0-9]+(-[a-z0-9]+)*$";

    // ---- Bag ----

    /** Problems the customer must fix before checking out. */
    public enum LineIssue {
        /** Product or variant is no longer for sale. */
        UNAVAILABLE,
        /** No stock left in this colour and size. */
        SOLD_OUT,
        /** Fewer units left than the bag asks for (see availableQuantity). */
        NOT_ENOUGH_STOCK
    }

    public record CartLineDto(
            String sku,
            ProductSummaryDto product,
            String colorCode,
            String colorName,
            String size,
            ImageDto image,
            Money unitPrice,
            int quantity,
            Money lineTotal,
            int availableQuantity,
            LineIssue issue) {
    }

    public record CartDto(
            List<CartLineDto> lines,
            int itemCount,
            Money subtotal,
            Money shipping,
            Money total,
            Money freeShippingThreshold,
            int maxQuantityPerLine,
            boolean readyForCheckout) {
    }

    /** "This product, this colour, this size": the same choice the product page makes. */
    public record AddCartItemRequest(
            @NotBlank(message = "is required") @Pattern(regexp = SLUG, message = "must be a valid slug") String slug,
            @NotBlank(message = "is required") @Size(max = 40, message = "must be at most 40 characters") String color,
            @NotBlank(message = "is required") @Pattern(regexp = "^(XXS|XS|S|M|L|XL|XXL|XXXL|3XL)$", message = "must be one of XXS, XS, S, M, L, XL, XXL, XXXL") String size,
            @NotNull(message = "is required") @Min(value = 1, message = "must be at least 1") @Max(value = 10, message = "must be at most 10") Integer quantity) {
    }

    public record UpdateCartItemRequest(
            @NotNull(message = "is required") @Min(value = 0, message = "must be 0 or more") @Max(value = 10, message = "must be at most 10") Integer quantity) {
    }

    public record MergeCartRequest(
            @NotNull(message = "is required") @Size(max = 50, message = "must list at most 50 items") List<@Valid @NotNull AddCartItemRequest> items) {
    }

    // ---- Checkout ----

    /**
     * Indian delivery address. Phone numbers are accepted as "98765 43210", "+91 98765-43210" or
     * "09876543210" and stored as the 10 digits.
     */
    public record AddressRequest(
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String fullName,
            @NotBlank(message = "is required") @Pattern(regexp = "^[6-9][0-9]{9}$", message = "must be a 10-digit Indian mobile number") String phone,
            @NotBlank(message = "is required") @Size(max = 120, message = "must be at most 120 characters") String line1,
            @Size(max = 120, message = "must be at most 120 characters") String line2,
            @NotBlank(message = "is required") @Size(max = 60, message = "must be at most 60 characters") String city,
            @NotBlank(message = "is required") String state,
            @NotBlank(message = "is required") @Pattern(regexp = "^[1-9][0-9]{5}$", message = "must be a 6-digit PIN code") String pincode) {

        public AddressRequest {
            fullName = trim(fullName);
            phone = normalisePhone(phone);
            line1 = trim(line1);
            line2 = trim(line2);
            line2 = line2 == null || line2.isEmpty() ? null : line2;
            city = trim(city);
            state = trim(state);
            pincode = pincode == null ? null : pincode.replaceAll("\\s", "");
        }

        static String normalisePhone(String raw) {
            if (raw == null) {
                return null;
            }
            String digits = raw.replaceAll("[\\s()-]", "");
            if (digits.startsWith("+91")) {
                digits = digits.substring(3);
            } else if (digits.length() == 12 && digits.startsWith("91")) {
                digits = digits.substring(2);
            } else if (digits.length() == 11 && digits.startsWith("0")) {
                digits = digits.substring(1);
            }
            return digits;
        }

        private static String trim(String value) {
            return value == null ? null : value.trim();
        }
    }

    public record CheckoutRequest(
            @NotNull(message = "is required") @Valid AddressRequest address,
            /** A random id the browser makes once per checkout; retrying with it never creates a second order. */
            @NotBlank(message = "is required") @Pattern(regexp = "^[A-Za-z0-9-]{8,64}$", message = "must be 8 to 64 letters, digits or dashes")
            String idempotencyKey) {
    }

    // ---- Orders ----

    public record AddressDto(String fullName, String phone, String line1, String line2, String city, String state, String pincode) {
    }

    public record OrderItemDto(String sku, String productSlug, String productName, String colorName, String size,
                               String imageUrl, Money unitPrice, int quantity, Money lineTotal) {
    }

    public record OrderSummaryDto(String orderNumber, String status, Instant placedAt, Instant expiresAt,
                                  int itemCount, Money total, List<String> previewImages) {
    }

    /**
     * @param canPay   awaiting payment, online payment is set up, and there's still time left to pay
     * @param refunded a payment arrived but couldn't be used (e.g. after the order expired) and was refunded
     */
    public record OrderDetailDto(String orderNumber, String status, Instant placedAt, Instant expiresAt, Instant closedAt,
                                 Instant paidAt, List<OrderItemDto> items, Money subtotal, Money shipping, Money total,
                                 AddressDto shippingAddress, boolean canCancel, boolean canPay, boolean refunded,
                                 Shipment shipment, String cancelReason, List<TimelineEntry> timeline) {
    }

    /** Courier and tracking, once the order has shipped. */
    public record Shipment(String courier, String trackingNumber, String trackingUrl, Instant shippedAt, Instant deliveredAt) {
    }

    /** One step in an order's history, as the customer sees it. */
    public record TimelineEntry(String type, String message, Instant at) {
    }
}
