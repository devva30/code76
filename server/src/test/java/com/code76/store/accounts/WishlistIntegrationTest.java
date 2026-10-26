package com.code76.store.accounts;

import com.code76.store.support.IntegrationTest;
import com.code76.store.support.TestBrowser;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class WishlistIntegrationTest {

    @Autowired
    MockMvc mvc;

    TestBrowser riya;

    @BeforeEach
    void signedInCustomer() throws Exception {
        riya = signedIn();
    }

    private TestBrowser signedIn() throws Exception {
        TestBrowser browser = new TestBrowser(mvc);
        browser.register("Riya", "w+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery")
                .andExpect(status().isCreated());
        return browser;
    }

    @Test
    void signedOutVisitorsCannotSeeAnyWishlist() throws Exception {
        new TestBrowser(mvc).get("/api/me/wishlist")
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        new TestBrowser(mvc).put("/api/me/wishlist/form-oversized-tee")
                .andExpect(status().isUnauthorized());
    }

    @Test
    void startsEmpty() throws Exception {
        riya.get("/api/me/wishlist")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void addListAndRemoveNewestFirst() throws Exception {
        riya.put("/api/me/wishlist/form-oversized-tee").andExpect(status().isOk());
        riya.put("/api/me/wishlist/daily-regular-tee")
                .andExpect(jsonPath("$.items[*].slug", contains("daily-regular-tee", "form-oversized-tee")))
                .andExpect(jsonPath("$.items[0].price.amountPaise").value(169000));

        riya.delete("/api/me/wishlist/daily-regular-tee")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items[*].slug", contains("form-oversized-tee")));
        riya.get("/api/me/wishlist").andExpect(jsonPath("$.items[*].slug", contains("form-oversized-tee")));
    }

    @Test
    void addingTwiceOrRemovingSomethingAbsentIsHarmless() throws Exception {
        riya.put("/api/me/wishlist/form-oversized-tee");
        riya.put("/api/me/wishlist/form-oversized-tee").andExpect(jsonPath("$.items", hasSize(1)));
        riya.delete("/api/me/wishlist/relaxed-pocket-tee")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(1)));
    }

    @Test
    void unknownProductsAndBadSlugsAreRejected() throws Exception {
        riya.put("/api/me/wishlist/no-such-tee")
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"));
        riya.put("/api/me/wishlist/Bad_Slug")
                .andExpect(status().isBadRequest());
    }

    @Test
    void mergeFoldsInABrowserWishlistSkippingUnknownsAndDuplicates() throws Exception {
        riya.put("/api/me/wishlist/form-oversized-tee");

        riya.postJson("/api/me/wishlist/merge", """
                        {"slugs": ["daily-regular-tee", "no-such-tee", "form-oversized-tee", "daily-regular-tee"]}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items", hasSize(2)));
    }

    @Test
    void mergeValidatesItsInput() throws Exception {
        riya.postJson("/api/me/wishlist/merge", "{\"slugs\": [\"Not A Slug\"]}")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
    }

    @Test
    void eachCustomerOnlySeesTheirOwnWishlist() throws Exception {
        riya.put("/api/me/wishlist/form-oversized-tee");
        TestBrowser arjun = signedIn();

        arjun.get("/api/me/wishlist").andExpect(jsonPath("$.items", hasSize(0)));
    }

    @Test
    void wishlistSurvivesSigningOutAndBackIn() throws Exception {
        TestBrowser browser = new TestBrowser(mvc);
        String email = "w+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        browser.register("Riya", email, "correct horse battery");
        browser.put("/api/me/wishlist/field-oversized-tee");
        browser.logout();

        browser.login(email, "correct horse battery").andExpect(status().isOk());
        browser.get("/api/me/wishlist").andExpect(jsonPath("$.items[*].slug", contains("field-oversized-tee")));
    }
}
