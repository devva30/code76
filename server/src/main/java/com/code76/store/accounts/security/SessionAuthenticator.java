package com.code76.store.accounts.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.context.SecurityContextHolderStrategy;
import org.springframework.security.web.authentication.logout.CompositeLogoutHandler;
import org.springframework.security.web.authentication.logout.LogoutHandler;
import org.springframework.security.web.authentication.logout.SecurityContextLogoutHandler;
import org.springframework.security.web.authentication.session.ChangeSessionIdAuthenticationStrategy;
import org.springframework.security.web.authentication.session.CompositeSessionAuthenticationStrategy;
import org.springframework.security.web.authentication.session.SessionAuthenticationStrategy;
import org.springframework.security.web.context.SecurityContextRepository;
import org.springframework.security.web.csrf.CsrfAuthenticationStrategy;
import org.springframework.security.web.csrf.CsrfLogoutHandler;
import org.springframework.security.web.csrf.CsrfTokenRepository;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Starts and ends a signed-in session: the "wristband" handed to the browser as an HttpOnly cookie.
 */
@Component
public class SessionAuthenticator {

    private final SecurityContextHolderStrategy holder = SecurityContextHolder.getContextHolderStrategy();
    private final SecurityContextRepository contextRepository;
    private final SessionAuthenticationStrategy onSignIn;
    private final LogoutHandler onSignOut;

    public SessionAuthenticator(SecurityContextRepository contextRepository, CsrfTokenRepository csrfTokens) {
        this.contextRepository = contextRepository;
        // New session id on sign-in (blocks "session fixation") and a fresh anti-forgery token.
        this.onSignIn = new CompositeSessionAuthenticationStrategy(List.of(
                new ChangeSessionIdAuthenticationStrategy(),
                new CsrfAuthenticationStrategy(csrfTokens)));
        // Forget the token, wipe the session, clear who is signed in.
        this.onSignOut = new CompositeLogoutHandler(new CsrfLogoutHandler(csrfTokens), new SecurityContextLogoutHandler());
    }

    public void signIn(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        onSignIn.onAuthentication(authentication, request, response);
        SecurityContext context = holder.createEmptyContext();
        context.setAuthentication(authentication);
        holder.setContext(context);
        contextRepository.saveContext(context, request, response);
    }

    public void signOut(Authentication authentication, HttpServletRequest request, HttpServletResponse response) {
        onSignOut.logout(request, response, authentication);
    }
}
