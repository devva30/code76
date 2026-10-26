package com.code76.store.catalogue.repository;

import com.code76.store.catalogue.domain.Product;
import com.code76.store.catalogue.domain.ProductStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface ProductRepository extends JpaRepository<Product, Long>, JpaSpecificationExecutor<Product> {

    Optional<Product> findBySlugAndStatus(String slug, ProductStatus status);

    Optional<Product> findBySlug(String slug);

    boolean existsBySlug(String slug);

    /** Every product, any status, in the order the shop shows them (admin list). */
    List<Product> findAllByOrderByFeaturedRankAscIdAsc();

    @Query("select coalesce(max(p.featuredRank), 0) from Product p")
    int maxFeaturedRank();

    /** Published products with at least one active variant, per category id. */
    @Query("""
            select p.category.id, count(p) from Product p
            where p.status = com.code76.store.catalogue.domain.ProductStatus.PUBLISHED
              and exists (select 1 from ProductVariant v where v.product = p and v.active = true)
            group by p.category.id
            """)
    List<Object[]> countVisibleByCategory();

    /** Published products with at least one active variant, per collection id. */
    @Query("""
            select c.id, count(p) from Product p join p.collections c
            where p.status = com.code76.store.catalogue.domain.ProductStatus.PUBLISHED
              and exists (select 1 from ProductVariant v where v.product = p and v.active = true)
            group by c.id
            """)
    List<Object[]> countVisibleByCollection();
}
