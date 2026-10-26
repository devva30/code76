package com.code76.store.orders.api;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.orders.dto.OrderDtos.CheckoutRequest;
import com.code76.store.orders.dto.OrderDtos.OrderDetailDto;
import com.code76.store.orders.dto.OrderDtos.OrderSummaryDto;
import com.code76.store.orders.service.OrderNumberGenerator;
import com.code76.store.orders.service.OrderService;
import com.code76.store.orders.service.OrderService.PlacedOrder;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Checkout and the signed-in customer's order history. Customers can only ever reach their own orders. */
@RestController
@Validated
@RequestMapping("/api/me/orders")
public class OrderController {

    private final OrderService orders;

    public OrderController(OrderService orders) {
        this.orders = orders;
    }

    /** Places an order from the bag: 201 when new, 200 when this idempotency key already placed it. */
    @PostMapping
    public ResponseEntity<OrderDetailDto> place(@AuthenticationPrincipal AccountPrincipal me, @Valid @RequestBody CheckoutRequest body) {
        PlacedOrder placed = orders.placeOrder(me.getId(), body);
        return ResponseEntity.status(placed.created() ? HttpStatus.CREATED : HttpStatus.OK).body(placed.order());
    }

    @GetMapping
    public PageResponse<OrderSummaryDto> list(@AuthenticationPrincipal AccountPrincipal me,
                                              @RequestParam(defaultValue = "0") @Min(value = 0, message = "must be zero or more") int page,
                                              @RequestParam(defaultValue = "10") @Min(value = 1, message = "must be at least 1")
                                              @Max(value = 50, message = "must be at most 50") int pageSize) {
        return orders.list(me.getId(), page, pageSize);
    }

    @GetMapping("/{orderNumber}")
    public OrderDetailDto get(@AuthenticationPrincipal AccountPrincipal me,
                              @PathVariable @Pattern(regexp = OrderNumberGenerator.PATTERN, message = "must be a valid order number") String orderNumber) {
        return orders.get(me.getId(), orderNumber);
    }

    @PostMapping("/{orderNumber}/cancel")
    public OrderDetailDto cancel(@AuthenticationPrincipal AccountPrincipal me,
                                 @PathVariable @Pattern(regexp = OrderNumberGenerator.PATTERN, message = "must be a valid order number") String orderNumber) {
        return orders.cancel(me.getId(), orderNumber);
    }
}
