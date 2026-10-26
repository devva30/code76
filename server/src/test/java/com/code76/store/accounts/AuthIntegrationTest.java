package com.code76.store.accounts;

import com.code76.store.support.IntegrationTest;
import com.code76.store.support.TestBrowser;
import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AuthIntegrationTest {

    private static final String PASSWORD = "correct horse battery";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    TestBrowser browser;

    @BeforeEach
    void newBrowser() {
        browser = new TestBrowser(mvc);
    }

    /** Every test uses its own address so tests never collide in the shared database. */
    private static String uniqueEmail() {
        return "riya+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    @Test
    void visitorsStartSignedOut() throws Exception {
        browser.get("/api/auth/session")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.authenticated").value(false))
                .andExpect(jsonPath("$.user").doesNotExist());
    }

    @Test
    void signUpCreatesTheAccountAndSignsIn() throws Exception {
        String email = uniqueEmail();

        browser.register("  Riya Sharma ", "  " + email.toUpperCase() + " ", PASSWORD)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Riya Sharma"))
                .andExpect(jsonPath("$.email").value(email))
                .andExpect(jsonPath("$.role").value("customer"))
                .andExpect(jsonPath("$.memberSince", notNullValue()))
                .andExpect(jsonPath("$.password").doesNotExist())
                .andExpect(jsonPath("$.passwordHash").doesNotExist());

        browser.get("/api/auth/session")
                .andExpect(jsonPath("$.authenticated").value(true))
                .andExpect(jsonPath("$.user.email").value(email));
    }

    @Test
    void passwordsAreStoredOnlyAsBcryptHashes() throws Exception {
        String email = uniqueEmail();
        browser.register("Riya", email, PASSWORD).andExpect(status().isCreated());

        String stored = jdbc.queryForObject("select password_hash from users where email = ?", String.class, email);

        assertThat(stored).startsWith("{bcrypt}$2").doesNotContain(PASSWORD);
    }

    @Test
    void sessionCookieIsHttpOnlyAndSameSite() throws Exception {
        browser.register("Riya", uniqueEmail(), PASSWORD)
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.allOf(
                        org.hamcrest.Matchers.containsString(TestBrowser.SESSION_COOKIE + "="),
                        org.hamcrest.Matchers.containsString("HttpOnly"),
                        org.hamcrest.Matchers.containsString("SameSite=Lax"))));
    }

    @Test
    void anEmailCanOnlyBeRegisteredOnceRegardlessOfCase() throws Exception {
        String email = uniqueEmail();
        browser.register("Riya", email, PASSWORD).andExpect(status().isCreated());

        new TestBrowser(mvc).register("Someone Else", email.toUpperCase(), "another password")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("EMAIL_TAKEN"));
    }

    @Test
    void signUpValidatesEveryField() throws Exception {
        browser.postJson("/api/auth/register", """
                        {"name": "  ", "email": "not-an-email", "password": "short"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[*].field", containsInAnyOrder("name", "email", "email", "password")));
    }

    @Test
    void passwordsLongerThan72BytesAreRejected() throws Exception {
        // 35 characters (allowed), but 105 bytes in UTF-8: bcrypt would silently ignore the end of it.
        browser.register("Riya", uniqueEmail(), "पासवर्ड".repeat(5))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("password"));
    }

    @Test
    void signInWorksAndIssuesANewSessionId() throws Exception {
        String email = uniqueEmail();
        new TestBrowser(mvc).register("Riya", email, PASSWORD);

        browser.csrfToken(); // creates an anonymous session first
        Cookie before = browser.sessionCookie();

        browser.login(email.toUpperCase(), PASSWORD)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value(email));

        // A new id on sign-in means a session id planted before sign-in is useless (session fixation).
        assertThat(browser.sessionCookie()).isNotNull();
        assertThat(browser.sessionCookie().getValue()).isNotEqualTo(before.getValue());
        browser.get("/api/auth/session").andExpect(jsonPath("$.authenticated").value(true));
    }

    @Test
    void wrongPasswordAndUnknownEmailGetTheSameVagueAnswer() throws Exception {
        String email = uniqueEmail();
        new TestBrowser(mvc).register("Riya", email, PASSWORD);

        browser.login(email, "wrong password")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("INVALID_CREDENTIALS"))
                .andExpect(jsonPath("$.message").value("Email or password is incorrect."));
        browser.login(uniqueEmail(), PASSWORD)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("Email or password is incorrect."));
        browser.get("/api/auth/session").andExpect(jsonPath("$.authenticated").value(false));
    }

    @Test
    void repeatedWrongPasswordsLockSignInForThatEmail() throws Exception {
        String email = uniqueEmail();
        new TestBrowser(mvc).register("Riya", email, PASSWORD);

        for (int i = 0; i < 5; i++) {
            browser.login(email, "guess " + i).andExpect(status().isUnauthorized());
        }
        // Even the right password is refused while locked.
        browser.login(email, PASSWORD)
                .andExpect(status().isTooManyRequests())
                .andExpect(jsonPath("$.error").value("TOO_MANY_ATTEMPTS"))
                .andExpect(header().exists(HttpHeaders.RETRY_AFTER));
    }

    @Test
    void disabledAccountsCannotSignIn() throws Exception {
        String email = uniqueEmail();
        new TestBrowser(mvc).register("Riya", email, PASSWORD);
        jdbc.update("update users set enabled = false where email = ?", email);

        browser.login(email, PASSWORD).andExpect(status().isUnauthorized());
    }

    @Test
    void signOutEndsTheSessionForGood() throws Exception {
        browser.register("Riya", uniqueEmail(), PASSWORD).andExpect(status().isCreated());
        Cookie signedInCookie = browser.sessionCookie();

        browser.logout().andExpect(status().isNoContent());
        browser.get("/api/auth/session").andExpect(jsonPath("$.authenticated").value(false));

        // Replaying the old cookie (e.g. a copy someone stole) no longer works.
        mvc.perform(get("/api/me/wishlist").cookie(signedInCookie))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void writesWithoutTheCsrfTokenAreRefused() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"a@b.co\", \"password\": \"whatever1\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("CSRF_TOKEN_INVALID"));
    }

    @Test
    void malformedJsonIsA400NotA500() throws Exception {
        browser.postJson("/api/auth/login", "{ this is not json")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("MALFORMED_REQUEST"));
    }
}
