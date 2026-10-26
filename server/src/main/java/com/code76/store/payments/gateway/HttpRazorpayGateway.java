package com.code76.store.payments.gateway;

import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

/** Calls the Razorpay REST API with the key id and secret (HTTP Basic auth). */
public class HttpRazorpayGateway implements RazorpayGateway {

    private final RestClient http;

    public HttpRazorpayGateway(RestClient.Builder builder, String baseUrl, String keyId, String keySecret) {
        String credentials = Base64.getEncoder().encodeToString((keyId + ":" + keySecret).getBytes(StandardCharsets.UTF_8));
        this.http = builder
                .baseUrl(baseUrl)
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Basic " + credentials)
                .defaultHeader(HttpHeaders.ACCEPT, MediaType.APPLICATION_JSON_VALUE)
                .build();
    }

    @Override
    public RzpOrder createOrder(long amountPaise, String currency, String receipt, Map<String, String> notes) {
        return call("create order", () -> http.post().uri("/orders")
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("amount", amountPaise, "currency", currency, "receipt", receipt, "notes", notes))
                .retrieve().body(RzpOrder.class));
    }

    @Override
    public RzpPayment fetchPayment(String paymentId) {
        return call("fetch payment", () -> http.get().uri("/payments/{id}", paymentId).retrieve().body(RzpPayment.class));
    }

    @Override
    public RzpPayment capture(String paymentId, long amountPaise, String currency) {
        return call("capture payment", () -> http.post().uri("/payments/{id}/capture", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("amount", amountPaise, "currency", currency))
                .retrieve().body(RzpPayment.class));
    }

    @Override
    public String refund(String paymentId, long amountPaise) {
        RzpRefund refund = call("refund payment", () -> http.post().uri("/payments/{id}/refund", paymentId)
                .contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("amount", amountPaise))
                .retrieve().body(RzpRefund.class));
        return refund.id();
    }

    private static <T> T call(String what, java.util.function.Supplier<T> request) {
        try {
            T result = request.get();
            if (result == null) {
                throw new PaymentProviderException("Razorpay returned an empty response to " + what, null);
            }
            return result;
        } catch (RestClientException e) {
            throw new PaymentProviderException("Razorpay call failed: " + what, e);
        }
    }
}
