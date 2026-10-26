package com.code76.store.accounts.dto;

import com.code76.store.accounts.domain.UserAccount;
import com.code76.store.catalogue.dto.CatalogueDtos.ProductSummaryDto;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;
import java.util.Locale;

/** Request and response bodies for the account endpoints. Password hashes never appear here. */
public final class AccountDtos {

    private AccountDtos() {
    }

    static final String EMAIL_PATTERN = "^[^\\s@]+@[^\\s@]+\\.[^\\s@]{2,}$";
    static final String SLUG_PATTERN = "^[a-z0-9]+(-[a-z0-9]+)*$";

    public record RegisterRequest(
            @NotBlank(message = "is required") @Size(max = 80, message = "must be at most 80 characters") String name,
            @NotBlank(message = "is required") @Size(max = 254, message = "must be at most 254 characters")
            @Email(message = "must be a valid email address") @Pattern(regexp = EMAIL_PATTERN, message = "must be a valid email address")
            String email,
            // bcrypt only uses the first 72 bytes of a password, so longer ones are rejected rather than silently cut.
            @NotNull(message = "is required") @Size(min = 8, max = 72, message = "must be 8 to 72 characters") String password) {

        /** Stray spaces around a name or email are a typo, not an error. Passwords are kept exactly as typed. */
        public RegisterRequest {
            name = trim(name);
            email = trim(email);
        }
    }

    public record LoginRequest(
            @NotBlank(message = "is required") @Size(max = 254, message = "must be at most 254 characters") String email,
            @NotBlank(message = "is required") @Size(max = 72, message = "must be at most 72 characters") String password) {

        public LoginRequest {
            email = trim(email);
        }
    }

    private static String trim(String value) {
        return value == null ? null : value.trim();
    }

    /** The signed-in customer, as the frontend sees them. */
    public record UserDto(String name, String email, String role, Instant memberSince) {
        public static UserDto from(UserAccount user) {
            return new UserDto(user.getFullName(), user.getEmail(), user.getRole().name().toLowerCase(Locale.ROOT), user.getCreatedAt());
        }
    }

    /** Answer to "who am I?". Signed-out visitors get {@code authenticated: false}, not an error. */
    public record SessionResponse(boolean authenticated, UserDto user) {
        public static SessionResponse anonymous() {
            return new SessionResponse(false, null);
        }

        public static SessionResponse of(UserDto user) {
            return new SessionResponse(true, user);
        }
    }

    /** Anti-forgery token the frontend must echo back in {@code headerName} on every POST/PUT/DELETE. */
    public record CsrfResponse(String headerName, String token) {
    }

    public record WishlistResponse(List<ProductSummaryDto> items) {
    }

    public record WishlistMergeRequest(
            @NotNull(message = "is required") @Size(max = 100, message = "must list at most 100 products")
            List<@NotNull @Pattern(regexp = SLUG_PATTERN, message = "must be a valid slug") String> slugs) {
    }
}
