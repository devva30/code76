package com.code76.store.admin;

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
import org.springframework.test.web.servlet.ResultActions;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AdminCatalogueIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    TestBrowser admin;
    ShopTestData data;
    List<Map<String, Object>> originalRanks;

    @BeforeEach
    void setUp() throws Exception {
        admin = AdminTestSupport.signedInAdmin(mvc);
        data = new ShopTestData(jdbc);
        originalRanks = jdbc.queryForList("select id, featured_rank from products");
    }

    @AfterEach
    void tearDown() {
        data.reset(); // orders and bags first, so test products can be removed
        jdbc.update("delete from products where slug like 'test-%'");
        jdbc.update("delete from collections where slug like 'test-%'");
        jdbc.update("delete from categories where slug like 'test-%'");
        jdbc.update("delete from media_assets");
        originalRanks.forEach(r -> jdbc.update("update products set featured_rank = ? where id = ?", r.get("featured_rank"), r.get("id")));
    }

    // ---- helpers ----

    private static String body(ResultActions r) throws Exception {
        return r.andReturn().getResponse().getContentAsString();
    }

    private static <T> T read(ResultActions r, String path) throws Exception {
        return JsonPath.read(body(r), path);
    }

    private static String productJson(String name, long price, Long compareAt, String collections) {
        return """
                {"name": "%s", "subtitle": "A test tee", "description": "Made for testing.", "categorySlug": "essentials",
                 "fit": "regular", "fitLabel": "Regular fit", "pricePaise": %d, "compareAtPricePaise": %s, "newArrival": true,
                 "details": ["Soft cotton", "  ", "Ribbed neck"], "fitNotes": ["True to size"], "care": ["Cold wash"],
                 "collections": [%s]}""".formatted(name, price, compareAt == null ? "null" : compareAt, collections);
    }

    /** The id of the row with this slug in a JSON list. */
    private static long idWithSlug(ResultActions list, String slug) throws Exception {
        List<Integer> ids = JsonPath.read(body(list), "$[?(@.slug == '" + slug + "')].id");
        return ids.get(0);
    }

    private long createDraft(String name) throws Exception {
        Integer id = read(admin.postJson("/api/admin/products", productJson(name, 159900, null, "")).andExpect(status().isCreated()), "$.id");
        return id.longValue();
    }

    private String uploadImage() throws Exception {
        return read(admin.upload("/api/admin/media", "tee.png", "image/png", AdminTestSupport.image("png", 40, 50), "A test tee"), "$.url");
    }

    /** Adds one colour with a photo and size M in stock, then publishes. */
    private long publishedProduct(String name) throws Exception {
        long id = createDraft(name);
        Integer colorId = read(admin.postJson("/api/admin/products/" + id + "/colors", "{\"name\": \"Ink Blue\", \"hex\": \"#1a2b3c\"}"), "$.colors[0].id");
        admin.putJson("/api/admin/products/" + id + "/colors/" + colorId,
                "{\"name\": \"Ink Blue\", \"hex\": \"#1a2b3c\", \"images\": [{\"url\": \"" + uploadImage() + "\", \"alt\": \"Front\"}]}").andExpect(status().isOk());
        admin.putJson("/api/admin/products/" + id + "/colors/" + colorId + "/sizes",
                "{\"sizes\": [{\"size\": \"M\", \"active\": true, \"stock\": 5}]}").andExpect(status().isOk());
        admin.putJson("/api/admin/products/" + id + "/status", "{\"status\": \"published\"}").andExpect(status().isOk());
        return id;
    }

    // ---- tests ----

    @Test
    void aNewProductStartsAsAHiddenDraft() throws Exception {
        long id = createDraft("Test Linen Tee");

        admin.get("/api/admin/products/" + id)
                .andExpect(jsonPath("$.slug").value("test-linen-tee"))
                .andExpect(jsonPath("$.status").value("draft"))
                .andExpect(jsonPath("$.details", contains("Soft cotton", "Ribbed neck")))
                .andExpect(jsonPath("$.price.amountPaise").value(159900));
        mvc.perform(get("/api/products/test-linen-tee")).andExpect(status().isNotFound());
        admin.get("/api/admin/activity").andExpect(jsonPath("$[0].summary").value("Created product Test Linen Tee (draft)"));
    }

    @Test
    void aProductCantGoLiveUntilItHasAColourAPhotoAndASize() throws Exception {
        long id = createDraft("Test Incomplete Tee");

        admin.putJson("/api/admin/products/" + id + "/status", "{\"status\": \"published\"}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("NOT_READY_TO_PUBLISH"))
                .andExpect(jsonPath("$.errors[0].message").value("Add at least one colour."));

        Integer colorId = read(admin.postJson("/api/admin/products/" + id + "/colors", "{\"name\": \"Sage\", \"hex\": \"#8a9a7b\"}"), "$.colors[0].id");
        admin.putJson("/api/admin/products/" + id + "/status", "{\"status\": \"published\"}")
                .andExpect(jsonPath("$.errors[0].message").value("At least one colour needs a photo and at least one size switched on."));
        assertThat(colorId).isNotNull();
    }

    @Test
    void aPublishedProductAppearsInTheShopWithItsUploadedPhotoAndSizes() throws Exception {
        long id = publishedProduct("Test Studio Tee");
        Integer colorId = read(admin.get("/api/admin/products/" + id), "$.colors[0].id");
        admin.putJson("/api/admin/products/" + id + "/colors/" + colorId + "/sizes", """
                {"sizes": [{"size": "XXS", "active": true, "stock": 2}, {"size": "XXXL", "active": true, "stock": 3, "pricePaise": 179900}]}""")
                .andExpect(jsonPath("$.colors[0].sizes[*].size", contains("XXS", "M", "XXXL")))
                .andExpect(jsonPath("$.colors[0].sizes[2].sku").value("C76-TEST-INK-BLUE-XXXL"));

        mvc.perform(get("/api/products/test-studio-tee"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sizes", contains("XXS", "M", "XXXL")))
                .andExpect(jsonPath("$.colorways[0].name").value("Ink Blue"))
                .andExpect(jsonPath("$.colorways[0].hex").value("#1A2B3C"))
                .andExpect(jsonPath("$.colorways[0].images[0].url").value(org.hamcrest.Matchers.startsWith("/media/")));
        mvc.perform(get("/api/facets")).andExpect(jsonPath("$.sizes", hasItem("XXXL"))).andExpect(jsonPath("$.colors[*].name", hasItem("Ink Blue")));
        mvc.perform(get("/api/products").param("slugs", "test-studio-tee,form-oversized-tee").param("pageSize", "48"))
                .andExpect(jsonPath("$.totalItems").value(2));
    }

    @Test
    void archivingHidesAProductFromTheShop() throws Exception {
        long id = publishedProduct("Test Archive Tee");
        admin.putJson("/api/admin/products/" + id + "/status", "{\"status\": \"archived\"}").andExpect(jsonPath("$.status").value("archived"));
        mvc.perform(get("/api/products/test-archive-tee")).andExpect(status().isNotFound());
    }

    @Test
    void stockCantBeSetBelowWhatsHeldForUnpaidOrders() throws Exception {
        long id = publishedProduct("Test Held Tee");
        Integer colorId = read(admin.get("/api/admin/products/" + id), "$.colors[0].id");
        jdbc.update("update inventory set quantity_reserved = 3 where variant_id = (select id from product_variants where sku = 'C76-TEST-INK-BLUE-M')");

        admin.putJson("/api/admin/products/" + id + "/colors/" + colorId + "/sizes", "{\"sizes\": [{\"size\": \"M\", \"active\": true, \"stock\": 1}]}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.errors[0].message").value("3 are held for unpaid orders, so stock can't go below 3."));
    }

    @Test
    void theWasPriceMustBeHigherAndImagesMustBeOurs() throws Exception {
        admin.postJson("/api/admin/products", productJson("Test Bad Price", 200000, 150000L, ""))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors[0].field").value("compareAtPricePaise"));

        long id = createDraft("Test Image Rules");
        Integer colorId = read(admin.postJson("/api/admin/products/" + id + "/colors", "{\"name\": \"Red\", \"hex\": \"#ff0000\"}"), "$.colors[0].id");
        for (String bad : List.of("https://evil.example/pixel.png", "javascript:alert(1)", "/media/doesnotexist000000.png")) {
            admin.putJson("/api/admin/products/" + id + "/colors/" + colorId,
                    "{\"name\": \"Red\", \"hex\": \"#ff0000\", \"images\": [{\"url\": \"" + bad + "\", \"alt\": \"\"}]}")
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].field").value("images[0].url"));
        }
        admin.putJson("/api/admin/products/" + id + "/colors/" + colorId,
                "{\"name\": \"Red\", \"hex\": \"#ff0000\", \"images\": [{\"url\": \"/images/products/form-noir-1.webp\", \"alt\": \"Bundled photo\"}]}")
                .andExpect(status().isOk());
    }

    @Test
    void dragOrderBecomesTheShopsFeaturedOrder() throws Exception {
        List<Integer> ids = JsonPath.read(body(admin.get("/api/admin/products")), "$[*].id");
        List<Integer> reversed = new java.util.ArrayList<>(ids);
        java.util.Collections.reverse(reversed);

        admin.putJson("/api/admin/products/order", "{\"ids\": " + reversed + "}").andExpect(status().isOk());

        String firstSlug = JsonPath.read(body(admin.get("/api/admin/products")), "$[0].slug");
        mvc.perform(get("/api/products")).andExpect(jsonPath("$.items[0].slug").value(firstSlug));
        assertThat(firstSlug).isEqualTo("field-oversized-tee");
    }

    @Test
    void orderedProductsAreArchivedNotDeleted() throws Exception {
        long id = publishedProduct("Test Ordered Tee");
        TestBrowser shopper = new TestBrowser(mvc);
        shopper.register("Riya", "ord+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        shopper.postJson("/api/me/cart/items", "{\"slug\": \"test-ordered-tee\", \"color\": \"ink-blue\", \"size\": \"M\", \"quantity\": 1}").andExpect(status().isOk());
        shopper.postJson("/api/me/orders", """
                {"address": {"fullName": "Riya", "phone": "9876543210", "line1": "1 Road", "city": "Pune", "state": "Maharashtra", "pincode": "411001"},
                 "idempotencyKey": "%s"}""".formatted(UUID.randomUUID())).andExpect(status().isCreated());

        admin.delete("/api/admin/products/" + id).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("HAS_ORDERS"));

        long draft = createDraft("Test Deletable Tee");
        admin.delete("/api/admin/products/" + draft).andExpect(status().isNoContent());
        admin.get("/api/admin/products/" + draft).andExpect(status().isNotFound());
    }

    @Test
    void aCompleteProductWithoutOrdersCanBeDeleted() throws Exception {
        long id = publishedProduct("Test Complete Tee"); // colour, photo, size M with stock
        admin.putJson("/api/admin/products/" + id + "/status", "{\"status\": \"archived\"}").andExpect(status().isOk());

        admin.delete("/api/admin/products/" + id).andExpect(status().isNoContent());
        admin.get("/api/admin/products/" + id).andExpect(status().isNotFound());
        assertThat(jdbc.queryForObject("select count(*) from product_variants where product_id = ?", Long.class, id)).isZero();
    }

    @Test
    void collectionsCarryTheirOwnBannerAndCopy() throws Exception {
        String banner = uploadImage();
        admin.postJson("/api/admin/collections", """
                {"slug": "test-summer", "name": "Summer Edit", "description": "Light tees", "sortOrder": 50, "active": true,
                 "eyebrow": "Season", "intro": "Tees for hot days.", "bannerUrl": "%s", "bannerAlt": "Beach"}""".formatted(banner))
                .andExpect(status().isCreated());
        long id = createDraft("Test Summer Tee");
        admin.putJson("/api/admin/products/" + id, productJson("Test Summer Tee", 159900, null, "\"test-summer\"")).andExpect(status().isOk());

        mvc.perform(get("/api/collections"))
                .andExpect(jsonPath("$[?(@.slug == 'test-summer')].eyebrow", contains("Season")))
                .andExpect(jsonPath("$[?(@.slug == 'test-summer')].banner.url", contains(banner)));
        admin.get("/api/admin/media").andExpect(status().isOk());
        String mediaId = JsonPath.read(body(admin.get("/api/admin/media")), "$.items[0].id").toString();
        admin.delete("/api/admin/media/" + mediaId).andExpect(status().isConflict()); // banner still uses it

        long collectionId = idWithSlug(admin.get("/api/admin/collections"), "test-summer");
        admin.delete("/api/admin/collections/" + collectionId).andExpect(status().isNoContent());
        admin.get("/api/admin/products/" + id).andExpect(jsonPath("$.collections").isEmpty());
    }

    @Test
    void categoriesInUseCantBeDeleted() throws Exception {
        admin.postJson("/api/admin/categories", "{\"slug\": \"test-graphic\", \"name\": \"Test Graphic\", \"sortOrder\": 9}").andExpect(status().isCreated());
        long essentialsId = idWithSlug(admin.get("/api/admin/categories"), "essentials");

        admin.delete("/api/admin/categories/" + essentialsId).andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("CATEGORY_IN_USE"));
        mvc.perform(get("/api/categories")).andExpect(jsonPath("$[*].slug", hasItem("test-graphic")));
    }

    @Test
    void customersCantChangeTheCatalogue() throws Exception {
        TestBrowser customer = new TestBrowser(mvc);
        customer.register("Riya", "cat+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");
        customer.postJson("/api/admin/products", productJson("Test Sneaky", 100, null, "")).andExpect(status().isForbidden());
        mvc.perform(get("/api/products").param("pageSize", "48")).andExpect(jsonPath("$.items[*].slug", not(hasItem("test-sneaky"))));
    }
}
