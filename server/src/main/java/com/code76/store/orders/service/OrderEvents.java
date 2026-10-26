package com.code76.store.orders.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.List;

/** Each order's timeline. Written in the same transaction as the change it describes. */
@Component
public class OrderEvents {

    public static final String CUSTOMER = "customer";
    public static final String SYSTEM = "system";
    public static final String RAZORPAY = "razorpay";

    public record OrderEvent(String type, String message, String actor, Instant at) {
    }

    private final JdbcTemplate jdbc;

    public OrderEvents(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public void record(Long orderId, String type, String message, String actor) {
        jdbc.update("insert into order_events (order_id, type, message, actor) values (?, ?, ?, ?)",
                orderId, type, message.length() > 500 ? message.substring(0, 497) + "…" : message, actor);
    }

    public List<OrderEvent> forOrder(Long orderId) {
        return jdbc.query("select type, message, actor, created_at from order_events where order_id = ? order by id",
                (rs, n) -> new OrderEvent(rs.getString("type"), rs.getString("message"), rs.getString("actor"),
                        rs.getTimestamp("created_at").toInstant()),
                orderId);
    }
}
