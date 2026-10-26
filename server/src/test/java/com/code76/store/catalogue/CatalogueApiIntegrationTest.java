package com.code76.store.catalogue;

import com.code76.store.catalogue.domain.Category;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.repository.CategoryRepository;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.support.IntegrationTest;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class CatalogueApiIntegrationTest {

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductRepository productRepository;

    @Autowired
    CategoryRepository categoryRepository;

    @Test
    void healthReportsServiceAndDatabaseUp() throws Exception {
        mvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"))
                .andExpect(jsonPath("$.database").value("UP"))
                .andExpect(jsonPath("$.timestamp", notNullValue()));
    }

    @Nested
    class Listing {

        @Test
        void returnsPublishedProductsInFeaturedOrderWithPageMetadata() throws Exception {
            mvc.perform(get("/api/products"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items", hasSize(6)))
                    .andExpect(jsonPath("$.items[0].slug").value("form-oversized-tee"))
                    .andExpect(jsonPath("$.items[0].price.amountPaise").value(249000))
                    .andExpect(jsonPath("$.items[0].price.currency").value("INR"))
                    .andExpect(jsonPath("$.items[0].colorways", hasSize(3)))
                    .andExpect(jsonPath("$.items[0].colorways[0].images[0].url").value("/images/products/form-noir-1.webp"))
                    .andExpect(jsonPath("$.page").value(0))
                    .andExpect(jsonPath("$.pageSize").value(12))
                    .andExpect(jsonPath("$.totalItems").value(6))
                    .andExpect(jsonPath("$.totalPages").value(1));
        }

        @Test
        void paginates() throws Exception {
            mvc.perform(get("/api/products").param("pageSize", "4"))
                    .andExpect(jsonPath("$.items", hasSize(4)))
                    .andExpect(jsonPath("$.totalItems").value(6))
                    .andExpect(jsonPath("$.totalPages").value(2));
            mvc.perform(get("/api/products").param("pageSize", "4").param("page", "1"))
                    .andExpect(jsonPath("$.items", hasSize(2)))
                    .andExpect(jsonPath("$.page").value(1));
            mvc.perform(get("/api/products").param("page", "5"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        void filtersByFit() throws Exception {
            mvc.perform(get("/api/products").param("fit", "oversized"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder("form-oversized-tee", "field-oversized-tee")))
                    .andExpect(jsonPath("$.items[*].fit", everyItem(org.hamcrest.Matchers.is("oversized"))));
        }

        @Test
        void filtersBySizeOnlyCountingInStockVariants() throws Exception {
            // XS is sold out for the Field tee and not offered on the Boxy tee.
            mvc.perform(get("/api/products").param("sizes", "XS"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder(
                            "form-oversized-tee", "daily-regular-tee", "relaxed-pocket-tee", "weekend-relaxed-tee")));
        }

        @Test
        void filtersByColourNameOrCodeCaseInsensitively() throws Exception {
            mvc.perform(get("/api/products").param("colors", "SAND"))
                    .andExpect(jsonPath("$.items[*].slug", contains("relaxed-pocket-tee")));
            mvc.perform(get("/api/products").param("colors", "Noir"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder("form-oversized-tee", "daily-regular-tee")));
        }

        @Test
        void filtersByCategoryAndCollection() throws Exception {
            mvc.perform(get("/api/products").param("category", "pocket-tees"))
                    .andExpect(jsonPath("$.items[*].slug", contains("relaxed-pocket-tee")));
            mvc.perform(get("/api/products").param("collection", "new-arrivals"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder(
                            "form-oversized-tee", "relaxed-pocket-tee", "heavyweight-boxy-tee")));
        }

        @Test
        void filtersByPriceRangeInPaise() throws Exception {
            mvc.perform(get("/api/products").param("minPricePaise", "200000").param("maxPricePaise", "250000"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder(
                            "relaxed-pocket-tee", "form-oversized-tee", "field-oversized-tee")));
        }

        @Test
        void combinesFilters() throws Exception {
            mvc.perform(get("/api/products").param("fit", "regular").param("maxPricePaise", "190000"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder("daily-regular-tee", "weekend-relaxed-tee")));
        }

        @Test
        void searchesNameSubtitleAndColourAndTreatsWildcardsLiterally() throws Exception {
            // Matches the Boxy tee by name and the Form tee by its subtitle ("Dropped shoulder, boxy body").
            mvc.perform(get("/api/products").param("q", "boxy"))
                    .andExpect(jsonPath("$.items[*].slug", containsInAnyOrder("form-oversized-tee", "heavyweight-boxy-tee")));
            mvc.perform(get("/api/products").param("q", "Heavyweight"))
                    .andExpect(jsonPath("$.items[*].slug", contains("heavyweight-boxy-tee")));
            mvc.perform(get("/api/products").param("q", "heather"))
                    .andExpect(jsonPath("$.items[*].slug", contains("daily-regular-tee")));
            mvc.perform(get("/api/products").param("q", "%"))
                    .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        void requiresEverySearchWordToMatchSomewhere() throws Exception {
            // "noir" is a colour, "oversized" is in the name/fit label: only the Form tee has both.
            mvc.perform(get("/api/products").param("q", "  noir   oversized "))
                    .andExpect(jsonPath("$.items[*].slug", contains("form-oversized-tee")));
            mvc.perform(get("/api/products").param("q", "noir nonexistentword"))
                    .andExpect(jsonPath("$.items", hasSize(0)));
        }

        @Test
        void sortsByPrice() throws Exception {
            mvc.perform(get("/api/products").param("sort", "price_asc"))
                    .andExpect(jsonPath("$.items[0].slug").value("daily-regular-tee"))
                    .andExpect(jsonPath("$.items[5].slug").value("heavyweight-boxy-tee"));
            mvc.perform(get("/api/products").param("sort", "price_desc"))
                    .andExpect(jsonPath("$.items[0].slug").value("heavyweight-boxy-tee"));
        }
    }

    @Nested
    class Detail {

        @Test
        void returnsFullProductWithStockAwareSizes() throws Exception {
            mvc.perform(get("/api/products/form-oversized-tee"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$.name").value("Form Oversized Tee"))
                    .andExpect(jsonPath("$.fit").value("oversized"))
                    .andExpect(jsonPath("$.category.slug").value("essentials"))
                    .andExpect(jsonPath("$.collections", containsInAnyOrder("new-arrivals", "oversized")))
                    .andExpect(jsonPath("$.details", hasSize(4)))
                    .andExpect(jsonPath("$.colorways[0].code").value("noir"))
                    .andExpect(jsonPath("$.colorways[0].sizes[0].size").value("XS"))
                    .andExpect(jsonPath("$.colorways[0].sizes[0].sku").value("C76-FORM-NOIR-XS"))
                    .andExpect(jsonPath("$.colorways[0].sizes[0].available").value(false))
                    .andExpect(jsonPath("$.colorways[0].sizes[1].available").value(true));
        }

        @Test
        void includesCompareAtPriceForOffers() throws Exception {
            mvc.perform(get("/api/products/daily-regular-tee"))
                    .andExpect(jsonPath("$.price.amountPaise").value(169000))
                    .andExpect(jsonPath("$.compareAtPrice.amountPaise").value(199000));
        }

        @Test
        void returns404WithConsistentErrorForUnknownProduct() throws Exception {
            mvc.perform(get("/api/products/does-not-exist"))
                    .andExpect(status().isNotFound())
                    .andExpect(jsonPath("$.status").value(404))
                    .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                    .andExpect(jsonPath("$.path").value("/api/products/does-not-exist"))
                    .andExpect(jsonPath("$.message", notNullValue()));
        }
    }

    @Nested
    @Transactional // each test's extra data is rolled back afterwards
    class Visibility {

        @Test
        void hidesDraftProductsFromListingAndDetail() throws Exception {
            Product draft = productWithOneVariant("secret-draft-tee", "Secret Draft Tee");
            productRepository.saveAndFlush(draft);

            mvc.perform(get("/api/products").param("pageSize", "48"))
                    .andExpect(jsonPath("$.items[*].slug", not(hasItem("secret-draft-tee"))));
            mvc.perform(get("/api/products/secret-draft-tee")).andExpect(status().isNotFound());
        }

        @Test
        void hidesPublishedProductsWithoutActiveVariants() throws Exception {
            Product p = productWithOneVariant("no-active-variants-tee", "No Active Variants Tee");
            p.publish(Instant.now());
            p.getVariants().forEach(v -> v.setActive(false));
            productRepository.saveAndFlush(p);

            mvc.perform(get("/api/products").param("pageSize", "48"))
                    .andExpect(jsonPath("$.items[*].slug", not(hasItem("no-active-variants-tee"))));
            mvc.perform(get("/api/products/no-active-variants-tee")).andExpect(status().isNotFound());
        }

        @Test
        void excludesInactiveVariantsFromProductSizes() throws Exception {
            Product p = productRepository.findBySlugAndStatus("heavyweight-boxy-tee",
                    com.code76.store.catalogue.domain.ProductStatus.PUBLISHED).orElseThrow();
            p.getVariants().stream().filter(v -> v.getSize() == Size.XL).forEach(v -> v.setActive(false));
            productRepository.saveAndFlush(p);

            mvc.perform(get("/api/products/heavyweight-boxy-tee"))
                    .andExpect(jsonPath("$.sizes", contains("S", "M", "L")))
                    .andExpect(jsonPath("$.colorways[0].sizes[*].size", contains("S", "M", "L")));
        }

        private Product productWithOneVariant(String slug, String name) {
            Category essentials = categoryRepository.findBySlug("essentials").orElseThrow();
            Product p = new Product(slug, name, essentials, Fit.REGULAR, "Regular fit", 150000);
            ProductColor color = p.addColor("ink", "Ink", "#111111");
            color.addImage("/images/products/daily-noir-1.webp", "Test image");
            p.addVariant(color, Size.M, slug.toUpperCase().replace('-', '_') + "-M", 5);
            return p;
        }
    }

    @Nested
    class InvalidRequests {

        @ParameterizedTest(name = "{0}={1} -> 400 on {2}")
        @CsvSource({
                "pageSize, 500, pageSize",
                "pageSize, 0, pageSize",
                "page, -1, page",
                "page, abc, page",
                "fit, baggy, fit",
                "sizes, XXXXL, sizes",
                "sort, random, sort",
                "minPricePaise, -5, minPricePaise",
                "category, Bad_Slug!, category",
        })
        void rejectsInvalidParametersWithFieldErrors(String param, String value, String field) throws Exception {
            mvc.perform(get("/api/products").param(param, value))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.status").value(400))
                    .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                    .andExpect(jsonPath("$.errors[*].field", hasItem(field)));
        }

        @Test
        void rejectsInvertedPriceRange() throws Exception {
            mvc.perform(get("/api/products").param("minPricePaise", "300000").param("maxPricePaise", "100000"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.errors[0].message").value("minPricePaise must not be greater than maxPricePaise"));
        }

        @Test
        void rejectsMalformedSlug() throws Exception {
            mvc.perform(get("/api/products/Not_A_Slug"))
                    .andExpect(status().isBadRequest())
                    .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"));
        }

        @Test
        void unknownEndpointIsDeniedByDefaultWhenSignedOut() throws Exception {
            // Secure by default: paths not explicitly made public require a session.
            mvc.perform(get("/api/nope"))
                    .andExpect(status().isUnauthorized())
                    .andExpect(jsonPath("$.error").value("UNAUTHENTICATED"));
        }
    }

    @Nested
    class Taxonomy {

        @Test
        void listsCategoriesWithVisibleProductCounts() throws Exception {
            mvc.perform(get("/api/categories"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].slug", contains("essentials", "pocket-tees", "graphic-tees")))
                    .andExpect(jsonPath("$[0].productCount").value(5))
                    .andExpect(jsonPath("$[1].productCount").value(1))
                    .andExpect(jsonPath("$[2].productCount").value(0));
        }

        @Test
        void listsActiveCollectionsWithCounts() throws Exception {
            mvc.perform(get("/api/collections"))
                    .andExpect(status().isOk())
                    .andExpect(jsonPath("$[*].slug", contains("new-arrivals", "oversized", "regular-fit")))
                    .andExpect(jsonPath("$[0].productCount").value(3))
                    .andExpect(jsonPath("$[1].productCount").value(2))
                    .andExpect(jsonPath("$[2].productCount").value(4));
        }
    }

    @Nested
    class Cors {

        @Test
        void allowsTheConfiguredFrontendOrigin() throws Exception {
            mvc.perform(options("/api/products")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"));
        }

        @Test
        void allowsCredentialedWritesWithTheCsrfHeaderFromTheFrontendOrigin() throws Exception {
            mvc.perform(options("/api/auth/login")
                            .header(HttpHeaders.ORIGIN, "http://localhost:5173")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "POST")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "content-type,x-xsrf-token"))
                    .andExpect(status().isOk())
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:5173"))
                    .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"));
        }

        @Test
        void rejectsOtherOrigins() throws Exception {
            mvc.perform(options("/api/products")
                            .header(HttpHeaders.ORIGIN, "https://evil.example")
                            .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET"))
                    .andExpect(status().isForbidden())
                    .andExpect(header().doesNotExist(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN));
        }
    }
}
