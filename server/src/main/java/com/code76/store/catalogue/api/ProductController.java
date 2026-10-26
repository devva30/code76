package com.code76.store.catalogue.api;

import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductDetailDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import com.code76.store.catalogue.dto.ProductSearchRequest;
import com.code76.store.catalogue.service.ProductService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Validated
@RequestMapping("/api/products")
public class ProductController {

    private final ProductService productService;

    public ProductController(ProductService productService) {
        this.productService = productService;
    }

    /** Paginated, filterable listing of published products. See {@link ProductSearchRequest}. */
    @GetMapping
    public PageResponse<ProductSummaryDto> list(@Valid @ModelAttribute ProductSearchRequest request) {
        return productService.search(request);
    }

    @GetMapping("/{slug}")
    public ProductDetailDto get(@PathVariable
                                @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "must be a valid slug")
                                String slug) {
        return productService.getBySlug(slug);
    }
}
