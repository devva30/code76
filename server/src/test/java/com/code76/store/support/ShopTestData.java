package com.code76.store.support;

import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Adjusts demo stock, prices and availability for a test and puts everything back afterwards,
 * so tests that place orders never leak into the catalogue tests that share the database.
 */
public final class ShopTestData {

    private final JdbcTemplate jdbc;
    private final Map<String, Integer> originalStock = new LinkedHashMap<>();
    private final Map<String, Long> originalPrices = new LinkedHashMap<>();
    private final Map<String, Long> originalCompareAt = new LinkedHashMap<>();
    private final Map<String, Boolean> originalActive = new LinkedHashMap<>();

    public ShopTestData(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void setStock(String sku, int onHand) {
        originalStock.computeIfAbsent(sku, s -> jdbc.queryForObject(
                "select i.quantity_on_hand from inventory i join product_variants v on v.id = i.variant_id where v.sku = ?", Integer.class, s));
        jdbc.update("update inventory set quantity_on_hand = ? where variant_id = (select id from product_variants where sku = ?)", onHand, sku);
    }

    public void setProductPrice(String slug, long pricePaise) {
        if (!originalPrices.containsKey(slug)) {
            originalPrices.put(slug, jdbc.queryForObject("select price_paise from products where slug = ?", Long.class, slug));
            originalCompareAt.put(slug, jdbc.queryForObject("select compare_at_price_paise from products where slug = ?", Long.class, slug));
        }
        // compare_at must stay above price, so lift it out of the way for the test.
        jdbc.update("update products set compare_at_price_paise = null, price_paise = ? where slug = ?", pricePaise, slug);
    }

    public void deactivate(String sku) {
        originalActive.computeIfAbsent(sku, s -> jdbc.queryForObject("select active from product_variants where sku = ?", Boolean.class, s));
        jdbc.update("update product_variants set active = false where sku = ?", sku);
    }

    public int reserved(String sku) {
        return jdbc.queryForObject(
                "select i.quantity_reserved from inventory i join product_variants v on v.id = i.variant_id where v.sku = ?", Integer.class, sku);
    }

    public int onHand(String sku) {
        return jdbc.queryForObject(
                "select i.quantity_on_hand from inventory i join product_variants v on v.id = i.variant_id where v.sku = ?", Integer.class, sku);
    }

    public int orderCount(String email) {
        return jdbc.queryForObject("select count(*) from orders o join users u on u.id = o.user_id where u.email = ?", Integer.class, email);
    }

    /** Removes every order and bag, releases all holds, and restores anything this helper changed. */
    public void reset() {
        jdbc.update("delete from orders"); // payments go with their orders
        jdbc.update("delete from payment_webhook_events");
        jdbc.update("delete from cart_items");
        jdbc.update("update inventory set quantity_reserved = 0 where quantity_reserved <> 0");
        originalStock.forEach((sku, onHand) -> jdbc.update(
                "update inventory set quantity_on_hand = ? where variant_id = (select id from product_variants where sku = ?)", onHand, sku));
        originalActive.forEach((sku, active) -> jdbc.update("update product_variants set active = ? where sku = ?", active, sku));
        originalPrices.forEach((slug, price) -> jdbc.update(
                "update products set price_paise = ?, compare_at_price_paise = ? where slug = ?", price, originalCompareAt.get(slug), slug));
        originalStock.clear();
        originalActive.clear();
        originalPrices.clear();
        originalCompareAt.clear();
    }
}
