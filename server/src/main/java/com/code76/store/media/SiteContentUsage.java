package com.code76.store.media;

import com.code76.store.content.ContentSchema;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;

/** Website sections (banners, lookbook, pages...) that show an uploaded image. */
@Component
class SiteContentUsage implements MediaUsageSource {

    private final JdbcTemplate jdbc;

    SiteContentUsage(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    public List<String> usagesOf(String mediaUrl) {
        return jdbc.queryForList("select key from site_content where position(? in content::text) > 0", String.class, "\"" + mediaUrl + "\"")
                .stream()
                .map(key -> "Website: " + ContentSchema.labelOf(key).orElse(key))
                .toList();
    }
}
