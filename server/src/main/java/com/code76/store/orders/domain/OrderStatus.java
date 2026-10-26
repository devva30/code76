package com.code76.store.orders.domain;

import java.util.Locale;

/**
 * An order's life:
 * <pre>
 *   PENDING_PAYMENT ──pay (Phase 5)──▶ CONFIRMED ──▶ SHIPPED ──▶ DELIVERED
 *        │
 *        ├── customer cancels ──▶ CANCELLED
 *        └── 30 min, unpaid ────▶ EXPIRED
 * </pre>
 * Stock is reserved while PENDING_PAYMENT and released on CANCELLED or EXPIRED.
 */
public enum OrderStatus {
    PENDING_PAYMENT,
    CONFIRMED,
    SHIPPED,
    DELIVERED,
    CANCELLED,
    EXPIRED;

    public String apiValue() {
        return name().toLowerCase(Locale.ROOT);
    }
}
