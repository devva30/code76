package com.code76.store.admin;

import com.code76.store.accounts.domain.Role;
import com.code76.store.accounts.repository.UserAccountRepository;
import com.code76.store.accounts.security.AccountPrincipal;
import org.springframework.security.authorization.AuthorizationDecision;
import org.springframework.security.authorization.AuthorizationManager;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.access.intercept.RequestAuthorizationContext;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.function.Supplier;

/**
 * Guards /api/admin/**. The role is re-read from the database on every request rather than trusted
 * from the session, so removing someone from ADMIN_EMAILS (or disabling them) takes effect immediately.
 */
@Component
public class AdminAccess implements AuthorizationManager<RequestAuthorizationContext> {

    private final UserAccountRepository users;

    public AdminAccess(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public AuthorizationDecision authorize(Supplier<? extends Authentication> authentication, RequestAuthorizationContext context) {
        Authentication auth = authentication.get();
        if (auth == null || !(auth.getPrincipal() instanceof AccountPrincipal principal)) {
            return new AuthorizationDecision(false);
        }
        boolean admin = users.findById(principal.getId())
                .filter(u -> u.isEnabled() && u.getRole() == Role.ADMIN)
                .isPresent();
        return new AuthorizationDecision(admin);
    }
}
