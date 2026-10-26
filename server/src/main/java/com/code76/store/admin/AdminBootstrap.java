package com.code76.store.admin;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/**
 * On startup: accounts whose email is in ADMIN_EMAILS become admins, and admins no longer listed
 * go back to customers. So the setting is always the single source of truth for admin access.
 */
@Component
@EnableConfigurationProperties(AdminProperties.class)
public class AdminBootstrap implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    private final AdminProperties admins;
    private final JdbcTemplate jdbc;

    public AdminBootstrap(AdminProperties admins, JdbcTemplate jdbc) {
        this.admins = admins;
        this.jdbc = jdbc;
    }

    @Override
    public void run(ApplicationArguments args) {
        String[] emails = admins.emails().toArray(String[]::new);
        int demoted = jdbc.update("update users set role = 'CUSTOMER' where role = 'ADMIN' and not (email = any (?))", (Object) emails);
        int promoted = emails.length == 0 ? 0
                : jdbc.update("update users set role = 'ADMIN' where role <> 'ADMIN' and email = any (?)", (Object) emails);
        if (admins.emails().isEmpty()) {
            log.info("No ADMIN_EMAILS configured: the admin panel is closed to everyone.");
        } else {
            log.info("Admin access for {} email(s); {} promoted, {} demoted.", admins.emails().size(), promoted, demoted);
        }
    }
}
