package com.code76.store.payments;

import com.code76.store.accounts.repository.UserAccountRepository;
import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.accounts.security.LoginAttemptService;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.common.error.ApiError.FieldProblem;
import com.code76.store.common.error.ApiException;
import com.code76.store.common.error.TooManyAttemptsException;
import jakarta.validation.constraints.Size;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClientResponseException;

import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.regex.Pattern;

/**
 * Razorpay keys entered in the admin. Payments always use {@link #current()}: the admin's keys when
 * saved, otherwise the server's environment settings. Changing them needs the admin's password, and
 * every change is written to the activity log, so a stolen session alone can't redirect payments.
 */
@Service
public class PaymentKeysService {

    /** What the admin page shows. Secrets are never sent back, only whether one is saved. */
    public record PaymentKeysStatus(String keyId, String mode, String source, boolean secretSaved, boolean webhookSecretSaved,
                                    String webhookPath, Instant updatedAt, String updatedBy, boolean canSave, boolean liveKeysAllowed) {
    }

    /**
     * Blank secrets keep the saved ones, so the admin never has to see or retype them.
     * A new key id always needs its matching secret.
     */
    public record SaveKeysRequest(
            @Size(max = 40) String keyId,
            @Size(max = 100) String keySecret,
            @Size(max = 100) String webhookSecret,
            boolean removeWebhookSecret,
            @Size(max = 200) String currentPassword) {
    }

    public record TestKeysRequest(@Size(max = 40) String keyId, @Size(max = 100) String keySecret) {
    }

    public record TestResult(boolean ok, String mode, String message) {
    }

    public static final String WEBHOOK_PATH = "/api/webhooks/razorpay";
    private static final Pattern KEY_ID = Pattern.compile("rzp_(test|live)_[A-Za-z0-9]{6,30}");
    private static final Pattern SECRET = Pattern.compile("[A-Za-z0-9_\\-]{8,100}");
    private static final Duration CACHE_FOR = Duration.ofSeconds(5);
    private static final Logger log = LoggerFactory.getLogger(PaymentKeysService.class);

    private final JdbcTemplate jdbc;
    private final SecretBox box;
    private final PaymentProperties env;
    private final AdminAuditService audit;
    private final UserAccountRepository users;
    private final PasswordEncoder passwords;
    private final LoginAttemptService attempts;
    private volatile PaymentKeys cached;
    private volatile Instant cachedAt = Instant.EPOCH;

    public PaymentKeysService(JdbcTemplate jdbc, SecretBox box, PaymentProperties env, AdminAuditService audit,
                              UserAccountRepository users, PasswordEncoder passwords, LoginAttemptService attempts) {
        this.jdbc = jdbc;
        this.box = box;
        this.env = env;
        this.audit = audit;
        this.users = users;
        this.passwords = passwords;
        this.attempts = attempts;
    }

    /** The keys to pay with right now. */
    public PaymentKeys current() {
        PaymentKeys k = cached;
        if (k == null || Instant.now().isAfter(cachedAt.plus(CACHE_FOR))) {
            k = load();
            cached = k;
            cachedAt = Instant.now();
        }
        return k;
    }

    @Transactional(readOnly = true)
    public PaymentKeysStatus status() {
        PaymentKeys k = current();
        List<PaymentKeysStatus> saved = jdbc.query("select updated_at, updated_by from payment_keys where id = 1",
                (rs, n) -> new PaymentKeysStatus(null, null, null, false, false, null,
                        rs.getTimestamp(1).toInstant(), rs.getString(2), false, false));
        Instant updatedAt = saved.isEmpty() ? null : saved.getFirst().updatedAt();
        String updatedBy = saved.isEmpty() ? null : saved.getFirst().updatedBy();
        return new PaymentKeysStatus(k.keyId(), k.enabled() ? (k.testMode() ? "test" : "live") : null, k.source(),
                k.keySecret() != null, k.webhookSecret() != null, WEBHOOK_PATH, updatedAt, updatedBy, box.ready(), env.allowLiveKeys());
    }

    @Transactional
    public PaymentKeysStatus save(SaveKeysRequest req, AccountPrincipal admin) {
        confirmPassword(admin, req.currentPassword());
        if (!box.ready()) {
            throw new ApiException(HttpStatus.SERVICE_UNAVAILABLE, "ENCRYPTION_KEY_MISSING",
                    "The server can't store secrets yet: add SETTINGS_ENCRYPTION_KEY to its settings file, restart it, and try again.");
        }
        PaymentKeys saved = loadSaved();
        String keyId = trim(req.keyId());
        String secret = trim(req.keySecret());
        String webhook = trim(req.webhookSecret());

        List<FieldProblem> problems = new ArrayList<>();
        if (keyId == null || !KEY_ID.matcher(keyId).matches()) {
            problems.add(new FieldProblem("keyId", "must look like rzp_test_… or rzp_live_… (copy it from Razorpay → Settings → API Keys)"));
        } else if (keyId.startsWith("rzp_live_") && !env.allowLiveKeys()) {
            problems.add(new FieldProblem("keyId", "is a LIVE key, which charges real money. Use your Test Mode key (rzp_test_…) until the store is live."));
        }
        boolean sameKey = saved != null && keyId != null && keyId.equals(saved.keyId());
        if (secret == null && !sameKey) {
            problems.add(new FieldProblem("keySecret", "is required for a new Key ID"));
        } else if (secret != null && !SECRET.matcher(secret).matches()) {
            problems.add(new FieldProblem("keySecret", "doesn't look like a Razorpay key secret"));
        }
        if (webhook != null && !SECRET.matcher(webhook).matches()) {
            problems.add(new FieldProblem("webhookSecret", "must be 8 to 100 letters, numbers, - or _"));
        }
        if (!problems.isEmpty()) {
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Some fields need attention.", problems);
        }

        String secretToStore = secret != null ? secret : saved.keySecret();
        String webhookToStore = req.removeWebhookSecret() ? null : webhook != null ? webhook : saved == null ? null : saved.webhookSecret();
        jdbc.update("""
                insert into payment_keys (id, key_id, key_secret_enc, webhook_secret_enc, updated_at, updated_by)
                values (1, ?, ?, ?, now(), ?)
                on conflict (id) do update set key_id = excluded.key_id, key_secret_enc = excluded.key_secret_enc,
                    webhook_secret_enc = excluded.webhook_secret_enc, updated_at = now(), updated_by = excluded.updated_by""",
                keyId, box.encrypt(secretToStore), webhookToStore == null ? null : box.encrypt(webhookToStore), admin.getUsername());
        audit.record(admin, "PAYMENT_KEYS_CHANGED", "settings", 1,
                "Changed the Razorpay keys (" + (keyId.startsWith("rzp_test_") ? "test" : "LIVE") + " key " + keyId + ")"
                        + (secret != null ? ", new key secret" : "")
                        + (req.removeWebhookSecret() ? ", removed webhook secret" : webhook != null ? ", new webhook secret" : ""));
        refresh();
        return status();
    }

    /** Forgets the admin's keys; payments go back to the server's environment settings (or off). */
    @Transactional
    public PaymentKeysStatus remove(AccountPrincipal admin, String currentPassword) {
        confirmPassword(admin, currentPassword);
        int removed = jdbc.update("delete from payment_keys where id = 1");
        if (removed > 0) {
            audit.record(admin, "PAYMENT_KEYS_REMOVED", "settings", 1, "Removed the Razorpay keys saved in the admin");
        }
        refresh();
        return status();
    }

    /** Asks Razorpay whether a key pair works (blank fields mean the keys in use now). Nothing is saved. */
    public TestResult test(TestKeysRequest req) {
        PaymentKeys inUse = current();
        String keyId = trim(req.keyId()) != null ? trim(req.keyId()) : inUse.keyId();
        String secret = trim(req.keySecret());
        if (secret == null && keyId != null && keyId.equals(inUse.keyId())) {
            secret = inUse.keySecret(); // testing the saved pair
        }
        if (keyId == null) {
            return new TestResult(false, null, "No keys are set yet.");
        }
        if (secret == null) {
            return new TestResult(false, null, "Enter the Key Secret for this Key ID to test it.");
        }
        if (!KEY_ID.matcher(keyId).matches()) {
            return new TestResult(false, null, "The Key ID should look like rzp_test_… or rzp_live_….");
        }
        String mode = keyId.startsWith("rzp_test_") ? "test" : "live";
        try {
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
            JdkClientHttpRequestFactory factory = new JdkClientHttpRequestFactory(client);
            factory.setReadTimeout(Duration.ofSeconds(10));
            RestClient.builder().requestFactory(factory).baseUrl(env.baseUrl())
                    .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + Base64.getEncoder()
                            .encodeToString((keyId + ":" + secret).getBytes(StandardCharsets.UTF_8)))
                    .build()
                    .get().uri("/orders?count=1").retrieve().toBodilessEntity();
            return new TestResult(true, mode, "Razorpay accepted these keys (" + mode + " mode).");
        } catch (RestClientResponseException e) {
            if (e.getStatusCode().value() == 401) {
                return new TestResult(false, mode, "Razorpay rejected these keys. Check the Key ID and Key Secret match.");
            }
            log.warn("Razorpay key check got HTTP {}", e.getStatusCode().value());
            return new TestResult(false, mode, "Razorpay answered with an error (" + e.getStatusCode().value() + "). Try again shortly.");
        } catch (RestClientException e) {
            return new TestResult(false, mode, "Couldn't reach Razorpay from the server. Check its internet connection.");
        }
    }

    private void confirmPassword(AccountPrincipal admin, String password) {
        String attemptKey = "payment-keys:" + admin.getId();
        attempts.lockedFor(attemptKey).ifPresent(wait -> {
            throw new TooManyAttemptsException(Math.max(1, wait.toSeconds()));
        });
        String hash = users.findById(admin.getId()).map(u -> u.getPasswordHash()).orElse(null);
        if (password == null || password.isEmpty() || hash == null || !passwords.matches(password, hash)) {
            attempts.recordFailure(attemptKey);
            throw new ApiException(HttpStatus.BAD_REQUEST, "VALIDATION_FAILED", "Your password is needed to change payment keys.",
                    List.of(new FieldProblem("currentPassword", password == null || password.isEmpty() ? "is required" : "is not correct")));
        }
        attempts.reset(attemptKey);
    }

    private void refresh() {
        cached = load();
        cachedAt = Instant.now();
    }

    private PaymentKeys load() {
        PaymentKeys saved = loadSaved();
        return saved != null ? saved : PaymentKeys.fromEnvironment(env);
    }

    private PaymentKeys loadSaved() {
        List<String[]> rows = jdbc.query("select key_id, key_secret_enc, webhook_secret_enc from payment_keys where id = 1",
                (rs, n) -> new String[] {rs.getString(1), rs.getString(2), rs.getString(3)});
        if (rows.isEmpty()) {
            return null;
        }
        String[] r = rows.getFirst();
        if (!box.ready()) {
            log.error("Razorpay keys are saved in the admin but SETTINGS_ENCRYPTION_KEY is missing; using the environment keys instead.");
            return null;
        }
        if (r[0].startsWith("rzp_live_") && !env.allowLiveKeys()) {
            log.error("A LIVE Razorpay key is saved in the admin, but live keys aren't allowed here; online payment is off.");
            return PaymentKeys.NONE;
        }
        try {
            return new PaymentKeys(r[0], box.decrypt(r[1]), r[2] == null ? null : box.decrypt(r[2]), "admin");
        } catch (IllegalStateException e) {
            log.error("Couldn't read the Razorpay keys saved in the admin: {}", e.getMessage());
            return PaymentKeys.NONE;
        }
    }

    private static String trim(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
