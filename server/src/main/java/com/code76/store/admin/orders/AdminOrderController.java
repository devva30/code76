package com.code76.store.admin.orders;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.admin.orders.AdminOrderService.AdminOrderDetail;
import com.code76.store.admin.orders.AdminOrderService.OrderRow;
import com.code76.store.catalogue.dto.CatalogueDtos.PageResponse;
import com.code76.store.orders.service.OrderNumberGenerator;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Orders for the store team (admins only). */
@RestController
@Validated
@RequestMapping("/api/admin/orders")
public class AdminOrderController {

    public record ShipRequest(
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String courier,
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String trackingNumber,
            @Size(max = 500) @Pattern(regexp = "^$|^https://\\S+$", message = "must be a full https:// link") String trackingUrl) {
    }

    public record CancelRequest(@NotBlank(message = "is required") @Size(max = 300, message = "must be at most 300 characters") String reason) {
    }

    private static final String NUMBER = OrderNumberGenerator.PATTERN;

    private final AdminOrderService orders;

    public AdminOrderController(AdminOrderService orders) {
        this.orders = orders;
    }

    @GetMapping
    public PageResponse<OrderRow> list(@RequestParam(defaultValue = "") @Pattern(regexp = "^(|pending_payment|confirmed|shipped|delivered|cancelled|expired)$") String status,
                                       @RequestParam(defaultValue = "") @Size(max = 100) String q,
                                       @RequestParam(defaultValue = "0") @Min(0) int page,
                                       @RequestParam(defaultValue = "25") @Min(1) @Max(100) int pageSize) {
        return orders.list(status, q, page, pageSize);
    }

    @GetMapping("/{orderNumber}")
    public AdminOrderDetail detail(@PathVariable @Pattern(regexp = NUMBER) String orderNumber) {
        return orders.detail(orderNumber);
    }

    @PostMapping("/{orderNumber}/ship")
    public AdminOrderDetail ship(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable @Pattern(regexp = NUMBER) String orderNumber,
                                 @Valid @RequestBody ShipRequest body) {
        return orders.ship(orderNumber, body.courier(), body.trackingNumber(), body.trackingUrl(), admin);
    }

    @PostMapping("/{orderNumber}/deliver")
    public AdminOrderDetail deliver(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable @Pattern(regexp = NUMBER) String orderNumber) {
        return orders.deliver(orderNumber, admin);
    }

    @PostMapping("/{orderNumber}/cancel")
    public AdminOrderDetail cancel(@AuthenticationPrincipal AccountPrincipal admin, @PathVariable @Pattern(regexp = NUMBER) String orderNumber,
                                   @Valid @RequestBody CancelRequest body) {
        return orders.cancel(orderNumber, body.reason(), admin);
    }
}
