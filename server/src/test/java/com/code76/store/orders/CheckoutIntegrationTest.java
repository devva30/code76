package com.code76.store.orders;

import com.code76.store.orders.service.OrderExpiryJob;
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
import org.springframework.test.web.servlet.ResultActions;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Callable;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class CheckoutIntegrationTest {

    static final String FORM_NOIR_M = "C76-FORM-NOIR-M";
    static final String ADDRESS = """
            {"fullName": "Riya Sharma", "phone": "+91 98765-43210", "line1": "12, MG Road", "line2": "",
             "city": "Bengaluru", "state": "Karnataka", "pincode": "560001"}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    OrderExpiryJob expiryJob;

    ShopTestData data;
    TestBrowser riya;
    String riyaEmail;

    @BeforeEach
    void setUp() throws Exception {
        data = new ShopTestData(jdbc);
        riyaEmail = uniqueEmail();
        riya = signedIn(riyaEmail);
    }

    @AfterEach
    void tearDown() {
        data.reset();
    }

    private static String uniqueEmail() {
        return "order+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
    }

    private TestBrowser signedIn(String email) throws Exception {
        TestBrowser browser = new TestBrowser(mvc);
        browser.register("Riya Sharma", email, "correct horse battery").andExpect(status().isCreated());
        return browser;
    }

    private static void addToBag(TestBrowser b, String slug, String color, String size, int qty) throws Exception {
        b.postJson("/api/me/cart/items", """
                {"slug": "%s", "color": "%s", "size": "%s", "quantity": %d}""".formatted(slug, color, size, qty))
                .andExpect(status().isOk());
    }

    private static ResultActions checkout(TestBrowser b, String key) throws Exception {
        return checkout(b, key, ADDRESS);
    }

    private static ResultActions checkout(TestBrowser b, String key, String address) throws Exception {
        return b.postJson("/api/me/orders", """
                {"address": %s, "idempotencyKey": "%s"}""".formatted(address, key));
    }

    private static String newKey() {
        return UUID.randomUUID().toString();
    }

    private static String orderNumber(ResultActions result) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), "$.orderNumber");
    }

    @Test
    void placingAnOrderHoldsStockSnapshotsPricesAndEmptiesTheBag() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);
        addToBag(riya, "daily-regular-tee", "white", "L", 1);
        Instant before = Instant.now();

        ResultActions placed = checkout(riya, newKey())
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.orderNumber", matchesPattern("^C76-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$")))
                .andExpect(jsonPath("$.status").value("pending_payment"))
                .andExpect(jsonPath("$.canCancel").value(true))
                .andExpect(jsonPath("$.items", hasSize(2)))
                .andExpect(jsonPath("$.items[0].productName").value("Form Oversized Tee"))
                .andExpect(jsonPath("$.items[0].colorName").value("Noir"))
                .andExpect(jsonPath("$.items[0].unitPrice.amountPaise").value(249000))
                .andExpect(jsonPath("$.subtotal.amountPaise").value(418000))
                .andExpect(jsonPath("$.shipping.amountPaise").value(0))
                .andExpect(jsonPath("$.total.amountPaise").value(418000))
                .andExpect(jsonPath("$.shippingAddress.phone").value("9876543210"))
                .andExpect(jsonPath("$.shippingAddress.line2").doesNotExist());

        // Held for about 30 minutes.
        String expiresAt = JsonPath.read(placed.andReturn().getResponse().getContentAsString(), "$.expiresAt");
        assertThat(Duration.between(before, Instant.parse(expiresAt))).isBetween(Duration.ofMinutes(29), Duration.ofMinutes(31));

        assertThat(data.reserved(FORM_NOIR_M)).isEqualTo(1);
        riya.get("/api/me/cart").andExpect(jsonPath("$.lines", hasSize(0)));
    }

    @Test
    void shippingIsChargedBelowTheThreshold() throws Exception {
        addToBag(riya, "daily-regular-tee", "white", "L", 1);

        checkout(riya, newKey())
                .andExpect(jsonPath("$.subtotal.amountPaise").value(169000))
                .andExpect(jsonPath("$.shipping.amountPaise").value(9900))
                .andExpect(jsonPath("$.total.amountPaise").value(178900));
    }

    @Test
    void pricesSentByTheBrowserAreIgnored() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);

        riya.postJson("/api/me/orders", """
                        {"address": %s, "idempotencyKey": "%s", "total": {"amountPaise": 100}, "unitPrice": 1}""".formatted(ADDRESS, newKey()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.total.amountPaise").value(258900));
    }

    @Test
    void submittingTheSameCheckoutTwiceCreatesOneOrder() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);
        String key = newKey();

        String first = orderNumber(checkout(riya, key).andExpect(status().isCreated()));
        String second = orderNumber(checkout(riya, key).andExpect(status().isOk()));

        assertThat(second).isEqualTo(first);
        assertThat(data.orderCount(riyaEmail)).isEqualTo(1);
        assertThat(data.reserved(FORM_NOIR_M)).isEqualTo(1);
    }

    @Test
    void anEmptyBagCannotBeCheckedOut() throws Exception {
        checkout(riya, newKey())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("CART_EMPTY"));
    }

    @Test
    void theAddressIsValidated() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);

        checkout(riya, newKey(), """
                {"fullName": "", "phone": "12345", "line1": "", "city": "Bengaluru", "state": "Karnataka", "pincode": "0123"}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", org.hamcrest.Matchers.hasItems(
                        "address.fullName", "address.phone", "address.line1", "address.pincode")));
        checkout(riya, newKey(), ADDRESS.replace("Karnataka", "Atlantis"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("address.state"));
        assertThat(data.reserved(FORM_NOIR_M)).isZero();
    }

    @Test
    void aBagWithProblemsIsSentBackForReviewAndNothingIsHeld() throws Exception {
        data.setStock(FORM_NOIR_M, 10);
        addToBag(riya, "form-oversized-tee", "noir", "M", 3);
        data.setStock(FORM_NOIR_M, 2);

        checkout(riya, newKey())
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("CART_NEEDS_ATTENTION"))
                .andExpect(jsonPath("$.errors[0].field").value(FORM_NOIR_M))
                .andExpect(jsonPath("$.errors[0].message").value("Only 2 left in this size."));
        assertThat(data.reserved(FORM_NOIR_M)).isZero();
        assertThat(data.orderCount(riyaEmail)).isZero();
    }

    @Test
    void whenTwoCustomersRaceForTheLastUnitExactlyOneGetsIt() throws Exception {
        data.setStock(FORM_NOIR_M, 1);
        String arjunEmail = uniqueEmail();
        TestBrowser arjun = signedIn(arjunEmail);
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);
        addToBag(arjun, "form-oversized-tee", "noir", "M", 1);
        // Fetch tokens up front so both checkouts hit the server at the same moment.
        String riyaKey = newKey();
        String arjunKey = newKey();

        CountDownLatch start = new CountDownLatch(1);
        ExecutorService pool = Executors.newFixedThreadPool(2);
        try {
            List<Callable<Integer>> attempts = new ArrayList<>();
            for (Object[] who : new Object[][] {{riya, riyaKey}, {arjun, arjunKey}}) {
                TestBrowser browser = (TestBrowser) who[0];
                String key = (String) who[1];
                String token = browser.csrfToken();
                attempts.add(() -> {
                    start.await();
                    return browser.send(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/me/orders")
                                    .contentType("application/json")
                                    .header("X-XSRF-TOKEN", token)
                                    .content("{\"address\": " + ADDRESS + ", \"idempotencyKey\": \"" + key + "\"}"))
                            .andReturn().getResponse().getStatus();
                });
            }
            List<Future<Integer>> results = new ArrayList<>();
            for (Callable<Integer> attempt : attempts) {
                results.add(pool.submit(attempt));
            }
            start.countDown();
            List<Integer> statuses = new ArrayList<>();
            for (Future<Integer> result : results) {
                statuses.add(result.get());
            }

            assertThat(statuses).containsExactlyInAnyOrder(201, 409);
            assertThat(data.reserved(FORM_NOIR_M)).isEqualTo(1);
            assertThat(data.orderCount(riyaEmail) + data.orderCount(arjunEmail)).isEqualTo(1);
        } finally {
            pool.shutdownNow();
        }
    }

    @Test
    void ordersAreListedNewestFirstAndOnlyToTheirOwner() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);
        String first = orderNumber(checkout(riya, newKey()));
        addToBag(riya, "daily-regular-tee", "white", "L", 2);
        String second = orderNumber(checkout(riya, newKey()));

        riya.get("/api/me/orders")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].orderNumber", contains(second, first)))
                .andExpect(jsonPath("$.items[0].itemCount").value(2))
                .andExpect(jsonPath("$.items[0].previewImages[0]").value("/images/products/daily-white-1.webp"))
                .andExpect(jsonPath("$.totalItems").value(2));
        riya.get("/api/me/orders/" + first).andExpect(jsonPath("$.items[0].sku").value(FORM_NOIR_M));

        TestBrowser stranger = signedIn(uniqueEmail());
        stranger.get("/api/me/orders").andExpect(jsonPath("$.items", hasSize(0)));
        stranger.get("/api/me/orders/" + first).andExpect(status().isNotFound());
        new TestBrowser(mvc).get("/api/me/orders/" + first).andExpect(status().isUnauthorized());
    }

    @Test
    void ordersKeepThePriceTheyWerePlacedAt() throws Exception {
        addToBag(riya, "daily-regular-tee", "white", "L", 1);
        String number = orderNumber(checkout(riya, newKey()));

        data.setProductPrice("daily-regular-tee", 999900);

        riya.get("/api/me/orders/" + number)
                .andExpect(jsonPath("$.items[0].unitPrice.amountPaise").value(169000))
                .andExpect(jsonPath("$.total.amountPaise").value(178900));
    }

    @Test
    void cancellingReleasesTheStockAndCanOnlyHappenOnce() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 2);
        String number = orderNumber(checkout(riya, newKey()));
        assertThat(data.reserved(FORM_NOIR_M)).isEqualTo(2);

        riya.postJson("/api/me/orders/" + number + "/cancel", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("cancelled"))
                .andExpect(jsonPath("$.canCancel").value(false))
                .andExpect(jsonPath("$.closedAt").exists());
        assertThat(data.reserved(FORM_NOIR_M)).isZero();

        riya.postJson("/api/me/orders/" + number + "/cancel", "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ORDER_NOT_CANCELLABLE"));
        assertThat(data.reserved(FORM_NOIR_M)).isZero();
    }

    @Test
    void unpaidOrdersExpireAfterTheirWindowAndReleaseStock() throws Exception {
        addToBag(riya, "form-oversized-tee", "noir", "M", 1);
        String overdue = orderNumber(checkout(riya, newKey()));
        addToBag(riya, "daily-regular-tee", "white", "L", 1);
        String stillValid = orderNumber(checkout(riya, newKey()));
        jdbc.update("update orders set expires_at = now() - interval '1 minute' where order_number = ?", overdue);

        assertThat(expiryJob.run()).isEqualTo(1);

        riya.get("/api/me/orders/" + overdue)
                .andExpect(jsonPath("$.status").value("expired"))
                .andExpect(jsonPath("$.canCancel").value(false));
        riya.get("/api/me/orders/" + stillValid).andExpect(jsonPath("$.status").value("pending_payment"));
        assertThat(data.reserved(FORM_NOIR_M)).isZero();
        assertThat(data.reserved("C76-DAILY-WHITE-L")).isEqualTo(1);
        assertThat(expiryJob.run()).isZero();
    }

    @Test
    void malformedOrderNumbersAreRejected() throws Exception {
        riya.get("/api/me/orders/not-an-order").andExpect(status().isBadRequest());
        riya.get("/api/me/orders/C76-AAAA-AAAA").andExpect(status().isNotFound());
    }
}
