package com.code76.store.admin;

import com.code76.store.support.AdminTestSupport;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.TestBrowser;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AdminAccessIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    AdminBootstrap bootstrap;

    @Test
    void signedOutVisitorsAreAskedToSignIn() throws Exception {
        new TestBrowser(mvc).get("/api/admin/overview")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
    }

    @Test
    void customersAreForbidden() throws Exception {
        TestBrowser customer = new TestBrowser(mvc);
        customer.register("Riya", "cust+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");

        customer.get("/api/admin/overview")
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.error").value("FORBIDDEN"));
        customer.get("/api/admin/media").andExpect(status().isForbidden());
    }

    @Test
    void listedEmailsAreAdminsAndSeeTheDashboard() throws Exception {
        TestBrowser admin = AdminTestSupport.signedInAdmin(mvc);

        admin.get("/api/auth/session").andExpect(jsonPath("$.user.role").value("admin"));
        admin.get("/api/admin/overview")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.ordersToShip").isNumber())
                .andExpect(jsonPath("$.revenueLast7Days.amountPaise").isNumber())
                .andExpect(jsonPath("$.publishedProducts").value(6))
                .andExpect(jsonPath("$.lowStock").isArray());
    }

    @Test
    void removingAdminAccessTakesEffectImmediately() throws Exception {
        TestBrowser admin = AdminTestSupport.signedInAdmin(mvc);
        admin.get("/api/admin/overview").andExpect(status().isOk());
        try {
            // Same session as before; only the database changed.
            jdbc.update("update users set role = 'CUSTOMER' where email = ?", AdminTestSupport.ADMIN_EMAIL);
            admin.get("/api/admin/overview").andExpect(status().isForbidden());
        } finally {
            jdbc.update("update users set role = 'ADMIN' where email = ?", AdminTestSupport.ADMIN_EMAIL);
        }
    }

    @Test
    void startupMakesTheEmailListTheOnlySourceOfAdminAccess() throws Exception {
        AdminTestSupport.signedInAdmin(mvc);
        String sneaky = "sneaky+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        new TestBrowser(mvc).register("Sneaky", sneaky, "correct horse battery");
        jdbc.update("update users set role = 'ADMIN' where email = ?", sneaky);
        jdbc.update("update users set role = 'CUSTOMER' where email = ?", AdminTestSupport.ADMIN_EMAIL);

        bootstrap.run(null);

        assertThat(jdbc.queryForObject("select role from users where email = ?", String.class, sneaky)).isEqualTo("CUSTOMER");
        assertThat(jdbc.queryForObject("select role from users where email = ?", String.class, AdminTestSupport.ADMIN_EMAIL)).isEqualTo("ADMIN");
    }
}
