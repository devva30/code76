package com.code76.store.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.session.web.http.CookieSerializer;
import org.springframework.session.web.http.DefaultCookieSerializer;

/**
 * The session cookie (the signed-in "wristband"), defined in one place so it is identical
 * in tests, locally and in production.
 */
@Configuration(proxyBeanMethods = false)
public class SessionCookieConfig {

    public static final String COOKIE_NAME = "C76_SESSION";

    @Bean
    CookieSerializer sessionCookieSerializer(@Value("${app.session.cookie-secure:false}") boolean secure) {
        DefaultCookieSerializer cookie = new DefaultCookieSerializer();
        cookie.setCookieName(COOKIE_NAME);
        cookie.setCookiePath("/");
        cookie.setUseHttpOnlyCookie(true);   // JavaScript can never read it, so injected scripts can't steal it
        cookie.setSameSite("Lax");           // not sent with cross-site form posts or embeds
        cookie.setUseSecureCookie(secure);   // HTTPS-only; true in the prod profile
        return cookie;
    }
}
