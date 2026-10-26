package com.code76.store.catalogue.repository;

import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.domain.Size;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface ProductVariantRepository extends JpaRepository<ProductVariant, Long> {

    Optional<ProductVariant> findBySku(String sku);

    /** The SKU for "this product, in this colour, in this size", as chosen on the product page. */
    @Query("""
            select v from ProductVariant v
            join fetch v.product p
            join fetch v.color c
            where p.slug = :slug and c.code = :colorCode and v.size = :size""")
    Optional<ProductVariant> findByChoice(@Param("slug") String slug, @Param("colorCode") String colorCode, @Param("size") Size size);
}
