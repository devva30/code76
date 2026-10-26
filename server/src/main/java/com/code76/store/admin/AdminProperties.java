package com.code76.store.admin;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Who may use the admin panel ({@code app.admin.emails}, from ADMIN_EMAILS in server/.env).
 * Nobody can make themselves an admin from the website; only this setting grants it.
 */
@ConfigurationProperties(prefix = "app.admin")
public record AdminProperties(List<String> emails) {

    public AdminProperties {
        emails = emails == null ? List.of() : emails.stream()
                .map(e -> e.trim().toLowerCase(Locale.ROOT))
                .filter(e -> !e.isEmpty())
                .distinct()
                .toList();
    }

    public Set<String> emailSet() {
        return emails.stream().collect(Collectors.toUnmodifiableSet());
    }

    public boolean isAdminEmail(String normalisedEmail) {
        return emails.contains(normalisedEmail);
    }
}
