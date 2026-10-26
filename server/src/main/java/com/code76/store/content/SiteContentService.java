package com.code76.store.content;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.content.ContentSchema.Section;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.io.InputStream;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * The website's words and pictures, one JSON document per section. Starts from the original site
 * content (content/defaults.json, also used by the frontend as its offline fallback).
 */
@Service
@Order(10) // after the demo catalogue is seeded, since some sections point at products
public class SiteContentService implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(SiteContentService.class);
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private final JdbcTemplate jdbc;
    private final JsonMapper json;
    private final ContentValidator validator;
    private final AdminAuditService audit;
    private final Map<String, Map<String, Object>> defaults;

    public SiteContentService(JdbcTemplate jdbc, JsonMapper json, ContentValidator validator, AdminAuditService audit) throws IOException {
        this.jdbc = jdbc;
        this.json = json;
        this.validator = validator;
        this.audit = audit;
        try (InputStream in = new ClassPathResource("content/defaults.json").getInputStream()) {
            Map<String, Object> all = json.readValue(in, MAP);
            Map<String, Map<String, Object>> byKey = new LinkedHashMap<>();
            all.forEach((k, v) -> {
                if (!k.startsWith("$")) {
                    @SuppressWarnings("unchecked") Map<String, Object> section = (Map<String, Object>) v;
                    byKey.put(k, section);
                }
            });
            this.defaults = byKey;
        }
    }

    /** On startup, any section not yet in the database gets the original site content. */
    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        for (Section section : ContentSchema.SECTIONS) {
            Map<String, Object> original = defaults.get(section.key());
            if (original == null) {
                log.error("No default content for section {}", section.key());
                continue;
            }
            ContentValidator.Result checked = validator.validate(section, original);
            if (!checked.problems().isEmpty()) {
                log.error("Default content for {} doesn't match its schema: {}", section.key(), checked.problems());
            }
            int inserted = jdbc.update("insert into site_content (key, content, updated_by) values (?, ?::jsonb, 'defaults') on conflict (key) do nothing",
                    section.key(), json.writeValueAsString(checked.cleaned()));
            if (inserted > 0) {
                log.info("Added original content for section {}", section.key());
            }
        }
    }

    /** Every section, keyed by section name. */
    @Transactional(readOnly = true)
    public Map<String, Object> all() {
        Map<String, Object> out = new LinkedHashMap<>();
        for (Section section : ContentSchema.SECTIONS) {
            out.put(section.key(), defaults.getOrDefault(section.key(), Map.of()));
        }
        jdbc.query("select key, content::text from site_content", rs -> {
            String key = rs.getString(1);
            if (out.containsKey(key)) {
                // Saved content over the original, so a field added in a later version starts with its original value.
                Map<String, Object> merged = new LinkedHashMap<>(defaults.getOrDefault(key, Map.of()));
                merged.putAll(json.readValue(rs.getString(2), MAP));
                out.put(key, merged);
            }
        });
        return out;
    }

    /** Validates and saves a section; returns the cleaned version that was stored. */
    @Transactional
    public Map<String, Object> save(String key, Map<String, Object> input, AccountPrincipal admin) {
        Section section = section(key);
        ContentValidator.Result checked = validator.validate(section, input);
        if (!checked.problems().isEmpty()) {
            throw new ConflictException("CONTENT_INVALID", "Some fields need attention before this can be saved.", checked.problems());
        }
        upsert(key, checked.cleaned(), admin.getUsername());
        audit.record(admin, "CONTENT_UPDATED", "content", key, "Edited website section “" + section.label() + "”");
        return checked.cleaned();
    }

    /** Puts a section back to the original site content. */
    @Transactional
    public Map<String, Object> reset(String key, AccountPrincipal admin) {
        Section section = section(key);
        Map<String, Object> cleaned = validator.validate(section, defaults.getOrDefault(key, Map.of())).cleaned();
        upsert(key, cleaned, admin.getUsername());
        audit.record(admin, "CONTENT_RESET", "content", key, "Reset website section “" + section.label() + "” to the original");
        return cleaned;
    }

    private void upsert(String key, Map<String, Object> content, String by) {
        jdbc.update("""
                insert into site_content (key, content, updated_by) values (?, ?::jsonb, ?)
                on conflict (key) do update set content = excluded.content, updated_by = excluded.updated_by""",
                key, json.writeValueAsString(content), by);
    }

    private static Section section(String key) {
        return ContentSchema.find(key).orElseThrow(() -> new ResourceNotFoundException("No website section called '" + key + "'."));
    }

}
