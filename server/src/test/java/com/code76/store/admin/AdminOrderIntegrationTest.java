package com.code76.store.admin;

import com.code76.store.payments.gateway.RazorpaySignatures;
import com.code76.store.support.AdminTestSupport;
import com.code76.store.support.FakeRazorpayGateway;
import com.code76.store.support.IntegrationTest;
import com.code76.store.support.ShopTestData;
import com.code76.store.support.TestBrowser;
import com.jayway.jsonpath.JsonPath;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.web.servlet.MockMvc;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@IntegrationTest
class AdminOrderIntegrationTest {

    static final String SKU = "C76-FORM-NOIR-M";

    @Autowired
    MockMvc mvc;

    @Autowired
    JdbcTemplate jdbc;

    @Autowired
    FakeRazorpayGateway razorpay;

    TestBrowser admin;
    TestBrowser customer;
    String customerEmail;
    ShopTestData data;

    @BeforeEach
    void setUp() throws Exception {
        data = new ShopTestData(jdbc);
        data.setStock(SKU, 20);
        razorpay.reset();
        admin = AdminTestSupport.signedInAdmin(mvc);
        customer = new TestBrowser(mvc);
        customerEmail = "fulfil+" + UUID.randomUUID().toString().substring(0, 8) + "@example.com";
        customer.register("Meera Iyer", customerEmail, "correct horse battery").andExpect(status().isCreated());
    }

    @AfterEach
    void tearDown() {
        data.reset();
    }

    private String placeOrder() throws Exception {
        customer.postJson("/api/me/cart/items", "{\"slug\": \"form-oversized-tee\", \"color\": \"noir\", \"size\": \"M\", \"quantity\": 2}").andExpect(status().isOk());
        String body = customer.postJson("/api/me/orders", """
                {"address": {"fullName": "Meera Iyer", "phone": "9123456780", "line1": "7 Marine Drive", "city": "Mumbai",
                 "state": "Maharashtra", "pincode": "400020"}, "idempotencyKey": "%s"}""".formatted(UUID.randomUUID()))
                .andExpect(status().isCreated()).andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.orderNumber");
    }

    private String placePaidOrder() throws Exception {
        String number = placeOrder();
        String rzpOrder = JsonPath.read(customer.postJson("/api/me/orders/" + number + "/payment", "{}").andReturn().getResponse().getContentAsString(), "$.razorpayOrderId");
        String rzpPayment = razorpay.pay(rzpOrder, "captured");
        customer.postJson("/api/me/orders/" + number + "/payment/verify", """
                {"razorpayOrderId": "%s", "razorpayPaymentId": "%s", "razorpaySignature": "%s"}""".formatted(
                rzpOrder, rzpPayment, RazorpaySignatures.hmacHex(rzpOrder + "|" + rzpPayment, "fake_key_secret_for_tests")))
                .andExpect(jsonPath("$.status").value("confirmed"));
        return number;
    }

    @Test
    void ordersCanBeFoundByNumberNameEmailOrPhoneAndFilteredByStatus() throws Exception {
        String number = placeOrder();

        admin.get("/api/admin/orders").andExpect(jsonPath("$.items[*].orderNumber", hasItem(number)));
        for (String q : new String[] {number, "meera", customerEmail.toUpperCase(), "91234"}) {
            admin.get("/api/admin/orders?q=" + q).andExpect(jsonPath("$.items[0].orderNumber").value(number));
        }
        admin.get("/api/admin/orders?status=pending_payment&q=" + number).andExpect(jsonPath("$.totalItems").value(1));
        admin.get("/api/admin/orders?status=confirmed&q=" + number).andExpect(jsonPath("$.totalItems").value(0));
        admin.get("/api/admin/orders/" + number)
                .andExpect(jsonPath("$.customerEmail").value(customerEmail))
                .andExpect(jsonPath("$.order.items[0].quantity").value(2))
                .andExpect(jsonPath("$.history[0].type").value("PLACED"))
                .andExpect(jsonPath("$.canShip").value(false))
                .andExpect(jsonPath("$.canCancel").value(true));
    }

    @Test
    void paidOrdersAreShippedThenDeliveredAndTheCustomerSeesIt() throws Exception {
        String number = placePaidOrder();

        admin.postJson("/api/admin/orders/" + number + "/ship", """
                        {"courier": "Delhivery", "trackingNumber": "DL123456789IN", "trackingUrl": "https://www.delhivery.com/track/package/DL123456789IN"}""")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("shipped"))
                .andExpect(jsonPath("$.canDeliver").value(true));

        customer.get("/api/me/orders/" + number)
                .andExpect(jsonPath("$.status").value("shipped"))
                .andExpect(jsonPath("$.shipment.courier").value("Delhivery"))
                .andExpect(jsonPath("$.shipment.trackingNumber").value("DL123456789IN"))
                .andExpect(jsonPath("$.timeline[*].type", contains("PLACED", "PAID", "SHIPPED")));

        admin.postJson("/api/admin/orders/" + number + "/deliver", "{}").andExpect(jsonPath("$.order.status").value("delivered"));
        customer.get("/api/me/orders/" + number)
                .andExpect(jsonPath("$.shipment.deliveredAt").exists())
                .andExpect(jsonPath("$.timeline[3].type").value("DELIVERED"));
        admin.get("/api/admin/orders/" + number).andExpect(jsonPath("$.history[2].actor").value(AdminTestSupport.ADMIN_EMAIL));
    }

    @Test
    void shippingRulesAreEnforced() throws Exception {
        String unpaid = placeOrder();
        admin.postJson("/api/admin/orders/" + unpaid + "/ship", "{\"courier\": \"Delhivery\", \"trackingNumber\": \"X1\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NOT_SHIPPABLE"));
        admin.postJson("/api/admin/orders/" + unpaid + "/deliver", "{}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NOT_DELIVERABLE"));

        String paid = placePaidOrder();
        admin.postJson("/api/admin/orders/" + paid + "/ship", "{\"courier\": \"Delhivery\", \"trackingNumber\": \"X1\", \"trackingUrl\": \"http://insecure.example\"}")
                .andExpect(status().isBadRequest()).andExpect(jsonPath("$.errors[0].field").value("trackingUrl"));
        admin.postJson("/api/admin/orders/" + paid + "/ship", "{\"courier\": \"\", \"trackingNumber\": \"\"}").andExpect(status().isBadRequest());
    }

    @Test
    void cancellingAnUnpaidOrderReleasesItsStock() throws Exception {
        String number = placeOrder();
        assertThat(data.reserved(SKU)).isEqualTo(2);

        admin.postJson("/api/admin/orders/" + number + "/cancel", "{\"reason\": \"Duplicate order\"}")
                .andExpect(jsonPath("$.order.status").value("cancelled"));

        assertThat(data.reserved(SKU)).isZero();
        customer.get("/api/me/orders/" + number)
                .andExpect(jsonPath("$.cancelReason").value("Duplicate order"))
                .andExpect(jsonPath("$.refunded").value(false));
    }

    @Test
    void cancellingAPaidOrderRestocksAndRefunds() throws Exception {
        String number = placePaidOrder();
        int shelfAfterSale = data.onHand(SKU);

        admin.postJson("/api/admin/orders/" + number + "/cancel", "{\"reason\": \"Damaged in our warehouse\"}")
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.order.status").value("cancelled"))
                .andExpect(jsonPath("$.order.refunded").value(true))
                .andExpect(jsonPath("$.payments[0].status").value("refunded"))
                .andExpect(jsonPath("$.history[*].type", hasItem("REFUNDED")));

        assertThat(data.onHand(SKU)).isEqualTo(shelfAfterSale + 2);
        assertThat(razorpay.refunded).hasSize(1);
    }

    @Test
    void shippedOrdersCantBeCancelled() throws Exception {
        String number = placePaidOrder();
        admin.postJson("/api/admin/orders/" + number + "/ship", "{\"courier\": \"Blue Dart\", \"trackingNumber\": \"BD1\"}").andExpect(status().isOk());

        admin.postJson("/api/admin/orders/" + number + "/cancel", "{\"reason\": \"Changed mind\"}")
                .andExpect(status().isConflict()).andExpect(jsonPath("$.error").value("NOT_CANCELLABLE"));
        assertThat(razorpay.refunded).isEmpty();
    }

    @Test
    void customersCantManageOrders() throws Exception {
        String number = placePaidOrder();
        customer.get("/api/admin/orders").andExpect(status().isForbidden());
        customer.postJson("/api/admin/orders/" + number + "/ship", "{\"courier\": \"Me\", \"trackingNumber\": \"1\"}").andExpect(status().isForbidden());
    }
}
