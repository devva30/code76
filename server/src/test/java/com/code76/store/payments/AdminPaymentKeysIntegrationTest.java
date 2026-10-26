package com.code76.store.payments;

import com.code76.store.payments.gateway.RazorpaySignatures;
import com.code76.store.support.AdminTestSupport;
import com.code76.store.support.FakeRazorpayGateway;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.ShopTestData;
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
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AdminPaymentKeysIntegrationTest {

    static final String SKU = "C76-FORM-NOIR-M";
    static final String NEW_KEY = "rzp_test_adminpanel0001";
    static final String NEW_SECRET = "secret_entered_in_admin_panel";
    static final String ADDRESS = """
            {"fullName": "Riya Sharma", "phone": "9876543210", "line1": "12, MG Road",
             "city": "Bengaluru", "state": "Karnataka", "pincode": "560001"}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeRazorpayGateway razorpay;

    TestBrowser admin;
    ShopTestData data;

    @BeforeEach
    void setUp() throws Exception {
        admin = AdminTestSupport.signedInAdmin(mvc);
        data = new ShopTestData(jdbc);
        data.setStock(SKU, 20);
        razorpay.reset();
    }

    @AfterEach
    void tearDown() throws Exception {
        // Back to the environment keys, through the real endpoint so the cache is refreshed too.
        admin.postJson("/api/admin/settings/payments/remove", "{\"currentPassword\": \"" + AdminTestSupport.ADMIN_PASSWORD + "\"}");
        data.reset();
    }

    private String saveBody(String keyId, String secret, String password) {
        return """
                {"keyId": "%s", "keySecret": "%s", "webhookSecret": "", "removeWebhookSecret": false, "currentPassword": "%s"}"""
                .formatted(keyId, secret, password);
    }

    @Test
    void withNothingSavedTheServerSettingsAreUsedAndSecretsAreNeverShown() throws Exception {
        admin.get("/api/admin/settings/payments")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("server"))
                .andExpect(jsonPath("$.keyId").value("rzp_test_fakekey00001"))
                .andExpect(jsonPath("$.mode").value("test"))
                .andExpect(jsonPath("$.secretSaved").value(true))
                .andExpect(jsonPath("$.webhookPath").value("/api/webhooks/razorpay"))
                .andExpect(jsonPath("$.canSave").value(true))
                .andExpect(content().string(not(containsString("fake_key_secret_for_tests"))));
    }

    @Test
    void keysSavedInTheAdminAreUsedForTheNextCustomerPayment() throws Exception {
        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, AdminTestSupport.ADMIN_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("admin"))
                .andExpect(jsonPath("$.keyId").value(NEW_KEY))
                .andExpect(content().string(not(containsString(NEW_SECRET))));

        // Stored encrypted, never as plain text.
        String stored = jdbc.queryForObject("select key_secret_enc from payment_keys where id = 1", String.class);
        assertThat(stored).startsWith("v1:").doesNotContain(NEW_SECRET);

        // A customer pays: checkout gets the new key, and the payment is verified with the new secret.
        TestBrowser riya = new TestBrowser(mvc);
        riya.register("Riya Sharma", "keys+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery")
                .andExpect(status().isCreated());
        riya.postJson("/api/me/cart/items", "{\"slug\": \"form-oversized-tee\", \"color\": \"noir\", \"size\": \"M\", \"quantity\": 1}")
                .andExpect(status().isOk());
        String number = JsonPath.read(riya.postJson("/api/me/orders", "{\"address\": " + ADDRESS + ", \"idempotencyKey\": \"" + UUID.randomUUID() + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString(), "$.orderNumber");
        String session = riya.postJson("/api/me/orders/" + number + "/payment", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keyId").value(NEW_KEY))
                .andReturn().getResponse().getContentAsString();
        String rzpOrder = JsonPath.read(session, "$.razorpayOrderId");
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        String oldSignature = RazorpaySignatures.hmacHex(rzpOrder + "|" + rzpPayment, "fake_key_secret_for_tests");
        riya.postJson("/api/me/orders/" + number + "/payment/verify", """
                {"razorpayOrderId": "%s", "razorpayPaymentId": "%s", "razorpaySignature": "%s"}""".formatted(rzpOrder, rzpPayment, oldSignature))
                .andExpect(status().isBadRequest());
        String newSignature = RazorpaySignatures.hmacHex(rzpOrder + "|" + rzpPayment, NEW_SECRET);
        riya.postJson("/api/me/orders/" + number + "/payment/verify", """
                {"razorpayOrderId": "%s", "razorpayPaymentId": "%s", "razorpaySignature": "%s"}""".formatted(rzpOrder, rzpPayment, newSignature))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("confirmed"));
    }

    @Test
    void changingKeysNeedsTheAdminsPasswordAndIsLogged() throws Exception {
        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("currentPassword"));
        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, "not my password"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].message").value("is not correct"));
        admin.get("/api/admin/settings/payments").andExpect(jsonPath("$.source").value("server"));

        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, AdminTestSupport.ADMIN_PASSWORD)).andExpect(status().isOk());
        admin.get("/api/admin/activity")
                .andExpect(jsonPath("$[0].action").value("PAYMENT_KEYS_CHANGED"))
                .andExpect(jsonPath("$[0].summary", not(containsString(NEW_SECRET))));
    }

    @Test
    void liveKeysAndMalformedKeysAreRefusedOutsideProduction() throws Exception {
        admin.putJson("/api/admin/settings/payments", saveBody("rzp_live_abcdef123456", NEW_SECRET, AdminTestSupport.ADMIN_PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("keyId"))
                .andExpect(jsonPath("$.errors[0].message", containsString("LIVE")));
        admin.putJson("/api/admin/settings/payments", saveBody("pk_something", NEW_SECRET, AdminTestSupport.ADMIN_PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("keyId"));
        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, "", AdminTestSupport.ADMIN_PASSWORD))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("keySecret"));
    }

    @Test
    void theSecretCanBeLeftBlankToKeepTheSavedOne() throws Exception {
        admin.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, AdminTestSupport.ADMIN_PASSWORD)).andExpect(status().isOk());
        String before = jdbc.queryForObject("select key_secret_enc from payment_keys where id = 1", String.class);
        admin.putJson("/api/admin/settings/payments", """
                {"keyId": "%s", "keySecret": "", "webhookSecret": "whsec_for_admin_test", "removeWebhookSecret": false, "currentPassword": "%s"}"""
                .formatted(NEW_KEY, AdminTestSupport.ADMIN_PASSWORD))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.secretSaved").value(true))
                .andExpect(jsonPath("$.webhookSecretSaved").value(true));
        assertThat(jdbc.queryForObject("select key_secret_enc from payment_keys where id = 1", String.class)).isNotEqualTo(before); // re-encrypted, fresh IV
    }

    @Test
    void customersCannotSeeOrChangeTheKeys() throws Exception {
        TestBrowser customer = new TestBrowser(mvc);
        customer.register("Riya", "nokeys+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        customer.get("/api/admin/settings/payments").andExpect(status().isForbidden());
        customer.putJson("/api/admin/settings/payments", saveBody(NEW_KEY, NEW_SECRET, "correct horse battery")).andExpect(status().isForbidden());
    }
}
