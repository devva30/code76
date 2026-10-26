package com.code76.store.orders.service;

import com.code76.store.orders.repository.CustomerOrderRepository;
import org.springframework.stereotype.Component;

import java.security.SecureRandom;

/**
 * Order numbers like {@code C76-7KQ2-M9XD}: easy to read out over the phone (no 0/O or 1/I),
 * and random, so they don't reveal how many orders the shop receives.
 */
@Component
public class OrderNumberGenerator {

    private static final char[] ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ".toCharArray();
    public static final String PATTERN = "^C76-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$";

    private final SecureRandom random = new SecureRandom();
    private final CustomerOrderRepository orders;

    public OrderNumberGenerator(CustomerOrderRepository orders) {
        this.orders = orders;
    }

    public String next() {
        // 32^8 ≈ a trillion combinations, so a clash is vanishingly rare; check anyway.
        for (int attempt = 0; attempt < 5; attempt++) {
            String candidate = generate();
            if (!orders.existsByOrderNumber(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Could not generate a unique order number");
    }

    String generate() {
        StringBuilder sb = new StringBuilder("C76-");
        for (int i = 0; i < 8; i++) {
            if (i == 4) {
                sb.append('-');
            }
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)]);
        }
        return sb.toString();
    }
}
