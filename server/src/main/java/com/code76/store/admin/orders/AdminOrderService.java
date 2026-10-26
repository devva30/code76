package com.code76.store.admin.orders;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.audit.AdminAuditService;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.repository.InventoryRepository;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.orders.domain.CustomerOrder;
import com.code76.store.orders.domain.OrderItem;
import com.code76.store.orders.domain.OrderStatus;
import com.code76.store.orders.dto.OrderDtos.OrderDetailDto;
import com.code76.store.orders.repository.CustomerOrderRepository;
import com.code76.store.orders.service.OrderEvents;
import com.code76.store.orders.service.OrderEvents.OrderEvent;
import com.code76.store.orders.service.OrderService;
import com.code76.store.payments.repository.PaymentRepository;
import com.code76.store.payments.service.PaymentService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Order handling for the store team: find orders, ship, deliver, cancel (with refund when paid). */
@Service
@Transactional
public class AdminOrderService {

    public record OrderRow(String orderNumber, Instant placedAt, String status, String customerName, String email, String phone,
                           String city, int itemCount, Money total) {
    }

    public record PaymentInfo(String razorpayOrderId, String razorpayPaymentId, Money amount, String status, String refundId,
                              String failureReason, Instant paidAt) {
    }

    public record AdminOrderDetail(OrderDetailDto order, String customerEmail, String customerName, List<PaymentInfo> payments,
                                   List<OrderEvent> history, boolean canShip, boolean canDeliver, boolean canCancel) {
    }

    private final CustomerOrderRepository orders;
    private final OrderService orderService;
    private final PaymentService paymentService;
    private final PaymentRepository payments;
    private final InventoryRepository inventory;
    private final OrderEvents events;
    private final AdminAuditService audit;
    private final JdbcTemplate jdbc;
    private final Clock clock;

    public AdminOrderService(CustomerOrderRepository orders, OrderService orderService, PaymentService paymentService,
                             PaymentRepository payments, InventoryRepository inventory, OrderEvents events,
                             AdminAuditService audit, JdbcTemplate jdbc, Clock clock) {
        this.orders = orders;
        this.orderService = orderService;
        this.paymentService = paymentService;
        this.payments = payments;
        this.inventory = inventory;
        this.events = events;
        this.audit = audit;
        this.jdbc = jdbc;
        this.clock = clock;
    }

    /** Orders newest first, optionally by status and by a search over number, name, email and phone. */
    @Transactional(readOnly = true)
    public PageResponse<OrderRow> list(String status, String query, int page, int pageSize) {
        StringBuilder where = new StringBuilder(" where 1 = 1");
        List<Object> args = new ArrayList<>();
        if (status != null && !status.isBlank()) {
            where.append(" and o.status = ?");
            args.add(status.toUpperCase(Locale.ROOT));
        }
        if (query != null && !query.isBlank()) {
            String like = "%" + query.trim().toLowerCase(Locale.ROOT).replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
            where.append(" and (lower(o.order_number) like ? or lower(o.ship_name) like ? or lower(u.email) like ? or o.ship_phone like ?)");
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like.replaceAll("[\\s+]", ""));
        }
        String from = " from orders o join users u on u.id = o.user_id";
        Long total = jdbc.queryForObject("select count(*)" + from + where, Long.class, args.toArray());
        List<Object> pageArgs = new ArrayList<>(args);
        pageArgs.add(pageSize);
        pageArgs.add((long) page * pageSize);
        List<OrderRow> rows = jdbc.query("""
                select o.order_number, o.placed_at, o.status, o.ship_name, u.email, o.ship_phone, o.ship_city, o.total_paise,
                       (select coalesce(sum(quantity), 0) from order_items i where i.order_id = o.id) as item_count
                """ + from + where + " order by o.placed_at desc, o.id desc limit ? offset ?",
                (rs, n) -> new OrderRow(rs.getString("order_number"), rs.getTimestamp("placed_at").toInstant(),
                        rs.getString("status").toLowerCase(Locale.ROOT), rs.getString("ship_name"), rs.getString("email"),
                        rs.getString("ship_phone"), rs.getString("ship_city"), rs.getInt("item_count"), Money.inr(rs.getLong("total_paise"))),
                pageArgs.toArray());
        long count = total == null ? 0 : total;
        return new PageResponse<>(rows, page, pageSize, count, (int) Math.ceil(count / (double) pageSize));
    }

    @Transactional(readOnly = true)
    public AdminOrderDetail detail(String orderNumber) {
        return toDetail(find(orderNumber));
    }

    public AdminOrderDetail ship(String orderNumber, String courier, String trackingNumber, String trackingUrl, AccountPrincipal admin) {
        CustomerOrder order = lock(orderNumber);
        if (order.getStatus() != OrderStatus.CONFIRMED) {
            throw new ConflictException("NOT_SHIPPABLE", "Only paid orders that haven't shipped yet can be marked as shipped.");
        }
        order.markShipped(courier.trim(), trackingNumber.trim(), blankToNull(trackingUrl), clock.instant());
        events.record(order.getId(), "SHIPPED", "Shipped with " + courier.trim() + " (tracking " + trackingNumber.trim() + ")", admin.getUsername());
        audit.record(admin, "ORDER_SHIPPED", "order", orderNumber, "Marked " + orderNumber + " as shipped with " + courier.trim());
        return toDetail(orders.saveAndFlush(order));
    }

    public AdminOrderDetail deliver(String orderNumber, AccountPrincipal admin) {
        CustomerOrder order = lock(orderNumber);
        if (order.getStatus() != OrderStatus.SHIPPED) {
            throw new ConflictException("NOT_DELIVERABLE", "Only shipped orders can be marked as delivered.");
        }
        order.markDelivered(clock.instant());
        events.record(order.getId(), "DELIVERED", "Delivered", admin.getUsername());
        audit.record(admin, "ORDER_DELIVERED", "order", orderNumber, "Marked " + orderNumber + " as delivered");
        return toDetail(orders.saveAndFlush(order));
    }

    /**
     * Cancels before shipping. Unpaid: the held stock is released. Paid: the stock goes back on the
     * shelf and the payment is refunded through Razorpay, all in one step; if the refund fails, nothing changes.
     */
    public AdminOrderDetail cancel(String orderNumber, String reason, AccountPrincipal admin) {
        CustomerOrder order = lock(orderNumber);
        String why = reason.trim();
        switch (order.getStatus()) {
            case PENDING_PAYMENT -> {
                orderService.releaseStock(order);
                order.cancelByStore(why, clock.instant());
                events.record(order.getId(), "CANCELLED", "Cancelled by CODE76: " + why, admin.getUsername());
            }
            case CONFIRMED -> {
                for (OrderItem item : order.getItems()) {
                    if (item.getVariantId() != null) {
                        inventory.restock(item.getVariantId(), item.getQuantity());
                    }
                }
                String refundId = paymentService.refundPaidOrder(order);
                order.cancelByStore(why, clock.instant());
                events.record(order.getId(), "CANCELLED", "Cancelled by CODE76: " + why, admin.getUsername());
                events.record(order.getId(), "REFUNDED", "Full refund started (" + refundId + ")", admin.getUsername());
            }
            default -> throw new ConflictException("NOT_CANCELLABLE",
                    "This order is " + order.getStatus().apiValue().replace('_', ' ') + ", so it can't be cancelled here.");
        }
        audit.record(admin, "ORDER_CANCELLED", "order", orderNumber, "Cancelled " + orderNumber + ": " + why);
        return toDetail(orders.saveAndFlush(order));
    }

    private AdminOrderDetail toDetail(CustomerOrder o) {
        String email = jdbc.queryForObject("select email from users where id = ?", String.class, o.getUserId());
        String name = jdbc.queryForObject("select full_name from users where id = ?", String.class, o.getUserId());
        List<PaymentInfo> paymentInfo = payments.findByOrderId(o.getId()).stream()
                .map(p -> new PaymentInfo(p.getProviderOrderId(), p.getProviderPaymentId(), Money.inr(p.getAmountPaise()),
                        p.getStatus().name().toLowerCase(Locale.ROOT), p.getRefundId(), p.getFailureReason(), p.getPaidAt()))
                .toList();
        OrderStatus s = o.getStatus();
        return new AdminOrderDetail(orderService.toDetail(o), email, name, paymentInfo, events.forOrder(o.getId()),
                s == OrderStatus.CONFIRMED, s == OrderStatus.SHIPPED, s == OrderStatus.PENDING_PAYMENT || s == OrderStatus.CONFIRMED);
    }

    private CustomerOrder find(String orderNumber) {
        Long userId = ownerOf(orderNumber);
        return orders.findByOrderNumberAndUserId(orderNumber, userId).orElseThrow(() -> notFound(orderNumber));
    }

    private CustomerOrder lock(String orderNumber) {
        Long userId = ownerOf(orderNumber);
        return orders.lockByOrderNumberAndUserId(orderNumber, userId).orElseThrow(() -> notFound(orderNumber));
    }

    private Long ownerOf(String orderNumber) {
        List<Long> ids = jdbc.queryForList("select user_id from orders where order_number = ?", Long.class, orderNumber);
        if (ids.isEmpty()) {
            throw notFound(orderNumber);
        }
        return ids.getFirst();
    }

    private static ResourceNotFoundException notFound(String orderNumber) {
        return new ResourceNotFoundException("No order found for '" + orderNumber + "'.");
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v.trim();
    }
}
