package com.code76.store.payments;

import com.code76.store.orders.service.OrderExpiryJob;
import com.code76.store.payments.gateway.RazorpayGateway.RzpPayment;
import com.code76.store.payments.gateway.RazorpaySignatures;
import com.code76.store.support.FakeRazorpayGateway;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.ShopTestData;
import com.code76.store.support.TestBrowser;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

import java.nio.charset.StandardCharsets;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.greaterThan;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class PaymentIntegrationTest {

    static final String SKU = "C76-FORM-NOIR-M";
    static final String KEY_SECRET = "fake_key_secret_for_tests";
    static final String WEBHOOK_SECRET = "fake_webhook_secret_for_tests";
    static final String ADDRESS = """
            {"fullName": "Riya Sharma", "phone": "9876543210", "line1": "12, MG Road",
             "city": "Bengaluru", "state": "Karnataka", "pincode": "560001"}""";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeRazorpayGateway razorpay;

    @Autowired
    OrderExpiryJob expiryJob;

    ShopTestData data;
    TestBrowser riya;

    @BeforeEach
    void setUp() throws Exception {
        data = new ShopTestData(jdbc);
        data.setStock(SKU, 20); // paying really sells stock; this is restored afterwards
        razorpay.reset();
        riya = new TestBrowser(mvc);
        riya.register("Riya Sharma", "pay+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "correct horse battery")
                .andExpect(status().isCreated());
    }

    @AfterEach
    void tearDown() {
        data.reset();
    }

    // ---- helpers acting out the customer's steps ----

    private String placeOrder(TestBrowser b) throws Exception {
        b.postJson("/api/me/cart/items", "{\"slug\": \"form-oversized-tee\", \"color\": \"noir\", \"size\": \"M\", \"quantity\": 1}")
                .andExpect(status().isOk());
        String body = b.postJson("/api/me/orders", "{\"address\": " + ADDRESS + ", \"idempotencyKey\": \"" + UUID.randomUUID() + "\"}")
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.orderNumber");
    }

    /** Clicks Pay: returns the Razorpay order id the server created. */
    private String startPayment(String orderNumber) throws Exception {
        String body = riya.postJson("/api/me/orders/" + orderNumber + "/payment", "{}")
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.razorpayOrderId");
    }

    private ResultActions verify(String orderNumber, String rzpOrderId, String rzpPaymentId, String signature) throws Exception {
        return riya.postJson("/api/me/orders/" + orderNumber + "/payment/verify", """
                {"razorpayOrderId": "%s", "razorpayPaymentId": "%s", "razorpaySignature": "%s"}""".formatted(rzpOrderId, rzpPaymentId, signature));
    }

    private static String sign(String rzpOrderId, String rzpPaymentId) {
        return RazorpaySignatures.hmacHex(rzpOrderId + "|" + rzpPaymentId, KEY_SECRET);
    }

    private ResultActions webhook(String event, String rzpOrderId, String rzpPaymentId, long amount, String status, String eventId,
                                  String secret) throws Exception {
        byte[] body = """
                {"entity": "event", "event": "%s", "payload": {"payment": {"entity": {
                  "id": "%s", "order_id": "%s", "amount": %d, "currency": "INR", "status": "%s",
                  "error_description": "Payment was declined by the bank"}}}}""".formatted(event, rzpPaymentId, rzpOrderId, amount, status)
                .getBytes(StandardCharsets.UTF_8);
        return mvc.perform(post("/api/webhooks/razorpay")
                .contentType(MediaType.APPLICATION_JSON)
                .header("X-Razorpay-Signature", RazorpaySignatures.hmacHex(body, secret))
                .header("X-Razorpay-Event-Id", eventId)
                .content(body));
    }

    // ---- tests ----

    @Test
    void startingPaymentCreatesOneRazorpayOrderForTheExactTotal() throws Exception {
        String number = placeOrder(riya);

        String body = riya.postJson("/api/me/orders/" + number + "/payment", "{}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.keyId").value("rzp_test_fakekey00001"))
                .andExpect(jsonPath("$.amount.amountPaise").value(258900))
                .andExpect(jsonPath("$.orderNumber").value(number))
                .andExpect(jsonPath("$.prefill.contact").value("+919876543210"))
                .andExpect(jsonPath("$.prefill.email").exists())
                .andExpect(jsonPath("$.timeoutSeconds", greaterThan(1700)))
                .andExpect(jsonPath("$.testMode").value(true))
                .andExpect(jsonPath("$.keySecret").doesNotExist())
                .andReturn().getResponse().getContentAsString();

        String again = startPayment(number);
        assertThat(again).isEqualTo(JsonPath.read(body, "$.razorpayOrderId"));
        assertThat(razorpay.orders).hasSize(1);
        assertThat(razorpay.orders.get(again).amount()).isEqualTo(258900);
    }

    @Test
    void aVerifiedPaymentConfirmsTheOrderAndSellsTheHeldStock() throws Exception {
        String number = placeOrder(riya);
        int shelfBefore = data.onHand(SKU);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("confirmed"))
                .andExpect(jsonPath("$.paidAt").exists())
                .andExpect(jsonPath("$.canPay").value(false))
                .andExpect(jsonPath("$.canCancel").value(false))
                .andExpect(jsonPath("$.refunded").value(false));

        assertThat(data.onHand(SKU)).isEqualTo(shelfBefore - 1);
        assertThat(data.reserved(SKU)).isZero();
    }

    @Test
    void aForgedSignatureIsRejectedAndNothingChanges() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        verify(number, rzpOrder, rzpPayment, "0".repeat(64))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("PAYMENT_VERIFICATION_FAILED"));
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.status").value("pending_payment"));
        assertThat(data.reserved(SKU)).isEqualTo(1);
    }

    @Test
    void aGenuineSignatureForTheWrongAmountIsRejected() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        // Correctly signed, but Razorpay says only ₹1 was paid.
        String rzpPayment = razorpay.put(new RzpPayment("pay_FAKEcheap1", rzpOrder, 100, "INR", "captured", null));

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("PAYMENT_VERIFICATION_FAILED"));
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.status").value("pending_payment"));
    }

    @Test
    void aFailedPaymentIsNotAcceptedEvenWhenSigned() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "failed");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment)).andExpect(status().isBadRequest());
    }

    @Test
    void authorisedPaymentsAreCapturedBeforeConfirming() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "authorized");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment)).andExpect(jsonPath("$.status").value("confirmed"));
        assertThat(razorpay.captured).containsExactly(rzpPayment);
    }

    @Test
    void verifyingTwiceIsHarmless() throws Exception {
        String number = placeOrder(riya);
        int shelfBefore = data.onHand(SKU);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment)).andExpect(status().isOk());
        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment)).andExpect(jsonPath("$.status").value("confirmed"));
        assertThat(data.onHand(SKU)).isEqualTo(shelfBefore - 1);
    }

    @Test
    void onlyTheOwnerCanPayAndOnlyWhileTheOrderIsOpen() throws Exception {
        String number = placeOrder(riya);

        TestBrowser stranger = new TestBrowser(mvc);
        stranger.register("Arjun", "pay+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com", "another long passphrase");
        stranger.postJson("/api/me/orders/" + number + "/payment", "{}").andExpect(status().isNotFound());

        jdbc.update("update orders set expires_at = now() + interval '30 seconds' where order_number = ?", number);
        riya.postJson("/api/me/orders/" + number + "/payment", "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("PAYMENT_WINDOW_CLOSED"));
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.canPay").value(false));

        riya.postJson("/api/me/orders/" + number + "/cancel", "{}");
        riya.postJson("/api/me/orders/" + number + "/payment", "{}")
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.error").value("ORDER_NOT_PAYABLE"));
    }

    @Test
    void theWebhookConfirmsOrdersEvenIfTheBrowserNeverComesBack() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        webhook("payment.captured", rzpOrder, rzpPayment, 258900, "captured", "evt_1" + number, WEBHOOK_SECRET)
                .andExpect(status().isOk());
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.status").value("confirmed"));
    }

    @Test
    void webhooksWithABadSignatureAreRejected() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        webhook("payment.captured", rzpOrder, rzpPayment, 258900, "captured", "evt_2" + number, "not-the-secret")
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.error").value("INVALID_SIGNATURE"));
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.status").value("pending_payment"));
    }

    @Test
    void aRepeatedWebhookIsHandledOnce() throws Exception {
        String number = placeOrder(riya);
        int shelfBefore = data.onHand(SKU);
        String rzpOrder = startPayment(number);
        String rzpPayment = razorpay.pay(rzpOrder, "captured");
        String eventId = "evt_3" + number;

        webhook("payment.captured", rzpOrder, rzpPayment, 258900, "captured", eventId, WEBHOOK_SECRET).andExpect(status().isOk());
        webhook("payment.captured", rzpOrder, rzpPayment, 258900, "captured", eventId, WEBHOOK_SECRET).andExpect(status().isOk());

        assertThat(data.onHand(SKU)).isEqualTo(shelfBefore - 1);
        assertThat(jdbc.queryForObject("select count(*) from payment_webhook_events where event_id = ?", Integer.class, eventId)).isEqualTo(1);
    }

    @Test
    void aFailedAttemptIsRecordedAndTheCustomerCanTryAgain() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);

        webhook("payment.failed", rzpOrder, "pay_FAKEfail01", 258900, "failed", "evt_4" + number, WEBHOOK_SECRET).andExpect(status().isOk());

        assertThat(jdbc.queryForObject("select failure_reason from payments where provider_order_id = ?", String.class, rzpOrder))
                .isEqualTo("Payment was declined by the bank");
        riya.get("/api/me/orders/" + number).andExpect(jsonPath("$.canPay").value(true));
    }

    @Test
    void aLatePaymentRevivesTheOrderIfTheStockIsStillThere() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        jdbc.update("update orders set expires_at = now() - interval '1 minute' where order_number = ?", number);
        expiryJob.run();
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment))
                .andExpect(jsonPath("$.status").value("confirmed"))
                .andExpect(jsonPath("$.refunded").value(false));
        assertThat(razorpay.refunded).isEmpty();
    }

    @Test
    void aLatePaymentIsRefundedIfTheStockHasGone() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        jdbc.update("update orders set expires_at = now() - interval '1 minute' where order_number = ?", number);
        expiryJob.run();
        data.setStock(SKU, 0); // someone else bought the last ones meanwhile
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        verify(number, rzpOrder, rzpPayment, sign(rzpOrder, rzpPayment))
                .andExpect(jsonPath("$.status").value("expired"))
                .andExpect(jsonPath("$.refunded").value(true));
        assertThat(razorpay.refunded).containsExactly(rzpPayment);
        assertThat(data.onHand(SKU)).isZero();
    }

    @Test
    void paymentForACancelledOrderIsRefunded() throws Exception {
        String number = placeOrder(riya);
        String rzpOrder = startPayment(number);
        riya.postJson("/api/me/orders/" + number + "/cancel", "{}").andExpect(status().isOk());
        String rzpPayment = razorpay.pay(rzpOrder, "captured");

        webhook("order.paid", rzpOrder, rzpPayment, 258900, "captured", "evt_5" + number, WEBHOOK_SECRET).andExpect(status().isOk());

        riya.get("/api/me/orders/" + number)
                .andExpect(jsonPath("$.status").value("cancelled"))
                .andExpect(jsonPath("$.refunded").value(true));
        assertThat(razorpay.refunded).containsExactly(rzpPayment);
    }
}
