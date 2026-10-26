package com.code76.store.catalogue.domain;

import java.util.Arrays;
import java.util.Optional;

/** How a tee is cut. Stored by name; exposed to clients in lower case. */
public enum Fit {
    OVERSIZED,
    REGULAR;

    public String apiValue() {
        return name().toLowerCase();
    }

    public static Optional<Fit> fromApiValue(String value) {
        return Arrays.stream(values()).filter(f -> f.name().equalsIgnoreCase(value.trim())).findFirst();
    }
}
