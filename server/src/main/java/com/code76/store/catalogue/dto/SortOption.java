package com.code76.store.catalogue.dto;

import org.springframework.data.domain.Sort;

import java.util.Arrays;
import java.util.Optional;
import java.util.stream.Collectors;

/** Supported orderings for the product listing. Ties are always broken by id for stable paging. */
public enum SortOption {
    FEATURED("featured", Sort.by(Sort.Order.asc("featuredRank"), Sort.Order.asc("id"))),
    NEWEST("newest", Sort.by(Sort.Order.desc("publishedAt"), Sort.Order.asc("id"))),
    PRICE_ASC("price_asc", Sort.by(Sort.Order.asc("pricePaise"), Sort.Order.asc("id"))),
    PRICE_DESC("price_desc", Sort.by(Sort.Order.desc("pricePaise"), Sort.Order.asc("id"))),
    NAME("name", Sort.by(Sort.Order.asc("name"), Sort.Order.asc("id")));

    private final String apiValue;
    private final Sort sort;

    SortOption(String apiValue, Sort sort) {
        this.apiValue = apiValue;
        this.sort = sort;
    }

    public Sort sort() {
        return sort;
    }

    public static Optional<SortOption> fromApiValue(String value) {
        return Arrays.stream(values()).filter(s -> s.apiValue.equalsIgnoreCase(value.trim())).findFirst();
    }

    public static String allowedValues() {
        return Arrays.stream(values()).map(s -> s.apiValue).collect(Collectors.joining(", "));
    }
}
