package com.code76.store.payments;

import com.code76.store.payments.gateway.HttpRazorpayGateway;
import com.code76.store.payments.gateway.RazorpayGateway;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.Map;

@Configuration(proxyBeanMethods = false)
@EnableConfigurationProperties(PaymentProperties.class)
public class PaymentsConfig {

    private static final Logger log = LoggerFactory.getLogger(PaymentsConfig.class);

    @Bean
    RazorpayGateway razorpayGateway(PaymentProperties env, PaymentKeysService keys) {
        PaymentKeys k = keys.current();
        if (k.enabled()) {
            log.info("Razorpay enabled in {} mode (key {}, from the {})", k.testMode() ? "TEST" : "LIVE", k.keyId(),
                    k.source().equals("admin") ? "admin panel" : "server settings");
        } else {
            log.info("Online payment is off until Razorpay keys are added in Admin → Store settings (or server/.env).");
        }
        return new SwitchingGateway(keys, env.baseUrl());
    }

    /**
     * Always calls Razorpay with the keys in use right now, so keys changed in the admin apply to the
     * very next payment without restarting the server.
     */
    static final class SwitchingGateway implements RazorpayGateway {
        private final PaymentKeysService keys;
        private final String baseUrl;
        private volatile String builtFor;
        private volatile RazorpayGateway delegate;

        SwitchingGateway(PaymentKeysService keys, String baseUrl) {
            this.keys = keys;
            this.baseUrl = baseUrl;
        }

        private RazorpayGateway gateway() {
            PaymentKeys k = keys.current();
            if (!k.enabled()) {
                return NOT_CONFIGURED;
            }
            String fingerprint = k.keyId() + ":" + Integer.toHexString(k.keySecret().hashCode());
            RazorpayGateway g = delegate;
            if (g == null || !fingerprint.equals(builtFor)) {
                synchronized (this) {
                    if (delegate == null || !fingerprint.equals(builtFor)) {
                        // Never wait forever on the payment provider.
                        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(5)).build();
                        JdkClientHttpRequestFactory requestFactory = new JdkClientHttpRequestFactory(client);
                        requestFactory.setReadTimeout(Duration.ofSeconds(20));
                        delegate = new HttpRazorpayGateway(RestClient.builder().requestFactory(requestFactory), baseUrl, k.keyId(), k.keySecret());
                        builtFor = fingerprint;
                    }
                    g = delegate;
                }
            }
            return g;
        }

        @Override
        public RzpOrder createOrder(long amountPaise, String currency, String receipt, Map<String, String> notes) {
            return gateway().createOrder(amountPaise, currency, receipt, notes);
        }

        @Override
        public RzpPayment fetchPayment(String paymentId) {
            return gateway().fetchPayment(paymentId);
        }

        @Override
        public RzpPayment capture(String paymentId, long amountPaise, String currency) {
            return gateway().capture(paymentId, amountPaise, currency);
        }

        @Override
        public String refund(String paymentId, long amountPaise) {
            return gateway().refund(paymentId, amountPaise);
        }
    }

    private static final RazorpayGateway NOT_CONFIGURED = new NotConfigured();

    /** Stand-in when no keys are set; PaymentService refuses before ever calling it. */
    static final class NotConfigured implements RazorpayGateway {
        @Override
        public RzpOrder createOrder(long amountPaise, String currency, String receipt, Map<String, String> notes) {
            throw new IllegalStateException("Razorpay is not configured");
        }

        @Override
        public RzpPayment fetchPayment(String paymentId) {
            throw new IllegalStateException("Razorpay is not configured");
        }

        @Override
        public RzpPayment capture(String paymentId, long amountPaise, String currency) {
            throw new IllegalStateException("Razorpay is not configured");
        }

        @Override
        public String refund(String paymentId, long amountPaise) {
            throw new IllegalStateException("Razorpay is not configured");
        }
    }
}
