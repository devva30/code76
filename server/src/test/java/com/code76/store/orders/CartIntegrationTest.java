package com.code76.store.orders;

import com.code76.store.support.IntegrationTest;
import com.code76.store.support.ShopTestData;
import com.code76.store.support.TestBrowser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class CartIntegrationTest {

    static final String FORM_NOIR_M = "C76-FORM-NOIR-M";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    ShopTestData data;
    TestBrowser riya;

    @BeforeEach
    void setUp() throws Exception {
        data = new ShopTestData(jdbc);
        riya = signedIn();
    }

    @AfterEach
    void tearDown() {
        data.reset();
    }

    private TestBrowser signedIn() throws Exception {
        TestBrowser browser = new TestBrowser(mvc);
        browser.register("Riya", "cart+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery")
                .andExpect(status().isCreated());
        return browser;
    }

    private static ResultActions add(TestBrowser b, String slug, String color, String size, int qty) throws Exception {
        return b.postJson("/api/me/cart/items", """
                {"slug": "%s", "color": "%s", "size": "%s", "quantity": %d}""".formatted(slug, color, size, qty));
    }

    @Test
    void signedOutVisitorsHaveNoServerBag() throws Exception {
        new TestBrowser(mvc).get("/api/me/cart").andExpect(status().isUnauthorized());
    }

    @Test
    void startsEmptyAndNotReadyForCheckout() throws Exception {
        riya.get("/api/me/cart")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines", hasSize(0)))
                .andExpect(jsonPath("$.subtotal.amountPaise").value(0))
                .andExpect(jsonPath("$.shipping.amountPaise").value(0))
                .andExpect(jsonPath("$.readyForCheckout").value(false));
    }

    @Test
    void addingPricesTheLineFromTheCatalogueAndAddsShipping() throws Exception {
        add(riya, "form-oversized-tee", "noir", "M", 1)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines[0].sku").value(FORM_NOIR_M))
                .andExpect(jsonPath("$.lines[0].product.slug").value("form-oversized-tee"))
                .andExpect(jsonPath("$.lines[0].colorName").value("Noir"))
                .andExpect(jsonPath("$.lines[0].image.url").value("/images/products/form-noir-1.webp"))
                .andExpect(jsonPath("$.lines[0].unitPrice.amountPaise").value(249000))
                .andExpect(jsonPath("$.lines[0].issue").value(nullValue()))
                .andExpect(jsonPath("$.itemCount").value(1))
                .andExpect(jsonPath("$.subtotal.amountPaise").value(249000))
                .andExpect(jsonPath("$.shipping.amountPaise").value(9900))
                .andExpect(jsonPath("$.total.amountPaise").value(258900))
                .andExpect(jsonPath("$.readyForCheckout").value(true));
    }

    @Test
    void shippingIsFreeAtTheThreshold() throws Exception {
        add(riya, "form-oversized-tee", "noir", "M", 2)
                .andExpect(jsonPath("$.subtotal.amountPaise").value(498000))
                .andExpect(jsonPath("$.shipping.amountPaise").value(0))
                .andExpect(jsonPath("$.total.amountPaise").value(498000));
    }

    @Test
    void addingTheSameSizeAgainIncreasesQuantityUpToTen() throws Exception {
        data.setStock(FORM_NOIR_M, 50);
        add(riya, "form-oversized-tee", "noir", "M", 2);
        add(riya, "form-oversized-tee", "noir", "M", 3).andExpect(jsonPath("$.lines[0].quantity").value(5));
        add(riya, "form-oversized-tee", "noir", "M", 9)
                .andExpect(jsonPath("$.lines", hasSize(1)))
                .andExpect(jsonPath("$.lines[0].quantity").value(10));
    }

    @Test
    void soldOutAndLowStockSizesAreRefusedWithClearMessages() throws Exception {
        add(riya, "form-oversized-tee", "noir", "XS", 1) // XS Noir is sold out in the demo data
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("SOLD_OUT"));

        data.setStock(FORM_NOIR_M, 3);
        add(riya, "form-oversized-tee", "noir", "M", 4)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOT_ENOUGH_STOCK"))
                .andExpect(jsonPath("$.message").value("Only 3 left in this size."));
    }

    @Test
    void unknownChoicesAndBadInputAreRejected() throws Exception {
        add(riya, "form-oversized-tee", "purple", "M", 1).andExpect(status().isNotFound());
        add(riya, "no-such-tee", "noir", "M", 1).andExpect(status().isNotFound());
        add(riya, "form-oversized-tee", "noir", "M", 0)
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("quantity"));
        add(riya, "form-oversized-tee", "noir", "XXXXL", 1).andExpect(status().isBadRequest());
    }

    @Test
    void quantitiesCanBeChangedAndZeroRemovesTheLine() throws Exception {
        add(riya, "form-oversized-tee", "noir", "M", 1);
        add(riya, "daily-regular-tee", "white", "L", 1);

        riya.putJson("/api/me/cart/items/" + FORM_NOIR_M, "{\"quantity\": 3}")
                .andExpect(jsonPath("$.lines[0].quantity").value(3))
                .andExpect(jsonPath("$.itemCount").value(4));
        riya.putJson("/api/me/cart/items/" + FORM_NOIR_M, "{\"quantity\": 0}")
                .andExpect(jsonPath("$.lines[*].sku", contains("C76-DAILY-WHITE-L")));
        riya.putJson("/api/me/cart/items/" + FORM_NOIR_M, "{\"quantity\": 2}")
                .andExpect(status().isNotFound());
    }

    @Test
    void removeAndClear() throws Exception {
        add(riya, "form-oversized-tee", "noir", "M", 1);
        add(riya, "daily-regular-tee", "white", "L", 1);

        riya.delete("/api/me/cart/items/" + FORM_NOIR_M).andExpect(jsonPath("$.lines", hasSize(1)));
        riya.delete("/api/me/cart").andExpect(jsonPath("$.lines", hasSize(0)));
    }

    @Test
    void linesAreFlaggedWhenStockChangesAfterAdding() throws Exception {
        data.setStock(FORM_NOIR_M, 10);
        add(riya, "form-oversized-tee", "noir", "M", 3);

        data.setStock(FORM_NOIR_M, 1);
        riya.get("/api/me/cart")
                .andExpect(jsonPath("$.lines[0].issue").value("NOT_ENOUGH_STOCK"))
                .andExpect(jsonPath("$.lines[0].availableQuantity").value(1))
                .andExpect(jsonPath("$.readyForCheckout").value(false));

        data.setStock(FORM_NOIR_M, 0);
        riya.get("/api/me/cart").andExpect(jsonPath("$.lines[0].issue").value("SOLD_OUT"));

        data.deactivate(FORM_NOIR_M);
        riya.get("/api/me/cart").andExpect(jsonPath("$.lines[0].issue").value("UNAVAILABLE"));
    }

    @Test
    void lowStockLinesCanStillBeReduced() throws Exception {
        data.setStock(FORM_NOIR_M, 10);
        add(riya, "form-oversized-tee", "noir", "M", 3);
        data.setStock(FORM_NOIR_M, 1);

        riya.putJson("/api/me/cart/items/" + FORM_NOIR_M, "{\"quantity\": 1}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.readyForCheckout").value(true));
    }

    @Test
    void signInMergeKeepsWhatCanBeBoughtAndTrimsToStock() throws Exception {
        data.setStock(FORM_NOIR_M, 2);
        add(riya, "daily-regular-tee", "white", "L", 1);

        riya.postJson("/api/me/cart/merge", """
                        {"items": [
                          {"slug": "form-oversized-tee", "color": "noir", "size": "M", "quantity": 5},
                          {"slug": "form-oversized-tee", "color": "noir", "size": "XS", "quantity": 1},
                          {"slug": "no-such-tee", "color": "noir", "size": "M", "quantity": 1},
                          {"slug": "daily-regular-tee", "color": "white", "size": "L", "quantity": 2}
                        ]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lines", hasSize(2)))
                .andExpect(jsonPath("$.lines[?(@.sku == 'C76-DAILY-WHITE-L')].quantity", contains(3)))
                .andExpect(jsonPath("$.lines[?(@.sku == 'C76-FORM-NOIR-M')].quantity", contains(2)));
    }

    @Test
    void eachCustomerHasTheirOwnBag() throws Exception {
        add(riya, "form-oversized-tee", "noir", "M", 1);
        signedIn().get("/api/me/cart").andExpect(jsonPath("$.lines", hasSize(0)));
    }
}
