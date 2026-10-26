package com.code76.store.accounts.api;

import com.code76.store.accounts.domain.UserAccount;
import com.code76.store.accounts.dto.AccountDtos.CsrfResponse;
import com.code76.store.accounts.dto.AccountDtos.LoginRequest;
import com.code76.store.accounts.dto.AccountDtos.RegisterRequest;
import com.code76.store.accounts.dto.AccountDtos.SessionResponse;
import com.code76.store.accounts.dto.AccountDtos.UserDto;
import com.code76.store.accounts.security.AccountPrincipal;
import com.code76.store.accounts.security.LoginAttemptService;
import com.code76.store.accounts.security.SessionAuthenticator;
import com.code76.store.accounts.service.AccountService;
import com.code76.store.common.error.InvalidCredentialsException;
import com.code76.store.common.error.TooManyAttemptsException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Sign-up, sign-in, sign-out and "who am I?". All POSTs need the CSRF token from GET /api/auth/csrf. */
@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AccountService accounts;
    private final AuthenticationManager authenticationManager;
    private final LoginAttemptService loginAttempts;
    private final SessionAuthenticator sessions;

    public AuthController(AccountService accounts, AuthenticationManager authenticationManager,
                          LoginAttemptService loginAttempts, SessionAuthenticator sessions) {
        this.accounts = accounts;
        this.authenticationManager = authenticationManager;
        this.loginAttempts = loginAttempts;
        this.sessions = sessions;
    }

    @GetMapping("/csrf")
    public CsrfResponse csrf(CsrfToken token) {
        return new CsrfResponse(token.getHeaderName(), token.getToken());
    }

    @GetMapping("/session")
    public SessionResponse session(@AuthenticationPrincipal AccountPrincipal principal) {
        if (principal == null) {
            return SessionResponse.anonymous();
        }
        return accounts.findActiveUser(principal.getId()).map(SessionResponse::of).orElseGet(SessionResponse::anonymous);
    }

    /** Creates the account and signs the new customer straight in. */
    @PostMapping("/register")
    public ResponseEntity<UserDto> register(@Valid @RequestBody RegisterRequest body,
                                            HttpServletRequest request, HttpServletResponse response) {
        UserAccount user = accounts.register(body);
        AccountPrincipal principal = AccountPrincipal.verified(user);
        sessions.signIn(UsernamePasswordAuthenticationToken.authenticated(principal, null, principal.getAuthorities()), request, response);
        accounts.recordLogin(user.getId());
        return ResponseEntity.status(HttpStatus.CREATED).body(UserDto.from(user));
    }

    @PostMapping("/login")
    public UserDto login(@Valid @RequestBody LoginRequest body, HttpServletRequest request, HttpServletResponse response) {
        String email = AccountService.normaliseEmail(body.email());
        String attemptKey = LoginAttemptService.key(email, request.getRemoteAddr());
        loginAttempts.lockedFor(attemptKey).ifPresent(wait -> {
            throw new TooManyAttemptsException(Math.max(1, wait.toSeconds()));
        });

        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(email, body.password()));
        } catch (AuthenticationException wrongPasswordUnknownEmailOrDisabled) {
            loginAttempts.recordFailure(attemptKey);
            throw new InvalidCredentialsException();
        }

        loginAttempts.reset(attemptKey);
        sessions.signIn(authentication, request, response);
        AccountPrincipal principal = (AccountPrincipal) authentication.getPrincipal();
        accounts.recordLogin(principal.getId());
        return accounts.findActiveUser(principal.getId()).orElseThrow(InvalidCredentialsException::new);
    }

    /** Safe to call when already signed out. */
    @PostMapping("/logout")
    public ResponseEntity<Void> logout(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        sessions.signOut(authentication, request, response);
        return ResponseEntity.noContent().build();
    }
}
