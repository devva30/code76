package com.code76.store.orders.service;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

/**
 * Every minute: unpaid orders past their 30-minute window are marked EXPIRED and their
 * held stock goes back on sale. (Scheduling is switched off in tests, which call {@link #run()} directly.)
 */
@Component
public class OrderExpiryJob {

    private static final Logger log = LoggerFactory.getLogger(OrderExpiryJob.class);

    private final OrderService orders;

    public OrderExpiryJob(OrderService orders) {
        this.orders = orders;
    }

    @Scheduled(fixedDelayString = "${app.orders.expiry-job.interval:PT1M}", initialDelayString = "${app.orders.expiry-job.initial-delay:PT30S}")
    public int run() {
        int expired = orders.expireOverdue();
        if (expired > 0) {
            log.info("Expired {} unpaid order(s) and released their stock", expired);
        }
        return expired;
    }
}
