package com.code76.store.newsletter;

import com.code76.store.accounts.security.LoginAttemptService;
import com.code76.store.support.AdminTestSupport;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.TestBrowser;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class NewsletterIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    LoginAttemptService limiter;

    TestBrowser visitor;

    @BeforeEach
    void setUp() {
        limiter.reset("newsletter|127.0.0.1");
        visitor = new TestBrowser(mvc);
    }

    @AfterEach
    void tearDown() {
        jdbc.update("delete from newsletter_subscribers");
        limiter.reset("newsletter|127.0.0.1");
    }

    private static String signup(String email, boolean consent) {
        return "{\"email\": \"" + email + "\", \"consent\": " + consent + "}";
    }

    @Test
    void aVisitorSignsUpAndTheAdminSeesThem() throws Exception {
        visitor.postJson("/api/newsletter", signup("  Riya@Example.com ", true)).andExpect(status().isNoContent());
        // Signing up again (any letter case) gives the same answer and doesn't add a second row.
        visitor.postJson("/api/newsletter", signup("riya@example.COM", true)).andExpect(status().isNoContent());

        TestBrowser admin = AdminTestSupport.signedInAdmin(mvc);
        admin.get("/api/admin/subscribers")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totalItems").value(1))
                .andExpect(jsonPath("$.items[0].email").value("riya@example.com"));
        admin.get("/api/admin/subscribers?q=nobody").andExpect(jsonPath("$.totalItems").value(0));
        admin.get("/api/admin/subscribers.csv")
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("newsletter-subscribers.csv")))
                .andExpect(content().string(containsString("\"riya@example.com\"")));
        admin.get("/api/admin/activity").andExpect(jsonPath("$[*].summary", hasItem("Downloaded the newsletter list")));
    }

    @Test
    void consentAndARealEmailAreNeeded() throws Exception {
        visitor.postJson("/api/newsletter", signup("riya@example.com", false))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("consent"));
        visitor.postJson("/api/newsletter", signup("not-an-email", true))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("email"));
        assertThat(jdbc.queryForObject("select count(*) from newsletter_subscribers", Long.class)).isZero();
    }

    @Test
    void oneAddressCantFloodTheList() throws Exception {
        for (int i = 0; i < NewsletterControllers.SignupController.PER_ADDRESS; i++) {
            visitor.postJson("/api/newsletter", signup("flood" + i + "@example.com", true)).andExpect(status().isNoContent());
        }
        visitor.postJson("/api/newsletter", signup("one-more@example.com", true))
                .andExpect(status().isTooManyRequests())
                .andExpect(header().exists("Retry-After"));
    }

    @Test
    void theAdminCanRemoveSomeoneWhoUnsubscribes() throws Exception {
        visitor.postJson("/api/newsletter", signup("leaving@example.com", true)).andExpect(status().isNoContent());
        TestBrowser admin = AdminTestSupport.signedInAdmin(mvc);
        String list = admin.get("/api/admin/subscribers").andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(list, "$.items[0].id").toString();

        admin.delete("/api/admin/subscribers/" + id).andExpect(status().isNoContent());
        admin.get("/api/admin/subscribers").andExpect(jsonPath("$.totalItems").value(0));
        admin.delete("/api/admin/subscribers/" + id).andExpect(status().isNotFound());
    }

    @Test
    void onlyAdminsSeeTheList() throws Exception {
        visitor.get("/api/admin/subscribers").andExpect(status().isUnauthorized());
        visitor.register("Riya", "news+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        visitor.get("/api/admin/subscribers").andExpect(status().isForbidden());
        visitor.get("/api/admin/subscribers.csv").andExpect(status().isForbidden());
    }

    @Test
    void exportedCellsCantRunAsSpreadsheetFormulas() {
        assertThat(NewsletterControllers.AdminSubscribersController.csvCell("=HYPERLINK(\"x\")@a.com")).isEqualTo("\"'=HYPERLINK(\"\"x\"\")@a.com\"");
        assertThat(NewsletterControllers.AdminSubscribersController.csvCell("riya@example.com")).isEqualTo("\"riya@example.com\"");
    }
}
