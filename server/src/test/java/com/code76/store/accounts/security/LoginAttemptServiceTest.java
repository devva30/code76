package com.code76.store.accounts.security;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;

class LoginAttemptServiceTest {

    /** A clock the test can move forward. */
    static final class TestClock extends Clock {
        Instant now = Instant.parse("2026-10-22T10:00:00Z");

        void advance(Duration d) { now = now.plus(d); }

        @Override public ZoneId getZone() { return ZoneOffset.UTC; }
        @Override public Clock withZone(ZoneId zone) { return this; }
        @Override public Instant instant() { return now; }
    }

    final TestClock clock = new TestClock();
    final LoginAttemptService attempts = new LoginAttemptService(clock);
    final String key = LoginAttemptService.key("riya@example.com", "203.0.113.7");

    @Test
    void allowsUpToFourFailures() {
        for (int i = 0; i < 4; i++) {
            attempts.recordFailure(key);
        }
        assertThat(attempts.lockedFor(key)).isEmpty();
    }

    @Test
    void locksAfterFiveFailuresUntilTheOldestAgesOut() {
        for (int i = 0; i < 5; i++) {
            attempts.recordFailure(key);
            clock.advance(Duration.ofMinutes(1));
        }
        // First failure was 5 minutes ago, so 10 minutes remain.
        assertThat(attempts.lockedFor(key)).contains(Duration.ofMinutes(10));

        clock.advance(Duration.ofMinutes(10));
        assertThat(attempts.lockedFor(key)).isEmpty();
    }

    @Test
    void successfulSignInClearsTheCount() {
        for (int i = 0; i < 4; i++) {
            attempts.recordFailure(key);
        }
        attempts.reset(key);
        attempts.recordFailure(key);
        assertThat(attempts.lockedFor(key)).isEmpty();
    }

    @Test
    void otherEmailsAndAddressesAreUnaffected() {
        for (int i = 0; i < 5; i++) {
            attempts.recordFailure(key);
        }
        assertThat(attempts.lockedFor(LoginAttemptService.key("arjun@example.com", "203.0.113.7"))).isEmpty();
        assertThat(attempts.lockedFor(LoginAttemptService.key("riya@example.com", "198.51.100.2"))).isEmpty();
    }
}
