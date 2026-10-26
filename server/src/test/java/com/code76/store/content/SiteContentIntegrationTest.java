package com.code76.store.content;

import com.code76.store.settings.StoreSettingsService;
import com.code76.store.support.AdminTestSupport;
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
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class SiteContentIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    JsonMapper json;

    @Autowired
    SiteContentService content;

    @Autowired
    ContentValidator validator;

    @Autowired
    StoreSettingsService settings;

    TestBrowser admin;

    @BeforeEach
    void setUp() throws Exception {
        admin = AdminTestSupport.signedInAdmin(mvc);
    }

    @AfterEach
    void tearDown() {
        new ShopTestData(jdbc).reset();
        jdbc.update("delete from site_content");
        content.run(null); // back to the original content
        jdbc.update("""
                update store_settings set store_name = 'CODE76', tagline = 'Everyday, redefined.', support_email = 'support@code76.example',
                free_shipping_threshold_paise = 299900, shipping_fee_paise = 9900, max_quantity_per_line = 10, max_cart_lines = 20,
                payment_window_minutes = 30 where id = 1""");
        settings.refresh();
        jdbc.update("delete from media_assets");
    }

    private Map<String, Object> section(String key) throws Exception {
        String body = admin.get("/api/admin/content").andReturn().getResponse().getContentAsString();
        Map<String, Object> all = json.readValue(body, new TypeReference<Map<String, Object>>() {
        });
        @SuppressWarnings("unchecked") Map<String, Object> contentByKey = (Map<String, Object>) all.get("content");
        @SuppressWarnings("unchecked") Map<String, Object> s = (Map<String, Object>) contentByKey.get(key);
        return s;
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> firstSlide(Map<String, Object> hero) {
        return ((List<Map<String, Object>>) hero.get("slides")).getFirst();
    }

    @Test
    void theOriginalContentPassesItsOwnRules() throws Exception {
        Map<String, Object> all = content.all();
        for (ContentSchema.Section section : ContentSchema.SECTIONS) {
            assertThat(all).containsKey(section.key());
            ContentValidator.Result result = validator.validate(section, (Map<?, ?>) all.get(section.key()));
            assertThat(result.problems()).as("problems in default content for " + section.key()).isEmpty();
        }
    }

    @Test
    void theStorefrontGetsEverythingInOneRequest() throws Exception {
        mvc.perform(get("/api/site"))
                .andExpect(status().isOk())
                .andExpect(header().string("Cache-Control", containsString("no-cache")))
                .andExpect(jsonPath("$.settings.storeName").value("CODE76"))
                .andExpect(jsonPath("$.settings.freeShippingThreshold.amountPaise").value(299900))
                .andExpect(jsonPath("$.content['home.hero'].slides", hasSize(4)))
                .andExpect(jsonPath("$.content['site.footer'].columns[0].title").value("Shop"))
                .andExpect(jsonPath("$.content['page.about'].policies[*].anchor", hasItem("privacy")));
    }

    @Test
    void anEditShowsOnTheSiteStraightAway() throws Exception {
        Map<String, Object> hero = section("home.hero");
        firstSlide(hero).put("line1", "Monsoon,");
        firstSlide(hero).put("unexpected", "dropped"); // unknown fields are not stored

        admin.putJson("/api/admin/content/home.hero", json.writeValueAsString(hero))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.slides[0].line1").value("Monsoon,"))
                .andExpect(jsonPath("$.slides[0].unexpected").doesNotExist());

        mvc.perform(get("/api/site")).andExpect(jsonPath("$.content['home.hero'].slides[0].line1").value("Monsoon,"));
        admin.get("/api/admin/activity").andExpect(jsonPath("$[0].summary").value("Edited website section “Banner slideshow”"));
    }

    @Test
    void unsafeOrBrokenContentIsRefusedWithThePlaceToFix() throws Exception {
        Map<String, Object> hero = section("home.hero");
        firstSlide(hero).put("ctaLink", "javascript:alert(1)");
        firstSlide(hero).put("image", "https://evil.example/tracker.png");
        firstSlide(hero).put("line1", "x".repeat(41));
        firstSlide(hero).put("position", "left");

        admin.putJson("/api/admin/content/home.hero", json.writeValueAsString(hero))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("CONTENT_INVALID"))
                .andExpect(jsonPath("$.errors[*].field", hasItem("slides[0].ctaLink")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("slides[0].image")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("slides[0].line1")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("slides[0].position")));

        Map<String, Object> signature = section("home.signature");
        signature.put("productSlug", "no-such-tee");
        admin.putJson("/api/admin/content/home.signature", json.writeValueAsString(signature))
                .andExpect(jsonPath("$.errors[0].field").value("productSlug"));

        mvc.perform(get("/api/site")).andExpect(jsonPath("$.content['home.hero'].slides[0].ctaLink").value("/shop"));
    }

    @Test
    void linksCanBeSitePagesSecureAddressesOrEmail() {
        assertThat(ContentValidator.isSafeLink("/about#shipping")).isTrue();
        assertThat(ContentValidator.isSafeLink("https://instagram.com/code76")).isTrue();
        assertThat(ContentValidator.isSafeLink("mailto:hello@code76.in")).isTrue();
        assertThat(ContentValidator.isSafeLink("//evil.example")).isFalse();
        assertThat(ContentValidator.isSafeLink("http://insecure.example")).isFalse();
        assertThat(ContentValidator.isSafeLink("javascript:alert(1)")).isFalse();
        assertThat(ContentValidator.isSafeLink("data:text/html,hi")).isFalse();
    }

    @Test
    void resetPutsTheOriginalBack() throws Exception {
        admin.putJson("/api/admin/content/site.announcements", "{\"items\": [\"Sale ends Sunday\"], \"link\": \"/shop\"}").andExpect(status().isOk());
        mvc.perform(get("/api/site")).andExpect(jsonPath("$.content['site.announcements'].items", hasSize(1)));

        admin.postJson("/api/admin/content/site.announcements/reset", "{}").andExpect(jsonPath("$.items", hasSize(3)));
        mvc.perform(get("/api/site")).andExpect(jsonPath("$.content['site.announcements'].items[0]").value("Roll 01 is live — shop the new drop"));
    }

    @Test
    void anImageShownOnTheSiteCantBeDeletedFromTheLibrary() throws Exception {
        String uploaded = admin.upload("/api/admin/media", "banner.png", "image/png", AdminTestSupport.image("png", 60, 40), "Banner")
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(uploaded, "$.url");
        String id = JsonPath.read(uploaded, "$.id").toString();
        Map<String, Object> hero = section("home.hero");
        firstSlide(hero).put("image", url);
        admin.putJson("/api/admin/content/home.hero", json.writeValueAsString(hero)).andExpect(status().isOk());

        admin.delete("/api/admin/media/" + id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].message").value("Website: Banner slideshow"));
    }

    @Test
    void aFieldAddedInALaterVersionStartsWithItsOriginalValue() throws Exception {
        // A header saved before the drop-down headline field existed.
        jdbc.update("update site_content set content = ?::jsonb where key = 'site.header'",
                "{\"nav\": [{\"label\": \"Shop\", \"link\": \"/shop\", \"showPanel\": false}], \"panel\": []}");

        mvc.perform(get("/api/site"))
                .andExpect(jsonPath("$.content['site.header'].nav", hasSize(1)))
                .andExpect(jsonPath("$.content['site.header'].panelTitle").value("Two silhouettes. One considered wardrobe."));
    }

    @Test
    void unknownSectionsAndCustomersAreTurnedAway() throws Exception {
        admin.putJson("/api/admin/content/home.nope", "{}").andExpect(status().isNotFound());
        TestBrowser customer = new TestBrowser(mvc);
        customer.register("Riya", "cms+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        customer.putJson("/api/admin/content/home.hero", "{}").andExpect(status().isForbidden());
        customer.get("/api/admin/settings").andExpect(status().isForbidden());
    }

    @Test
    void storeSettingsDriveCheckout() throws Exception {
        admin.putJson("/api/admin/settings", """
                        {"storeName": "CODE76", "tagline": "Everyday, redefined.", "supportEmail": "hello@code76.in",
                         "freeShippingThresholdPaise": 500000, "shippingFeePaise": 4900, "maxQuantityPerLine": 5, "maxCartLines": 20,
                         "paymentWindowMinutes": 15}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.supportEmail").value("hello@code76.in"));

        mvc.perform(get("/api/site"))
                .andExpect(jsonPath("$.settings.supportEmail").value("hello@code76.in"))
                .andExpect(jsonPath("$.settings.shippingFee.amountPaise").value(4900));

        TestBrowser shopper = new TestBrowser(mvc);
        shopper.register("Riya", "ship+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        shopper.postJson("/api/me/cart/items", "{\"slug\": \"form-oversized-tee\", \"color\": \"noir\", \"size\": \"M\", \"quantity\": 9}")
                .andExpect(jsonPath("$.lines[0].quantity").value(5)) // the new per-item limit
                .andExpect(jsonPath("$.shipping.amountPaise").value(0)); // 5 × ₹2,490 is over ₹5,000
        shopper.putJson("/api/me/cart/items/C76-FORM-NOIR-M", "{\"quantity\": 1}")
                .andExpect(jsonPath("$.shipping.amountPaise").value(4900))
                .andExpect(jsonPath("$.freeShippingThreshold.amountPaise").value(500000));
    }

    @Test
    void settingsAreValidated() throws Exception {
        admin.putJson("/api/admin/settings", """
                        {"storeName": "", "tagline": "x", "supportEmail": "not-an-email", "freeShippingThresholdPaise": -1,
                         "shippingFeePaise": 0, "maxQuantityPerLine": 99, "maxCartLines": 20, "paymentWindowMinutes": 1}""")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[*].field", hasItem("supportEmail")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("maxQuantityPerLine")))
                .andExpect(jsonPath("$.errors[*].field", hasItem("paymentWindowMinutes")));
    }
}
