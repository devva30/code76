package com.code76.store.support;

import com.code76.store.payments.gateway.PaymentProviderException;
import com.code76.store.payments.gateway.RazorpayGateway;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Stands in for Razorpay in tests: remembers the orders we create, lets a test act out
 * "the customer paid", and records captures and refunds. Nothing leaves the machine.
 */
public class FakeRazorpayGateway implements RazorpayGateway {

    public final Map<String, RzpOrder> orders = new ConcurrentHashMap<>();
    public final Map<String, RzpPayment> payments = new ConcurrentHashMap<>();
    public final List<String> captured = new CopyOnWriteArrayList<>();
    public final List<String> refunded = new CopyOnWriteArrayList<>();
    private final AtomicInteger sequence = new AtomicInteger(1000);

    @Override
    public RzpOrder createOrder(long amountPaise, String currency, String receipt, Map<String, String> notes) {
        RzpOrder order = new RzpOrder("order_FAKE" + sequence.incrementAndGet(), amountPaise, currency, "created");
        orders.put(order.id(), order);
        return order;
    }

    /** The customer completes Razorpay Checkout for this order; returns the new payment id. */
    public String pay(String razorpayOrderId, String status) {
        RzpOrder order = orders.get(razorpayOrderId);
        return put(new RzpPayment("pay_FAKE" + sequence.incrementAndGet(), razorpayOrderId, order.amount(), order.currency(), status, null));
    }

    /** For tampering tests: a payment with whatever details the test wants. */
    public String put(RzpPayment payment) {
        payments.put(payment.id(), payment);
        return payment.id();
    }

    @Override
    public RzpPayment fetchPayment(String paymentId) {
        RzpPayment payment = payments.get(paymentId);
        if (payment == null) {
            throw new PaymentProviderException("No such payment " + paymentId, null);
        }
        return payment;
    }

    @Override
    public RzpPayment capture(String paymentId, long amountPaise, String currency) {
        RzpPayment p = fetchPayment(paymentId);
        RzpPayment done = new RzpPayment(p.id(), p.orderId(), p.amount(), p.currency(), "captured", null);
        payments.put(paymentId, done);
        captured.add(paymentId);
        return done;
    }

    @Override
    public String refund(String paymentId, long amountPaise) {
        refunded.add(paymentId);
        return "rfnd_FAKE" + sequence.incrementAndGet();
    }

    public void reset() {
        orders.clear();
        payments.clear();
        captured.clear();
        refunded.clear();
    }
}
