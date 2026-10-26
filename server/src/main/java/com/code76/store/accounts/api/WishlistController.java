package com.code76.store.accounts.api;

import com.code76.store.accounts.dto.AccountDtos.WishlistMergeRequest;
import com.code76.store.accounts.dto.AccountDtos.WishlistResponse;
import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.accounts.service.WishlistService;
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

/** The signed-in customer's wishlist. Everything under /api/me requires a session (see SecurityConfig). */
@RestController
@Validated
@RequestMapping("/api/me/wishlist")
public class WishlistController {

    private static final String SLUG = "^[a-z0-9]+(-[a-z0-9]+)*$";

    private final WishlistService wishlist;

    public WishlistController(WishlistService wishlist) {
        this.wishlist = wishlist;
    }

    @GetMapping
    public WishlistResponse list(@AuthenticationPrincipal AccountPrincipal me) {
        return wishlist.list(me.getId());
    }

    @PutMapping("/{slug}")
    public WishlistResponse add(@AuthenticationPrincipal AccountPrincipal me,
                                @PathVariable @Pattern(regexp = SLUG, message = "must be a valid slug") String slug) {
        return wishlist.add(me.getId(), slug);
    }

    @DeleteMapping("/{slug}")
    public WishlistResponse remove(@AuthenticationPrincipal AccountPrincipal me,
                                   @PathVariable @Pattern(regexp = SLUG, message = "must be a valid slug") String slug) {
        return wishlist.remove(me.getId(), slug);
    }

    @PostMapping("/merge")
    public WishlistResponse merge(@AuthenticationPrincipal AccountPrincipal me, @Valid @RequestBody WishlistMergeRequest body) {
        return wishlist.merge(me.getId(), body.slugs());
    }
}
