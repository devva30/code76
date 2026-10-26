package com.code76.store.health;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;

/** Liveness plus a database round-trip. Returns 503 when the database is unreachable. */
@RestController
public class HealthController {

    private final JdbcTemplate jdbc;

    public HealthController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public record HealthResponse(String status, String database, String service, Instant timestamp) {
    }

    @GetMapping("/api/health")
    public ResponseEntity<HealthResponse> health() {
        boolean databaseUp = isDatabaseUp();
        HealthResponse body = new HealthResponse(databaseUp ? "UP" : "DOWN", databaseUp ? "UP" : "DOWN", "code76-server", Instant.now());
        return ResponseEntity.status(databaseUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    private boolean isDatabaseUp() {
        try {
            Integer one = jdbc.queryForObject("select 1", Integer.class);
            return one != null && one == 1;
        } catch (RuntimeException ex) {
            return false;
        }
    }
}
