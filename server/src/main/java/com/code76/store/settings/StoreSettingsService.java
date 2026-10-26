package com.code76.store.settings;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.orders.ShopProperties;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;

/**
 * Store-wide settings, edited in the admin. The shipping and payment rules here are the ones
 * checkout uses. Read often, changed rarely, so they're cached for a few seconds.
 */
@Service
public class StoreSettingsService {

    /** Everything in the settings table. Money in paise. */
    public record StoreSettings(String storeName, String tagline, String supportEmail, long freeShippingThresholdPaise,
                                long shippingFeePaise, int maxQuantityPerLine, int maxCartLines, int paymentWindowMinutes) {
    }

    /** What the website itself needs (no internal limits). */
    public record PublicSettings(String storeName, String tagline, String supportEmail, Money freeShippingThreshold, Money shippingFee,
                                 int maxQuantityPerLine) {
    }

    public record SettingsRequest(
            @NotBlank(message = "is required") @Size(max = 60, message = "must be at most 60 characters") String storeName,
            @NotBlank(message = "is required") @Size(max = 120, message = "must be at most 120 characters") String tagline,
            @NotBlank(message = "is required") @Email(message = "must be an email address") @Size(max = 254) String supportEmail,
            @Min(value = 0, message = "can't be negative") @Max(value = 100_000_000) long freeShippingThresholdPaise,
            @Min(value = 0, message = "can't be negative") @Max(value = 10_000_000) long shippingFeePaise,
            @Min(value = 1, message = "must be at least 1") @Max(value = 10, message = "can be at most 10") int maxQuantityPerLine,
            @Min(value = 1, message = "must be at least 1") @Max(value = 50, message = "can be at most 50") int maxCartLines,
            @Min(value = 5, message = "must be at least 5 minutes") @Max(value = 1440, message = "can be at most 24 hours") int paymentWindowMinutes) {
    }

    private static final Duration CACHE_FOR = Duration.ofSeconds(5);

    private final JdbcTemplate jdbc;
    private final AdminAuditService audit;
    private volatile StoreSettings cached;
    private volatile Instant cachedAt = Instant.EPOCH;

    public StoreSettingsService(JdbcTemplate jdbc, AdminAuditService audit) {
        this.jdbc = jdbc;
        this.audit = audit;
    }

    public StoreSettings current() {
        StoreSettings s = cached;
        if (s == null || Instant.now().isAfter(cachedAt.plus(CACHE_FOR))) {
            s = jdbc.queryForObject("""
                    select store_name, tagline, support_email, free_shipping_threshold_paise, shipping_fee_paise,
                           max_quantity_per_line, max_cart_lines, payment_window_minutes
                    from store_settings where id = 1""",
                    (rs, n) -> new StoreSettings(rs.getString(1), rs.getString(2), rs.getString(3), rs.getLong(4), rs.getLong(5),
                            rs.getInt(6), rs.getInt(7), rs.getInt(8)));
            cached = s;
            cachedAt = Instant.now();
        }
        return s;
    }

    /** The checkout rules (shipping, limits, payment window) as checkout code uses them. */
    public ShopProperties rules() {
        StoreSettings s = current();
        return new ShopProperties(s.freeShippingThresholdPaise(), s.shippingFeePaise(), s.maxQuantityPerLine(), s.maxCartLines(),
                Duration.ofMinutes(s.paymentWindowMinutes()));
    }

    public PublicSettings publicSettings() {
        StoreSettings s = current();
        return new PublicSettings(s.storeName(), s.tagline(), s.supportEmail(), Money.inr(s.freeShippingThresholdPaise()),
                Money.inr(s.shippingFeePaise()), s.maxQuantityPerLine());
    }

    /** Forget the cached copy (after changes made outside this service). */
    public void refresh() {
        cached = null;
    }

    @Transactional
    public StoreSettings update(SettingsRequest r, AccountPrincipal admin) {
        jdbc.update("""
                update store_settings set store_name = ?, tagline = ?, support_email = ?, free_shipping_threshold_paise = ?,
                       shipping_fee_paise = ?, max_quantity_per_line = ?, max_cart_lines = ?, payment_window_minutes = ?
                where id = 1""",
                r.storeName().trim(), r.tagline().trim(), r.supportEmail().trim(), r.freeShippingThresholdPaise(), r.shippingFeePaise(),
                r.maxQuantityPerLine(), r.maxCartLines(), r.paymentWindowMinutes());
        cached = null;
        audit.record(admin, "SETTINGS_UPDATED", "settings", 1, "Updated store settings (shipping ₹" + (r.shippingFeePaise() / 100)
                + ", free over ₹" + (r.freeShippingThresholdPaise() / 100) + ")");
        return current();
    }
}
