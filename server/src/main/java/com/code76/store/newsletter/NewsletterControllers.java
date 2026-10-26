package com.code76.store.newsletter;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.accounts.security.LoginAttemptService;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.common.error.TooManyAttemptsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Locale;

/** Newsletter sign-ups: the website's form, and the list the admin sees. */
public final class NewsletterControllers {

    private NewsletterControllers() {
    }

    public record SignupRequest(
            @NotBlank(message = "is required") @Email(message = "must be an email address") @Size(max = 254) String email,
            @AssertTrue(message = "is needed to send you emails") boolean consent) {

        public SignupRequest {
            email = email == null ? null : email.trim();
        }
    }

    public record Subscriber(long id, String email, String source, OffsetDateTime createdAt) {
    }

    @RestController
    public static class SignupController {

        /** Sign-ups allowed from one address per 15 minutes, so the form can't be used to flood the list. */
        static final int PER_ADDRESS = 5;

        private final JdbcTemplate jdbc;
        private final LoginAttemptService limiter;

        public SignupController(JdbcTemplate jdbc, LoginAttemptService limiter) {
            this.jdbc = jdbc;
            this.limiter = limiter;
        }

        /** Always answers the same way, so the form never reveals whether an address was already on the list. */
        @PostMapping("/api/newsletter")
        public ResponseEntity<Void> signUp(@Valid @RequestBody SignupRequest body, HttpServletRequest request) {
            String key = "newsletter|" + request.getRemoteAddr();
            limiter.lockedFor(key, PER_ADDRESS).ifPresent(wait -> {
                throw new TooManyAttemptsException(Math.max(1, wait.toSeconds()), "Too many sign-ups from here. Please try again in a few minutes.");
            });
            limiter.recordFailure(key);
            jdbc.update("insert into newsletter_subscribers (email) values (?) on conflict ((lower(email))) do nothing",
                    body.email().toLowerCase(Locale.ROOT));
            return ResponseEntity.noContent().build();
        }
    }

    @RestController
    public static class AdminSubscribersController {

        private final JdbcTemplate jdbc;
        private final AdminAuditService audit;

        public AdminSubscribersController(JdbcTemplate jdbc, AdminAuditService audit) {
            this.jdbc = jdbc;
            this.audit = audit;
        }

        @GetMapping("/api/admin/subscribers")
        @Transactional(readOnly = true)
        public PageResponse<Subscriber> list(@RequestParam(defaultValue = "") String q, @RequestParam(defaultValue = "0") int page,
                                             @RequestParam(defaultValue = "50") int pageSize) {
            int size = Math.clamp(pageSize, 1, 200);
            int p = Math.max(0, page);
            String like = "%" + q.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            long total = jdbc.queryForObject("select count(*) from newsletter_subscribers where lower(email) like ?", Long.class, like);
            List<Subscriber> items = jdbc.query(
                    "select id, email, source, created_at from newsletter_subscribers where lower(email) like ? order by created_at desc, id desc limit ? offset ?",
                    (rs, n) -> new Subscriber(rs.getLong(1), rs.getString(2), rs.getString(3), rs.getObject(4, OffsetDateTime.class)),
                    like, size, (long) p * size);
            return new PageResponse<>(items, p, size, total, (int) Math.ceil(total / (double) size));
        }

        /** Every subscriber as a spreadsheet file, for an email service such as Mailchimp. */
        @GetMapping(value = "/api/admin/subscribers.csv", produces = "text/csv")
        @Transactional // not read-only: the download is written to the activity log
        public ResponseEntity<String> csv(@AuthenticationPrincipal AccountPrincipal admin) {
            StringBuilder out = new StringBuilder("email,signed_up\r\n");
            jdbc.query("select email, created_at from newsletter_subscribers order by created_at", rs -> {
                out.append(csvCell(rs.getString(1))).append(',').append(rs.getObject(2, OffsetDateTime.class)).append("\r\n");
            });
            audit.record(admin, "SUBSCRIBERS_EXPORTED", "newsletter", null, "Downloaded the newsletter list");
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"newsletter-subscribers.csv\"")
                    .contentType(new MediaType("text", "csv", java.nio.charset.StandardCharsets.UTF_8))
                    .body(out.toString());
        }

        /** Removes someone who asked to unsubscribe. */
        @DeleteMapping("/api/admin/subscribers/{id}")
        @Transactional
        public ResponseEntity<Void> remove(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id) {
            List<String> email = jdbc.queryForList("delete from newsletter_subscribers where id = ? returning email", String.class, id);
            if (email.isEmpty()) {
                throw new ResourceNotFoundException("That subscriber no longer exists.");
            }
            audit.record(admin, "SUBSCRIBER_REMOVED", "newsletter", id, "Removed " + email.getFirst() + " from the newsletter list");
            return ResponseEntity.noContent().build();
        }

        /** Quotes a value, and stops spreadsheet apps from treating it as a formula. */
        static String csvCell(String value) {
            String v = value.matches("^[=+\\-@\\t\\r].*") ? "'" + value : value;
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
    }
}
