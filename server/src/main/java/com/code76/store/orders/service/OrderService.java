package com.code76.store.orders.service;

import com.code76.store.catalogue.domain.ProductVariant;
import com.code76.store.catalogue.dto.CatalogueDtos.ImageDto;
import com.code76.store.catalogue.dto.CatalogueDtos.Money;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.catalogue.repository.InventoryRepository;
import com.code76.store.common.error.ApiError.FieldProblem;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.InvalidRequestException;
import com.code76.store.common.error.ResourceNotFoundException;
import com.code76.store.settings.StoreSettingsService;
import com.code76.store.orders.domain.CartItem;
import com.code76.store.orders.domain.CustomerOrder;
import com.code76.store.orders.domain.OrderItem;
import com.code76.store.orders.domain.OrderStatus;
import com.code76.store.orders.domain.ShippingAddress;
import com.code76.store.orders.dto.OrderDtos.AddressDto;
import com.code76.store.orders.dto.OrderDtos.AddressRequest;
import com.code76.store.orders.dto.OrderDtos.CartDto;
import com.code76.store.orders.dto.OrderDtos.CheckoutRequest;
import com.code76.store.orders.dto.OrderDtos.OrderDetailDto;
import com.code76.store.orders.dto.OrderDtos.OrderItemDto;
import com.code76.store.orders.dto.OrderDtos.OrderSummaryDto;
import com.code76.store.orders.dto.OrderDtos.Shipment;
import com.code76.store.orders.dto.OrderDtos.TimelineEntry;
import com.code76.store.orders.repository.CartItemRepository;
import com.code76.store.orders.repository.CustomerOrderRepository;
import com.code76.store.payments.PaymentKeysService;
import com.code76.store.payments.domain.Payment;
import com.code76.store.payments.repository.PaymentRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Checkout and order history. Placing an order is one database transaction: re-check the bag,
 * hold the stock, save the order, empty the bag. If any step fails, none of it happened.
 */
@Service
@Transactional
public class OrderService {

    private static final Logger log = LoggerFactory.getLogger(OrderService.class);
    private static final int EXPIRY_BATCH = 100;
    /** Paying with less than this left would likely run past the hold, so the Pay button is withdrawn. */
    public static final Duration MIN_TIME_TO_PAY = Duration.ofSeconds(60);

    private final CustomerOrderRepository orders;
    private final CartItemRepository cartItems;
    private final InventoryRepository inventory;
    private final CartService carts;
    private final OrderNumberGenerator orderNumbers;
    private final StoreSettingsService settings;
    private final Clock clock;
    private final PaymentRepository payments;
    private final PaymentKeysService paymentKeys;
    private final OrderEvents events;

    public OrderService(CustomerOrderRepository orders, CartItemRepository cartItems, InventoryRepository inventory,
                        CartService carts, OrderNumberGenerator orderNumbers, StoreSettingsService settings, Clock clock,
                        PaymentRepository payments, PaymentKeysService paymentKeys, OrderEvents events) {
        this.orders = orders;
        this.cartItems = cartItems;
        this.inventory = inventory;
        this.carts = carts;
        this.orderNumbers = orderNumbers;
        this.settings = settings;
        this.clock = clock;
        this.payments = payments;
        this.paymentKeys = paymentKeys;
        this.events = events;
    }

    /** The result of a checkout. {@code created} is false when an earlier identical request already placed it. */
    public record PlacedOrder(OrderDetailDto order, boolean created) {
    }

    public PlacedOrder placeOrder(Long userId, CheckoutRequest request) {
        // 1. Same checkout submitted twice (double-click, network retry)? Hand back the first order.
        Optional<CustomerOrder> earlier = orders.findByUserIdAndIdempotencyKey(userId, request.idempotencyKey());
        if (earlier.isPresent()) {
            return new PlacedOrder(toDetail(earlier.get()), false);
        }
        AddressRequest address = request.address();
        if (!IndianStates.isValid(address.state())) {
            throw new InvalidRequestException("address.state", "must be an Indian state or union territory");
        }

        // 2. Re-check the bag on the server: prices and stock come from the database, never from the browser.
        List<CartItem> lines = cartItems.findForUser(userId);
        if (lines.isEmpty()) {
            throw new ConflictException("CART_EMPTY", "Your bag is empty.");
        }
        CartDto cart = carts.build(lines);
        if (!cart.readyForCheckout()) {
            throw needsAttention(cart.lines().stream()
                    .filter(l -> l.issue() != null)
                    .map(l -> new FieldProblem(l.sku(), describe(l.issue(), l.availableQuantity())))
                    .toList());
        }

        // 3. Build the order from that server-side view, copying names and prices as they are right now.
        Instant now = clock.instant();
        CustomerOrder order = new CustomerOrder(orderNumbers.next(), userId, toAddress(address), request.idempotencyKey(),
                now, now.plus(settings.rules().paymentWindow()));
        for (CartItem line : lines) {
            ProductVariant v = line.getVariant();
            ImageDto image = CartService.imageFor(v);
            order.addItem(new OrderItem(v.getId(), v.getSku(), v.getProduct().getSlug(), v.getProduct().getName(),
                    v.getColor().getName(), v.getSize().name(), image == null ? null : image.url(),
                    CartService.unitPricePaise(v), line.getQuantity()));
        }
        order.setShippingPaise(settings.rules().shippingFor(order.getSubtotalPaise()));

        // 4. Hold the stock. Always in the same (variant id) order, so two checkouts can't deadlock each other.
        //    If someone else took the last unit a moment ago, reserve() changes nothing and we stop here.
        for (CartItem line : lines.stream().sorted(Comparator.comparing(l -> l.getVariant().getId())).toList()) {
            if (inventory.reserve(line.getVariant().getId(), line.getQuantity()) == 0) {
                throw needsAttention(List.of(new FieldProblem(line.getVariant().getSku(),
                        "This size just sold out or has fewer left than your bag asks for.")));
            }
        }

        // 5. Save the order and empty the bag.
        try {
            orders.saveAndFlush(order);
        } catch (DataIntegrityViolationException sameKeyAtTheSameMoment) {
            throw new ConflictException("ORDER_IN_PROGRESS", "This order is already being placed. Check My orders in a moment.");
        }
        cartItems.deleteAllForUser(userId);
        events.record(order.getId(), "PLACED", "Order placed", OrderEvents.CUSTOMER);
        log.info("Order {} placed: {} item(s), total {} paise, awaiting payment until {}",
                order.getOrderNumber(), order.getItems().size(), order.getTotalPaise(), order.getExpiresAt());
        return new PlacedOrder(toDetail(order), true);
    }

    @Transactional(readOnly = true)
    public PageResponse<OrderSummaryDto> list(Long userId, int page, int pageSize) {
        Page<CustomerOrder> result = orders.findByUserIdOrderByPlacedAtDescIdDesc(userId, PageRequest.of(page, pageSize));
        return new PageResponse<>(result.getContent().stream().map(this::toSummary).toList(),
                result.getNumber(), result.getSize(), result.getTotalElements(), result.getTotalPages());
    }

    @Transactional(readOnly = true)
    public OrderDetailDto get(Long userId, String orderNumber) {
        return orders.findByOrderNumberAndUserId(orderNumber, userId).map(this::toDetail).orElseThrow(() -> notFound(orderNumber));
    }

    /** Customers can cancel while an order still awaits payment; the held stock goes back on sale. */
    public OrderDetailDto cancel(Long userId, String orderNumber) {
        CustomerOrder order = orders.lockByOrderNumberAndUserId(orderNumber, userId).orElseThrow(() -> notFound(orderNumber));
        if (!order.isAwaitingPayment()) {
            throw new ConflictException("ORDER_NOT_CANCELLABLE", "This order is " + describe(order.getStatus()) + " and can no longer be cancelled.");
        }
        releaseStock(order);
        order.close(OrderStatus.CANCELLED, clock.instant());
        events.record(order.getId(), "CANCELLED", "Cancelled by the customer before payment", OrderEvents.CUSTOMER);
        log.info("Order {} cancelled by customer; stock released", orderNumber);
        return toDetail(order);
    }

    /** Ends unpaid orders whose payment window has passed and puts their stock back on sale. */
    public int expireOverdue() {
        Instant now = clock.instant();
        List<CustomerOrder> overdue = orders.lockOverdue(now, EXPIRY_BATCH);
        for (CustomerOrder order : overdue) {
            releaseStock(order);
            order.close(OrderStatus.EXPIRED, now);
            events.record(order.getId(), "EXPIRED", "Not paid in time, so the reserved pieces went back on sale", OrderEvents.SYSTEM);
        }
        return overdue.size();
    }

    /** Gives held stock back. Used by customer cancels, expiry and store cancels of unpaid orders. */
    public void releaseStock(CustomerOrder order) {
        for (OrderItem item : order.getItems()) {
            if (item.getVariantId() != null && inventory.release(item.getVariantId(), item.getQuantity()) == 0) {
                log.warn("Order {}: could not release {} x {} (reservation already gone)", order.getOrderNumber(), item.getQuantity(), item.getSku());
            }
        }
    }

    // ---- mapping ----

    private OrderSummaryDto toSummary(CustomerOrder o) {
        List<String> images = o.getItems().stream().map(OrderItem::getImageUrl).filter(u -> u != null).limit(3).toList();
        int count = o.getItems().stream().mapToInt(OrderItem::getQuantity).sum();
        return new OrderSummaryDto(o.getOrderNumber(), o.getStatus().apiValue(), o.getPlacedAt(), o.getExpiresAt(),
                count, Money.inr(o.getTotalPaise()), images);
    }

    /** True while the order awaits payment, online payment is set up, and there's still time to pay. */
    public boolean canPay(CustomerOrder o) {
        return o.isAwaitingPayment() && paymentKeys.current().enabled() && o.getExpiresAt() != null
                && Duration.between(clock.instant(), o.getExpiresAt()).compareTo(MIN_TIME_TO_PAY) >= 0;
    }

    public OrderDetailDto toDetail(CustomerOrder o) {
        List<OrderItemDto> items = o.getItems().stream()
                .map(i -> new OrderItemDto(i.getSku(), i.getProductSlug(), i.getProductName(), i.getColorName(), i.getSize(),
                        i.getImageUrl(), Money.inr(i.getUnitPricePaise()), i.getQuantity(), Money.inr(i.getLineTotalPaise())))
                .toList();
        ShippingAddress a = o.getShippingAddress();
        boolean refunded = payments.findByOrderId(o.getId()).stream().anyMatch(p -> p.getStatus() == Payment.Status.REFUNDED);
        return new OrderDetailDto(o.getOrderNumber(), o.getStatus().apiValue(), o.getPlacedAt(), o.getExpiresAt(), o.getClosedAt(),
                o.getPaidAt(),
                items, Money.inr(o.getSubtotalPaise()), Money.inr(o.getShippingPaise()), Money.inr(o.getTotalPaise()),
                new AddressDto(a.getFullName(), a.getPhone(), a.getLine1(), a.getLine2(), a.getCity(), a.getState(), a.getPincode()),
                o.isAwaitingPayment(), canPay(o), refunded,
                o.getShippedAt() == null ? null
                        : new Shipment(o.getCourier(), o.getTrackingNumber(), o.getTrackingUrl(), o.getShippedAt(), o.getDeliveredAt()),
                o.getCancelReason(),
                events.forOrder(o.getId()).stream().map(e -> new TimelineEntry(e.type(), e.message(), e.at())).toList());
    }

    private static ShippingAddress toAddress(AddressRequest a) {
        return new ShippingAddress(a.fullName(), a.phone(), a.line1(), a.line2(), a.city(), a.state(), a.pincode());
    }

    private static ConflictException needsAttention(List<FieldProblem> problems) {
        return new ConflictException("CART_NEEDS_ATTENTION", "Some items in your bag changed. Please review your bag and try again.", problems);
    }

    private static String describe(com.code76.store.orders.dto.OrderDtos.LineIssue issue, int available) {
        return switch (issue) {
            case UNAVAILABLE -> "This piece is no longer available.";
            case SOLD_OUT -> "This size has sold out.";
            case NOT_ENOUGH_STOCK -> "Only " + available + " left in this size.";
        };
    }

    private static String describe(OrderStatus status) {
        return status.apiValue().replace('_', ' ');
    }

    private static ResourceNotFoundException notFound(String orderNumber) {
        return new ResourceNotFoundException("No order found for '" + orderNumber + "'.");
    }
}
