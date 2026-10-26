package com.code76.store.accounts.security;

import com.code76.store.accounts.domain.Role;
import com.code76.store.accounts.domain.UserAccount;
import org.springframework.security.core.CredentialsContainer;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.io.Serial;
import java.util.Collection;
import java.util.List;

/**
 * Who is signed in, as stored in the session. Holds only what security decisions need;
 * the password hash is wiped straight after the password check (eraseCredentials).
 */
public final class AccountPrincipal implements UserDetails, CredentialsContainer {

    @Serial
    private static final long serialVersionUID = 1L;

    private final Long id;
    private final String email;
    private final Role role;
    private final boolean enabled;
    private String passwordHash;

    private AccountPrincipal(Long id, String email, Role role, boolean enabled, String passwordHash) {
        this.id = id;
        this.email = email;
        this.role = role;
        this.enabled = enabled;
        this.passwordHash = passwordHash;
    }

    /** For checking a password: includes the hash. */
    public static AccountPrincipal forAuthentication(UserAccount user) {
        return new AccountPrincipal(user.getId(), user.getEmail(), user.getRole(), user.isEnabled(), user.getPasswordHash());
    }

    /** For an already-verified user (e.g. straight after sign-up): no hash at all. */
    public static AccountPrincipal verified(UserAccount user) {
        return new AccountPrincipal(user.getId(), user.getEmail(), user.getRole(), user.isEnabled(), null);
    }

    public Long getId() {
        return id;
    }

    public Role getRole() {
        return role;
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return List.of(new SimpleGrantedAuthority("ROLE_" + role.name()));
    }

    @Override
    public String getPassword() {
        return passwordHash;
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isEnabled() {
        return enabled;
    }

    @Override
    public void eraseCredentials() {
        passwordHash = null;
    }
}
