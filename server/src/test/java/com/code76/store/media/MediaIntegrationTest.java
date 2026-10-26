package com.code76.store.media;

import com.code76.store.support.AdminTestSupport;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.TestBrowser;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.matchesPattern;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class MediaIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    TestBrowser admin;
    String borrowedImageUrl;
    Long borrowedImageId;

    @BeforeEach
    void setUp() throws Exception {
        admin = AdminTestSupport.signedInAdmin(mvc);
    }

    @AfterEach
    void tearDown() {
        if (borrowedImageId != null) {
            jdbc.update("update product_images set url = ? where id = ?", borrowedImageUrl, borrowedImageId);
        }
        jdbc.update("delete from media_assets");
    }

    private ResultActions upload(String name, String type, byte[] bytes) throws Exception {
        return admin.upload("/api/admin/media", name, type, bytes, "Test image");
    }

    private String json(ResultActions result, String path) throws Exception {
        return JsonPath.read(result.andReturn().getResponse().getContentAsString(), path).toString();
    }

    @Test
    void smallerCopiesAreMadeForPhonesAndCards() throws Exception {
        byte[] png = AdminTestSupport.image("png", 800, 1000);
        String url = json(upload("big.png", "image/png", png).andExpect(status().isCreated()), "$.url");

        byte[] small = mvc.perform(get(url + "?w=320"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/jpeg"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("immutable")))
                .andReturn().getResponse().getContentAsByteArray();
        java.awt.image.BufferedImage img = javax.imageio.ImageIO.read(new java.io.ByteArrayInputStream(small));
        assertThat(img.getWidth()).isEqualTo(320);
        assertThat(img.getHeight()).isEqualTo(400);

        // Asked again: served from the one stored copy.
        mvc.perform(get(url + "?w=320")).andExpect(content().bytes(small));
        assertThat(jdbc.queryForObject("select count(*) from media_variants where width = 320", Long.class)).isEqualTo(1);

        // Widths not on the list, or not smaller than the original, get the original file.
        mvc.perform(get(url + "?w=333")).andExpect(content().bytes(png));
        mvc.perform(get(url + "?w=960")).andExpect(content().bytes(png));
    }

    @Test
    void anUploadedImageIsServedPubliciallyWithLongCaching() throws Exception {
        byte[] png = AdminTestSupport.image("png", 40, 30);

        ResultActions uploaded = upload("Summer Banner.PNG", "image/png", png)
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.url", matchesPattern("^/media/[A-Za-z0-9]{20}\\.png$")))
                .andExpect(jsonPath("$.fileName").value("summer-banner.png"))
                .andExpect(jsonPath("$.width").value(40))
                .andExpect(jsonPath("$.height").value(30))
                .andExpect(jsonPath("$.contentType").value("image/png"))
                .andExpect(jsonPath("$.altText").value("Test image"));
        String url = json(uploaded, "$.url");

        String etag = mvc.perform(get(url)) // no session at all: images are public
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, "image/png"))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("max-age=31536000")))
                .andExpect(header().string(HttpHeaders.CACHE_CONTROL, containsString("immutable")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().bytes(png))
                .andReturn().getResponse().getHeader(HttpHeaders.ETAG);

        mvc.perform(get(url).header(HttpHeaders.IF_NONE_MATCH, etag)).andExpect(status().isNotModified());
        mvc.perform(get(url.replace(".png", ".jpg"))).andExpect(status().isNotFound());
    }

    @Test
    void jpegAndWebpSizesAreReadFromTheFile() throws Exception {
        upload("photo.jpg", "image/jpeg", AdminTestSupport.image("jpg", 64, 48))
                .andExpect(jsonPath("$.contentType").value("image/jpeg"))
                .andExpect(jsonPath("$.width").value(64))
                .andExpect(jsonPath("$.height").value(48));
        upload("hero.webp", "image/webp", AdminTestSupport.webpHeader(1920, 1080))
                .andExpect(jsonPath("$.contentType").value("image/webp"))
                .andExpect(jsonPath("$.width").value(1920))
                .andExpect(jsonPath("$.height").value(1080));
    }

    @Test
    void filesThatAreNotRealImagesAreRejectedWhateverTheirName() throws Exception {
        upload("innocent.png", "image/png", "<html><script>alert(1)</script></html>".repeat(3).getBytes(StandardCharsets.UTF_8))
                .andExpect(status().isUnsupportedMediaType())
                .andExpect(jsonPath("$.error").value("UNSUPPORTED_IMAGE"));
        upload("logo.svg", "image/svg+xml", "<svg xmlns='http://www.w3.org/2000/svg' onload='alert(1)'></svg>".getBytes(StandardCharsets.UTF_8))
                .andExpect(status().isUnsupportedMediaType());
        upload("empty.png", "image/png", new byte[0]).andExpect(status().isBadRequest());
        upload("huge.png", "image/png", AdminTestSupport.pngHeader(9000, 10))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("IMAGE_TOO_BIG"));
    }

    @Test
    void customersCannotUpload() throws Exception {
        TestBrowser customer = new TestBrowser(mvc);
        customer.register("Riya", "up+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery");

        customer.upload("/api/admin/media", "x.png", "image/png", AdminTestSupport.image("png", 10, 10), "")
                .andExpect(status().isForbidden());
    }

    @Test
    void theSameFileIsStoredOnce() throws Exception {
        byte[] png = AdminTestSupport.image("png", 20, 20);
        String first = json(upload("a.png", "image/png", png), "$.id");
        String second = json(upload("b.png", "image/png", png), "$.id");

        assertThat(second).isEqualTo(first);
        assertThat(jdbc.queryForObject("select count(*) from media_assets", Integer.class)).isEqualTo(1);
    }

    @Test
    void theLibraryCanBeListedSearchedDescribedAndCleanedUp() throws Exception {
        String id = json(upload("lookbook-arch.png", "image/png", AdminTestSupport.image("png", 12, 12)), "$.id");
        upload("other.png", "image/png", AdminTestSupport.image("png", 12, 12));

        admin.get("/api/admin/media").andExpect(jsonPath("$.totalItems").value(2));
        admin.get("/api/admin/media?q=arch").andExpect(jsonPath("$.items[*].fileName", hasItem("lookbook-arch.png")))
                .andExpect(jsonPath("$.totalItems").value(1));

        admin.patchJson("/api/admin/media/" + id, "{\"altText\": \"Model under a concrete arch\"}")
                .andExpect(jsonPath("$.altText").value("Model under a concrete arch"));

        String url = json(admin.get("/api/admin/media?q=arch"), "$.items[0].url");
        admin.delete("/api/admin/media/" + id).andExpect(status().isNoContent());
        mvc.perform(get(url)).andExpect(status().isNotFound());
    }

    @Test
    void anImageInUseOnTheSiteCannotBeDeleted() throws Exception {
        String uploaded = upload("in-use.png", "image/png", AdminTestSupport.image("png", 12, 12)).andReturn().getResponse().getContentAsString();
        String id = JsonPath.read(uploaded, "$.id").toString();
        String url = JsonPath.read(uploaded, "$.url");
        borrowedImageId = jdbc.queryForObject("""
                select min(i.id) from product_images i join product_colors c on c.id = i.color_id
                join products p on p.id = c.product_id where p.slug = 'form-oversized-tee'""", Long.class);
        borrowedImageUrl = jdbc.queryForObject("select url from product_images where id = ?", String.class, borrowedImageId);
        jdbc.update("update product_images set url = ? where id = ?", url, borrowedImageId);

        admin.get("/api/admin/media/" + id + "/usages").andExpect(jsonPath("$[0]", containsString("Form Oversized Tee")));
        admin.delete("/api/admin/media/" + id)
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("MEDIA_IN_USE"))
                .andExpect(jsonPath("$.errors[0].message", containsString("Product: Form Oversized Tee")));
        mvc.perform(get(url)).andExpect(status().isOk());
    }

    @Test
    void everyChangeIsWrittenToTheActivityLog() throws Exception {
        upload("logged.png", "image/png", AdminTestSupport.image("png", 12, 12));

        admin.get("/api/admin/activity")
                .andExpect(jsonPath("$[0].action").value("MEDIA_UPLOADED"))
                .andExpect(jsonPath("$[0].adminEmail").value(AdminTestSupport.ADMIN_EMAIL))
                .andExpect(jsonPath("$[0].summary", containsString("logged.png")));
    }
}
