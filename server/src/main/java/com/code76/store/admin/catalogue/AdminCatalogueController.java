package com.code76.store.admin.catalogue;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CategoryRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CategoryRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CollectionRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.CollectionRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ColorRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ColorUpdateRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductDetail;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ProductRow;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.ReorderRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.SizesRequest;
import com.code76.store.admin.catalogue.AdminCatalogueDtos.StatusRequest;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/** Products, sizes, stock, display order, categories and collections (admins only). */
@RestController
@Validated
@RequestMapping("/api/admin")
public class AdminCatalogueController {

    private final AdminCatalogueService catalogue;

    public AdminCatalogueController(AdminCatalogueService catalogue) {
        this.catalogue = catalogue;
    }

    // ---- products ----

    @GetMapping("/products")
    public List<ProductRow> products(@RequestParam(defaultValue = "") @Size(max = 100) String q,
                                     @RequestParam(defaultValue = "") @Pattern(regexp = "^(|draft|published|archived)$") String status) {
        return catalogue.listProducts(q, status);
    }

    @PostMapping("/products")
    public ResponseEntity<ProductDetail> create(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody ProductRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogue.createProduct(body, admin));
    }

    @PutMapping("/products/order")
    public List<ProductRow> reorder(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody ReorderRequest body) {
        return catalogue.reorderProducts(body.ids(), admin);
    }

    @GetMapping("/products/{idOrSlug}")
    public ProductDetail product(@PathVariable @Pattern(regexp = "^[a-z0-9-]{1,120}$") String idOrSlug) {
        return catalogue.getProduct(idOrSlug);
    }

    @PutMapping("/products/{id}")
    public ProductDetail update(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody ProductRequest body) {
        return catalogue.updateProduct(id, body, admin);
    }

    @PutMapping("/products/{id}/status")
    public ProductDetail status(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody StatusRequest body) {
        return catalogue.setStatus(id, body.status(), admin);
    }

    @DeleteMapping("/products/{id}")
    public ResponseEntity<Void> delete(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id) {
        catalogue.deleteProduct(id, admin);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/products/{id}/colors")
    public ProductDetail addColor(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody ColorRequest body) {
        return catalogue.addColor(id, body, admin);
    }

    @PutMapping("/products/{id}/colors/order")
    public ProductDetail reorderColors(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody ReorderRequest body) {
        return catalogue.reorderColors(id, body.ids(), admin);
    }

    @PutMapping("/products/{id}/colors/{colorId}")
    public ProductDetail updateColor(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @PathVariable long colorId,
                                     @Valid @RequestBody ColorUpdateRequest body) {
        return catalogue.updateColor(id, colorId, body, admin);
    }

    @DeleteMapping("/products/{id}/colors/{colorId}")
    public ProductDetail deleteColor(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @PathVariable long colorId) {
        return catalogue.deleteColor(id, colorId, admin);
    }

    @PutMapping("/products/{id}/colors/{colorId}/sizes")
    public ProductDetail sizes(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @PathVariable long colorId,
                               @Valid @RequestBody SizesRequest body) {
        return catalogue.setSizes(id, colorId, body.sizes(), admin);
    }

    // ---- categories ----

    @GetMapping("/categories")
    public List<CategoryRow> categories() {
        return catalogue.listCategories();
    }

    @PostMapping("/categories")
    public ResponseEntity<CategoryRow> createCategory(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody CategoryRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogue.saveCategory(null, body, admin));
    }

    @PutMapping("/categories/{id}")
    public CategoryRow updateCategory(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody CategoryRequest body) {
        return catalogue.saveCategory(id, body, admin);
    }

    @DeleteMapping("/categories/{id}")
    public ResponseEntity<Void> deleteCategory(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id) {
        catalogue.deleteCategory(id, admin);
        return ResponseEntity.noContent().build();
    }

    // ---- collections ----

    @GetMapping("/collections")
    public List<CollectionRow> collections() {
        return catalogue.listCollections();
    }

    @PostMapping("/collections")
    public ResponseEntity<CollectionRow> createCollection(@AuthenticationPrincipal AccountPrincipal admin, @Valid @RequestBody CollectionRequest body) {
        return ResponseEntity.status(HttpStatus.CREATED).body(catalogue.saveCollection(null, body, admin));
    }

    @PutMapping("/collections/{id}")
    public CollectionRow updateCollection(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id, @Valid @RequestBody CollectionRequest body) {
        return catalogue.saveCollection(id, body, admin);
    }

    @DeleteMapping("/collections/{id}")
    public ResponseEntity<Void> deleteCollection(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable long id) {
        catalogue.deleteCollection(id, admin);
        return ResponseEntity.noContent().build();
    }
}
