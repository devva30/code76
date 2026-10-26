package com.code76.store.orders;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

import java.time.Duration;

/**
 * Shop rules ({@code app.shop.*}). Defaults match the storefront's messaging
 * (complimentary shipping over ₹2,999).
 *
 * @param freeShippingThresholdPaise subtotal at or above which shipping is free
 * @param shippingFeePaise           flat shipping fee below the threshold
 * @param maxQuantityPerLine         most units of one SKU in a bag
 * @param maxCartLines               most different SKUs in a bag
 * @param paymentWindow              how long an unpaid order holds its stock
 */
@ConfigurationProperties(prefix = "app.shop")
public record ShopProperties(
        @DefaultValue("299900") long freeShippingThresholdPaise,
        @DefaultValue("9900") long shippingFeePaise,
        @DefaultValue("10") int maxQuantityPerLine,
        @DefaultValue("20") int maxCartLines,
        @DefaultValue("30m") Duration paymentWindow) {

    /** Shipping for a given subtotal: free over the threshold, nothing for an empty bag. */
    public long shippingFor(long subtotalPaise) {
        if (subtotalPaise <= 0 || subtotalPaise >= freeShippingThresholdPaise) {
            return 0;
        }
        return shippingFeePaise;
    }
}
