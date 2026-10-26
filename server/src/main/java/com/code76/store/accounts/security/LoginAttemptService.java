package com.code76.store.accounts.security;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Slows down password guessing: after {@value #MAX_FAILURES} wrong passwords for the same
 * email from the same address within 15 minutes, further attempts are refused until the
 * oldest failure ages out. Kept in memory, so it resets on restart and is per instance;
 * move it to a shared store (e.g. Redis) before running several instances.
 */
@Component
public class LoginAttemptService {

    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_TRACKED_KEYS = 50_000;

    private final Clock clock;
    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    @Autowired
    public LoginAttemptService() {
        this(Clock.systemUTC());
    }

    LoginAttemptService(Clock clock) {
        this.clock = clock;
    }

    public static String key(String normalisedEmail, String clientAddress) {
        return normalisedEmail + "|" + clientAddress;
    }

    /** How long this key must wait, or empty if it may try now. */
    public Optional<Duration> lockedFor(String key) {
        return lockedFor(key, MAX_FAILURES);
    }

    /** The same check with a different limit, for other things worth slowing down (e.g. newsletter sign-ups). */
    public Optional<Duration> lockedFor(String key, int maxEvents) {
        Deque<Instant> recent = failures.get(key);
        if (recent == null) {
            return Optional.empty();
        }
        synchronized (recent) {
            prune(recent);
            if (recent.size() < maxEvents) {
                return Optional.empty();
            }
            Duration wait = Duration.between(clock.instant(), recent.peekFirst().plus(WINDOW));
            return Optional.of(wait.isNegative() ? Duration.ZERO : wait);
        }
    }

    public void recordFailure(String key) {
        if (failures.size() >= MAX_TRACKED_KEYS) {
            failures.values().removeIf(d -> {
                synchronized (d) {
                    prune(d);
                    return d.isEmpty();
                }
            });
        }
        Deque<Instant> recent = failures.computeIfAbsent(key, k -> new ArrayDeque<>());
        synchronized (recent) {
            prune(recent);
            recent.addLast(clock.instant());
        }
    }

    public void reset(String key) {
        failures.remove(key);
    }

    private void prune(Deque<Instant> recent) {
        Instant cutoff = clock.instant().minus(WINDOW);
        while (!recent.isEmpty() && !recent.peekFirst().isAfter(cutoff)) {
            recent.pollFirst();
        }
    }
}
