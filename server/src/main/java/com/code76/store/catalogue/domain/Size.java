package com.code76.store.catalogue.domain;

import java.util.Arrays;
import java.util.Optional;

/** Garment sizes, in display order. 3XL is stored as XXXL; "3XL" is accepted as input too. */
public enum Size {
    XXS, XS, S, M, L, XL, XXL, XXXL;

    public static Optional<Size> fromApiValue(String value) {
        String v = value.trim();
        if (v.equalsIgnoreCase("3XL")) {
            return Optional.of(XXXL);
        }
        return Arrays.stream(values()).filter(s -> s.name().equalsIgnoreCase(v)).findFirst();
    }

    /** "XXS, XS, S, M, L, XL, XXL, XXXL", for error messages. */
    public static String allowedValues() {
        return String.join(", ", Arrays.stream(values()).map(Enum::name).toList());
    }
}
