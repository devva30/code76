package com.code76.store.accounts.security;

import com.code76.store.accounts.repository.UserAccountRepository;
import com.code76.store.accounts.service.AccountService;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Lets Spring Security look an account up by email when checking a password. */
@Service
public class AccountUserDetailsService implements UserDetailsService {

    private final UserAccountRepository users;

    public AccountUserDetailsService(UserAccountRepository users) {
        this.users = users;
    }

    @Override
    @Transactional(readOnly = true)
    public UserDetails loadUserByUsername(String email) {
        return users.findByEmail(AccountService.normaliseEmail(email))
                .map(AccountPrincipal::forAuthentication)
                .orElseThrow(() -> new UsernameNotFoundException("No account for that email"));
    }
}
