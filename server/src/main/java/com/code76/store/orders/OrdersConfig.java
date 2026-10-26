package com.code76.store.orders;

import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

import java.time.Clock;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(ShopProperties.class)
public class OrdersConfig {

    /** One shared clock, so tests can reason about "now". */
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    /** Runs the unpaid-order expiry job. Switched off in tests, which call the job directly. */
    @Configuration(proxyBeanMethods = false)
    @EnableScheduling
    @ConditionalOnProperty(name = "app.orders.expiry-job.enabled", havingValue = "true", matchIfMissing = true)
    static class Scheduling {
    }
}
