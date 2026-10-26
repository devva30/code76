package com.code76.store.admin.audit;

import com.code76.store.accounts.security.AccountPrincipal;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.List;

/** The admin diary: every change made in the admin panel is written here, and never edited afterwards. */
@Service
public class AdminAuditService {

    public record AuditEntry(long id, String adminEmail, String action, String entityType, String entityId, String summary, Instant at) {
    }

    private final JdbcTemplate jdbc;

    public AdminAuditService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** Joins the caller's transaction, so the entry is saved only if the change itself is saved. */
    public void record(AccountPrincipal admin, String action, String entityType, Object entityId, String summary) {
        jdbc.update("insert into admin_audit_log (admin_id, admin_email, action, entity_type, entity_id, summary) values (?, ?, ?, ?, ?, ?)",
                admin.getId(), admin.getUsername(), action, entityType, entityId == null ? null : String.valueOf(entityId),
                summary.length() > 500 ? summary.substring(0, 497) + "…" : summary);
    }

    public List<AuditEntry> recent(int limit) {
        return jdbc.query("select id, admin_email, action, entity_type, entity_id, summary, created_at from admin_audit_log order by id desc limit ?",
                (rs, n) -> new AuditEntry(rs.getLong("id"), rs.getString("admin_email"), rs.getString("action"), rs.getString("entity_type"),
                        rs.getString("entity_id"), rs.getString("summary"), rs.getTimestamp("created_at").toInstant()),
                limit);
    }
}
