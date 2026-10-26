package com.code76.store.catalogue.service;

import com.code76.store.catalogue.domain.Category;
import com.code76.store.catalogue.domain.Fit;
import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductColor;
import com.code76.store.catalogue.domain.ProductStatus;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.dto.ProductSearchRequest;
import com.code76.store.catalogue.repository.ProductRepository;
import com.code76.store.common.error.InvalidRequestException;
import com.code76.store.common.error.ResourceNotFoundException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@SuppressWarnings("unchecked")
class ProductServiceTest {

    @Mock
    ProductRepository repository;

    ProductService service;

    @BeforeEach
    void setUp() {
        service = new ProductService(repository, new ProductMapper());
    }

    @Test
    void searchUsesRequestedPageAndSortAndMapsResults() {
        Product product = publishedProduct("daily-regular-tee", true);
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<>(List.of(product), inv.getArgument(1), 7));

        PageResponse<ProductSummaryDto> page = service.search(request("price_asc", 2, 3));

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isEqualTo(2);
        assertThat(pageable.getValue().getPageSize()).isEqualTo(3);
        assertThat(pageable.getValue().getSort().getOrderFor("pricePaise").getDirection()).isEqualTo(Sort.Direction.ASC);
        assertThat(page.items()).extracting(ProductSummaryDto::slug).containsExactly("daily-regular-tee");
        assertThat(page.totalItems()).isEqualTo(7);
        assertThat(page.totalPages()).isEqualTo(3);
    }

    @Test
    void searchDefaultsToFirstPageOfTwelveInFeaturedOrder() {
        when(repository.findAll(any(Specification.class), any(Pageable.class)))
                .thenAnswer(inv -> new PageImpl<Product>(List.of(), inv.getArgument(1), 0));

        service.search(ProductSearchRequest.empty());

        ArgumentCaptor<Pageable> pageable = ArgumentCaptor.forClass(Pageable.class);
        verify(repository).findAll(any(Specification.class), pageable.capture());
        assertThat(pageable.getValue().getPageNumber()).isZero();
        assertThat(pageable.getValue().getPageSize()).isEqualTo(12);
        assertThat(pageable.getValue().getSort().getOrderFor("featuredRank")).isNotNull();
    }

    @Test
    void rejectsUnknownSortFitAndSizeBeforeQuerying() {
        assertThatThrownBy(() -> service.search(request("random", null, null)))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("price_asc");
        assertThatThrownBy(() -> service.search(withFit("baggy")))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("oversized, regular");
        assertThatThrownBy(() -> service.search(withSizes("M,XXXXL")))
                .isInstanceOf(InvalidRequestException.class)
                .hasMessageContaining("XXXXL");
        verify(repository, never()).findAll(any(Specification.class), any(Pageable.class));
    }

    @Test
    void acceptsCommaSeparatedCaseInsensitiveFilterValues() {
        assertThat(service.buildSpecification(withSizes("xs, M,,L"))).isNotNull();
        assertThat(service.buildSpecification(withFit("OVERSIZED,regular"))).isNotNull();
    }

    @Test
    void getBySlugReturnsDetailForVisibleProduct() {
        when(repository.findBySlugAndStatus("form-oversized-tee", ProductStatus.PUBLISHED))
                .thenReturn(Optional.of(publishedProduct("form-oversized-tee", true)));

        assertThat(service.getBySlug("form-oversized-tee").slug()).isEqualTo("form-oversized-tee");
    }

    @Test
    void getBySlugThrowsNotFoundForMissingProduct() {
        when(repository.findBySlugAndStatus("ghost", ProductStatus.PUBLISHED)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getBySlug("ghost"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("No product found for 'ghost'.");
    }

    @Test
    void getBySlugThrowsNotFoundWhenNoVariantIsActive() {
        when(repository.findBySlugAndStatus("retired-tee", ProductStatus.PUBLISHED))
                .thenReturn(Optional.of(publishedProduct("retired-tee", false)));

        assertThatThrownBy(() -> service.getBySlug("retired-tee")).isInstanceOf(ResourceNotFoundException.class);
    }

    private static ProductSearchRequest request(String sort, Integer page, Integer pageSize) {
        return new ProductSearchRequest(null, null, null, null, null, null, null, null, null, sort, page, pageSize);
    }

    private static ProductSearchRequest withFit(String fit) {
        return new ProductSearchRequest(null, null, null, List.of(fit), null, null, null, null, null, null, null, null);
    }

    private static ProductSearchRequest withSizes(String sizes) {
        return new ProductSearchRequest(null, null, null, null, List.of(sizes), null, null, null, null, null, null, null);
    }

    private static Product publishedProduct(String slug, boolean variantActive) {
        Product p = new Product(slug, "Test Tee", new Category("essentials", "Essentials", null, 1), Fit.REGULAR, "Regular fit", 169000);
        ProductColor c = p.addColor("noir", "Noir", "#111111");
        p.addVariant(c, Size.M, slug.toUpperCase() + "-M", 5).setActive(variantActive);
        p.publish(Instant.now());
        return p;
    }
}
