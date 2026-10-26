package com.code76.store.db;

import com.code76.store.support.IntegrationTest;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Verifies the Flyway schema applied cleanly and that the database itself enforces catalogue invariants. */
@IntegrationTest
class FlywayMigrationIntegrationTest {

    @Autowired
    JdbcTemplate jdbc;

    @Test
    void allMigrationsAppliedSuccessfully() {
        List<String> versions = jdbc.queryForList(
                "select version from flyway_schema_history where success and version is not null order by installed_rank", String.class);
        Integer failed = jdbc.queryForObject("select count(*) from flyway_schema_history where not success", Integer.class);

        assertThat(versions).contains("1", "2", "3");
        assertThat(failed).isZero();
    }

    @Test
    void createsAccountAndSessionTables() {
        List<String> tables = jdbc.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public'", String.class);

        assertThat(tables).contains("users", "wishlist_items", "spring_session", "spring_session_attributes");
    }

    @Test
    void emailsMustBeStoredNormalisedAndUnique() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into users (email, full_name, password_hash) values ('Mixed@Case.com', 'X', 'h')"))
                .isInstanceOf(DataIntegrityViolationException.class);
        jdbc.update("insert into users (email, full_name, password_hash) values ('dup-check@example.com', 'X', 'h')");
        assertThatThrownBy(() -> jdbc.update(
                "insert into users (email, full_name, password_hash) values ('dup-check@example.com', 'Y', 'h')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsUnknownRoles() {
        assertThatThrownBy(() -> jdbc.update(
                "insert into users (email, full_name, password_hash, role) values ('role-check@example.com', 'X', 'h', 'SUPERUSER')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void deletingAUserDeletesTheirWishlist() {
        Long userId = jdbc.queryForObject(
                "insert into users (email, full_name, password_hash) values ('cascade-check@example.com', 'X', 'h') returning id", Long.class);
        jdbc.update("insert into wishlist_items (user_id, product_id) select ?, min(id) from products", userId);

        jdbc.update("delete from users where id = ?", userId);

        assertThat(jdbc.queryForObject("select count(*) from wishlist_items where user_id = ?", Integer.class, userId)).isZero();
    }

    @Test
    void createsEveryCatalogueTable() {
        List<String> tables = jdbc.queryForList(
                "select table_name from information_schema.tables where table_schema = 'public'", String.class);

        assertThat(tables).contains("categories", "collections", "products", "product_collections",
                "product_colors", "product_images", "product_variants", "inventory");
    }

    @Test
    void rejectsDuplicateSku() {
        assertThatThrownBy(() -> jdbc.update(
                "update product_variants set sku = (select sku from product_variants order by id limit 1) "
                        + "where id = (select max(id) from product_variants)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsNegativeStock() {
        assertThatThrownBy(() -> jdbc.update(
                "update inventory set quantity_on_hand = -1 where variant_id = (select min(variant_id) from inventory)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsReservingMoreThanOnHand() {
        assertThatThrownBy(() -> jdbc.update(
                "update inventory set quantity_reserved = quantity_on_hand + 1 where variant_id = (select min(variant_id) from inventory)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsCompareAtPriceNotAbovePrice() {
        assertThatThrownBy(() -> jdbc.update(
                "update products set compare_at_price_paise = price_paise where id = (select min(id) from products)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsNonPositivePrice() {
        assertThatThrownBy(() -> jdbc.update("update products set price_paise = 0 where id = (select min(id) from products)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsPublishedProductWithoutPublishDate() {
        assertThatThrownBy(() -> jdbc.update(
                "update products set published_at = null where id = (select min(id) from products where status = 'PUBLISHED')"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void rejectsUnknownSizeAndInvalidHex() {
        assertThatThrownBy(() -> jdbc.update("update product_variants set size = 'XXXXL' where id = (select min(id) from product_variants)"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThatThrownBy(() -> jdbc.update("update product_colors set hex = 'red' where id = (select min(id) from product_colors)"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }

    @Test
    void preventsDeletingACategoryThatStillHasProducts() {
        assertThatThrownBy(() -> jdbc.update("delete from categories where slug = 'essentials'"))
                .isInstanceOf(DataIntegrityViolationException.class);
    }
}
