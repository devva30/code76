package com.code76.store.support;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Replaces the real Razorpay client with {@link FakeRazorpayGateway} in integration tests. */
@TestConfiguration(proxyBeanMethods = false)
public class FakeRazorpayConfiguration {

    @Bean
    @Primary
    FakeRazorpayGateway fakeRazorpayGateway() {
        return new FakeRazorpayGateway();
    }
}
