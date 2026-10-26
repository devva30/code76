package com.code76.store.media;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** Collection banners that point at an uploaded image. */
@Component
class CollectionBannerUsage implements MediaUsageSource {

    private final JdbcTemplate jdbc;

    CollectionBannerUsage(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> usagesOf(String mediaUrl) {
        return jdbc.queryForList("select 'Collection banner: ' || name from collections where banner_url = ?", String.class, mediaUrl);
    }
}
