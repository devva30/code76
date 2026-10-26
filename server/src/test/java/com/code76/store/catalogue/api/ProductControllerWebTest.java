package com.code76.store.catalogue.api;

import com.code76.store.config.SecurityConfig;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.dto.ProductSearchRequest;
import com.code76.store.catalogue.service.ProductService;
import com.code76.store.common.error.ResourceNotFoundException;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

/** HTTP contract of the product endpoints, with the service mocked out. */
@WebMvcTest(ProductController.class)
@Import(SecurityConfig.class)
class ProductControllerWebTest {

    @Autowired
    MockMvc mvc;

    @MockitoBean
    ProductService productService;

    @Test
    void bindsQueryParametersIntoSearchRequest() throws Exception {
        when(productService.search(any())).thenReturn(new PageResponse<>(List.of(), 1, 6, 0, 0));

        mvc.perform(get("/api/products")
                        .param("q", "tee").param("fit", "oversized").param("sizes", "M", "L")
                        .param("colors", "noir").param("minPricePaise", "100").param("maxPricePaise", "900")
                        .param("sort", "newest").param("page", "1").param("pageSize", "6"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.page").value(1))
                .andExpect(jsonPath("$.pageSize").value(6));

        ArgumentCaptor<ProductSearchRequest> captor = ArgumentCaptor.forClass(ProductSearchRequest.class);
        verify(productService).search(captor.capture());
        ProductSearchRequest r = captor.getValue();
        assertThat(r.q()).isEqualTo("tee");
        assertThat(r.fit()).containsExactly("oversized");
        assertThat(r.sizes()).containsExactly("M", "L");
        assertThat(r.colors()).containsExactly("noir");
        assertThat(r.minPricePaise()).isEqualTo(100);
        assertThat(r.maxPricePaise()).isEqualTo(900);
        assertThat(r.sort()).isEqualTo("newest");
        assertThat(r.page()).isEqualTo(1);
        assertThat(r.pageSize()).isEqualTo(6);
    }

    @Test
    void validationFailureNeverReachesTheService() throws Exception {
        mvc.perform(get("/api/products").param("pageSize", "49"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("VALIDATION_FAILED"))
                .andExpect(jsonPath("$.errors[0].field").value("pageSize"))
                .andExpect(jsonPath("$.errors[0].message").value("must be at most 48"));
        verifyNoInteractions(productService);
    }

    @Test
    void notFoundIsMappedToConsistentErrorBody() throws Exception {
        when(productService.getBySlug("ghost-tee")).thenThrow(new ResourceNotFoundException("No product found for 'ghost-tee'."));

        mvc.perform(get("/api/products/ghost-tee"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("No product found for 'ghost-tee'."))
                .andExpect(jsonPath("$.path").value("/api/products/ghost-tee"));
    }

    @Test
    void unexpectedErrorsDoNotLeakDetails() throws Exception {
        when(productService.getBySlug("boom-tee")).thenThrow(new IllegalStateException("db password is hunter2"));

        mvc.perform(get("/api/products/boom-tee"))
                .andExpect(status().isInternalServerError())
                .andExpect(jsonPath("$.error").value("INTERNAL_ERROR"))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.not(org.hamcrest.Matchers.containsString("hunter2"))));
    }

    @Test
    void writeMethodsAreNotAllowed() throws Exception {
        mvc.perform(post("/api/products").with(csrf()))
                .andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(productService);
    }
}
