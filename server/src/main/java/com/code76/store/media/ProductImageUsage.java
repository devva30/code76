package com.code76.store.media;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** Product photos that point at an uploaded image. */
@Component
class ProductImageUsage implements MediaUsageSource {

    private final JdbcTemplate jdbc;

    ProductImageUsage(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> usagesOf(String mediaUrl) {
        return jdbc.queryForList("""
                select distinct 'Product: ' || p.name || ' (' || c.name || ')'
                from product_images i join product_colors c on c.id = i.color_id join products p on p.id = c.product_id
                where i.url = ?""", String.class, mediaUrl);
    }
}
