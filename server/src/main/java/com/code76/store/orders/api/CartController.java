package com.code76.store.orders.api;

import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.orders.dto.OrderDtos.AddCartItemRequest;
import com.code76.store.orders.dto.OrderDtos.CartDto;
import com.code76.store.orders.dto.OrderDtos.MergeCartRequest;
import com.code76.store.orders.dto.OrderDtos.UpdateCartItemRequest;
import com.code76.store.orders.service.CartService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Pattern;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** The signed-in customer's bag. Requires a session (everything under /api/me does). */
@RestController
@Validated
@RequestMapping("/api/me/cart")
public class CartController {

    private static final String SKU = "^[A-Z0-9][A-Z0-9-]{2,63}$";

    private final CartService carts;

    public CartController(CartService carts) {
        this.carts = carts;
    }

    @GetMapping
    public CartDto get(@AuthenticationPrincipal AccountPrincipal me) {
        return carts.get(me.getId());
    }

    @PostMapping("/items")
    public CartDto add(@AuthenticationPrincipal AccountPrincipal me, @Valid @RequestBody AddCartItemRequest body) {
        return carts.add(me.getId(), body);
    }

    @PutMapping("/items/{sku}")
    public CartDto setQuantity(@AuthenticationPrincipal AccountPrincipal me,
                               @PathVariable @Pattern(regexp = SKU, message = "must be a valid SKU") String sku,
                               @Valid @RequestBody UpdateCartItemRequest body) {
        return carts.setQuantity(me.getId(), sku, body.quantity());
    }

    @DeleteMapping("/items/{sku}")
    public CartDto remove(@AuthenticationPrincipal AccountPrincipal me,
                          @PathVariable @Pattern(regexp = SKU, message = "must be a valid SKU") String sku) {
        return carts.remove(me.getId(), sku);
    }

    @DeleteMapping
    public CartDto clear(@AuthenticationPrincipal AccountPrincipal me) {
        return carts.clear(me.getId());
    }

    @PostMapping("/merge")
    public CartDto merge(@AuthenticationPrincipal AccountPrincipal me, @Valid @RequestBody MergeCartRequest body) {
        return carts.merge(me.getId(), body.items());
    }
}
