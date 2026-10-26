package com.code76.store.catalogue.api;

import com.code76.store.catalogue.dto.CatalogueDtos.CategoryDto;
import com.code76.store.catalogue.dto.CatalogueDtos.CollectionDto;
import com.code76.store.catalogue.dto.CatalogueDtos.FacetsDto;
import com.code76.store.catalogue.service.TaxonomyService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api")
public class TaxonomyController {

    private final TaxonomyService taxonomyService;

    public TaxonomyController(TaxonomyService taxonomyService) {
        this.taxonomyService = taxonomyService;
    }

    @GetMapping("/categories")
    public List<CategoryDto> categories() {
        return taxonomyService.listCategories();
    }

    /** Colours and sizes on sale right now, for the shop's filter chips. */
    @GetMapping("/facets")
    public FacetsDto facets() {
        return taxonomyService.facets();
    }

    @GetMapping("/collections")
    public List<CollectionDto> collections() {
        return taxonomyService.listCollections();
    }
}
