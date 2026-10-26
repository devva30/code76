package com.code76.store.catalogue.service;

import com.code76.store.catalogue.dto.CatalogueDtos.CategoryDto;
import com.code76.store.catalogue.domain.Size;
import com.code76.store.catalogue.dto.CatalogueDtos.CollectionDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ColorFacet;
import com.code76.store.catalogue.dto.CatalogueDtos.FacetsDto;
import com.code76.store.catalogue.dto.CatalogueDtos.ImageDto;
import com.code76.store.catalogue.repository.CategoryRepository;
import com.code76.store.catalogue.repository.CollectionRepository;
import com.code76.store.catalogue.repository.ProductRepository;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** Categories and collections, each with the number of publicly visible products. */
@Service
@Transactional(readOnly = true)
public class TaxonomyService {

    private final CategoryRepository categories;
    private final CollectionRepository collections;
    private final ProductRepository products;
    private final JdbcTemplate jdbc;

    public TaxonomyService(CategoryRepository categories, CollectionRepository collections, ProductRepository products, JdbcTemplate jdbc) {
        this.categories = categories;
        this.collections = collections;
        this.products = products;
        this.jdbc = jdbc;
    }

    public List<CategoryDto> listCategories() {
        Map<Long, Long> counts = toCountMap(products.countVisibleByCategory());
        return categories.findAllByOrderBySortOrderAscNameAsc().stream()
                .map(c -> new CategoryDto(c.getSlug(), c.getName(), c.getDescription(), counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    public List<CollectionDto> listCollections() {
        Map<Long, Long> counts = toCountMap(products.countVisibleByCollection());
        return collections.findAllByActiveTrueOrderBySortOrderAscNameAsc().stream()
                .map(c -> new CollectionDto(c.getSlug(), c.getName(), c.getDescription(), c.getEyebrow(), c.getIntro(),
                        c.getBannerUrl() == null || c.getBannerUrl().isBlank() ? null : new ImageDto(c.getBannerUrl(), c.getBannerAlt()),
                        counts.getOrDefault(c.getId(), 0L)))
                .toList();
    }

    /** Colours and sizes that a shopper could actually buy right now, for the shop's filter chips. */
    public FacetsDto facets() {
        List<ColorFacet> colors = jdbc.query("""
                select distinct on (lower(c.name)) c.name, c.hex
                from product_colors c
                join products p on p.id = c.product_id
                join product_variants v on v.color_id = c.id and v.active
                where p.status = 'PUBLISHED' and p.published_at is not null
                order by lower(c.name), c.id""", (rs, n) -> new ColorFacet(rs.getString("name"), rs.getString("hex")));
        List<String> offered = jdbc.queryForList("""
                select distinct v.size from product_variants v join products p on p.id = v.product_id
                where v.active and p.status = 'PUBLISHED' and p.published_at is not null""", String.class);
        List<String> sizes = Arrays.stream(Size.values()).map(Enum::name).filter(offered::contains).toList();
        return new FacetsDto(colors, sizes);
    }

    private static Map<Long, Long> toCountMap(List<Object[]> rows) {
        return rows.stream().collect(Collectors.toMap(r -> (Long) r[0], r -> (Long) r[1]));
    }
}
