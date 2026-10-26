package com.code76.store.content;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.content.ContentSchema.Section;
import com.code76.store.settings.StoreSettingsService;
import com.code76.store.settings.StoreSettingsService.PublicSettings;
import com.code76.store.settings.StoreSettingsService.SettingsRequest;
import com.code76.store.settings.StoreSettingsService.StoreSettings;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;

/** The website's content and settings: read by the storefront, edited in the admin. */
public final class ContentControllers {

    private ContentControllers() {
    }

    public record SiteDto(PublicSettings settings, Map<String, Object> content) {
    }

    public record AdminContentDto(List<Section> schema, Map<String, Object> content) {
    }

    /** Everything the storefront needs to render: one small request on page load. */
    @RestController
    public static class SiteController {
        private final SiteContentService content;
        private final StoreSettingsService settings;

        public SiteController(SiteContentService content, StoreSettingsService settings) {
            this.content = content;
            this.settings = settings;
        }

        @GetMapping("/api/site")
        public ResponseEntity<SiteDto> site() {
            // Always revalidated, so an edit in the admin shows on the next page load.
            return ResponseEntity.ok().cacheControl(CacheControl.noCache()).body(new SiteDto(settings.publicSettings(), content.all()));
        }
    }

    /** Admin editing of every section and of store settings (admins only, see SecurityConfig). */
    @RestController
    @Validated
    public static class AdminContentController {
        private static final String KEY = "^[a-z]+\\.[a-zA-Z]+$";

        private final SiteContentService content;
        private final StoreSettingsService settings;

        public AdminContentController(SiteContentService content, StoreSettingsService settings) {
            this.content = content;
            this.settings = settings;
        }

        @GetMapping("/api/admin/content")
        public AdminContentDto all() {
            return new AdminContentDto(ContentSchema.SECTIONS, content.all());
        }

        @PutMapping("/api/admin/content/{key}")
        public Map<String, Object> save(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable @Pattern(regexp = KEY) String key,
                                        @RequestBody Map<String, Object> body) {
            return content.save(key, body, admin);
        }

        @PostMapping("/api/admin/content/{key}/reset")
        public Map<String, Object> reset(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable @Pattern(regexp = KEY) String key) {
            return content.reset(key, admin);
        }

        @GetMapping("/api/admin/settings")
        public StoreSettings getSettings() {
            return settings.current();
        }

        @PutMapping("/api/admin/settings")
        public StoreSettings saveSettings(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody SettingsRequest body) {
            return settings.update(body, admin);
        }
    }
}
