package com.code76.store.orders.service;

import java.util.List;
import java.util.Set;

/** The 28 states and 8 union territories accepted in delivery addresses. Mirrored in src/lib/indianStates.ts. */
public final class IndianStates {

    private IndianStates() {
    }

    public static final List<String> ALL = List.of(
            "Andaman and Nicobar Islands", "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chandigarh",
            "Chhattisgarh", "Dadra and Nagar Haveli and Daman and Diu", "Delhi", "Goa", "Gujarat", "Haryana",
            "Himachal Pradesh", "Jammu and Kashmir", "Jharkhand", "Karnataka", "Kerala", "Ladakh", "Lakshadweep",
            "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Puducherry",
            "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand",
            "West Bengal");

    private static final Set<String> NAMES = Set.copyOf(ALL);

    public static boolean isValid(String name) {
        return name != null && NAMES.contains(name);
    }
}
