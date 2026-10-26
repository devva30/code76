package com.code76.store.accounts.repository;

import com.code76.store.accounts.domain.WishlistItem;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface WishlistItemRepository extends JpaRepository<WishlistItem, WishlistItem.Key> {

    /** Newest first, with the product loaded in the same query. */
    @Query("select w from WishlistItem w join fetch w.product where w.id.userId = :userId order by w.createdAt desc")
    List<WishlistItem> findForUser(@Param("userId") Long userId);

    long countByIdUserId(Long userId);

    /** Adding twice (or two tabs adding at once) is harmless: the duplicate is simply ignored. */
    @Modifying
    @Query(value = "insert into wishlist_items (user_id, product_id) values (:userId, :productId) on conflict do nothing",
            nativeQuery = true)
    int insertIfAbsent(@Param("userId") Long userId, @Param("productId") Long productId);

    @Modifying
    @Query(value = """
            delete from wishlist_items w
            using products p
            where w.product_id = p.id and w.user_id = :userId and p.slug = :slug""", nativeQuery = true)
    int deleteBySlug(@Param("userId") Long userId, @Param("slug") String slug);
}
