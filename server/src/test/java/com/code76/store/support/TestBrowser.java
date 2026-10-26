package com.code76.store.support;

import com.code76.store.config.SessionCookieConfig;
import com.jayway.jsonpath.JsonPath;
import jakarta.servlet.http.Cookie;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.AbstractMockHttpServletRequestBuilder;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/**
 * Behaves like the real frontend in a browser: remembers the session cookie between requests,
 * and fetches a fresh CSRF token for every POST/PUT/DELETE, sending it in the X-XSRF-TOKEN header.
 */
public final class TestBrowser {

    public static final String SESSION_COOKIE = SessionCookieConfig.COOKIE_NAME;
    private static final String CSRF_HEADER = "X-XSRF-TOKEN";

    private final MockMvc mvc;
    private Cookie session;

    public TestBrowser(MockMvc mvc) {
        this.mvc = mvc;
    }

    public ResultActions get(String url) throws Exception {
        return send(MockMvcRequestBuilders.get(url));
    }

    public ResultActions postJson(String url, String json) throws Exception {
        return send(MockMvcRequestBuilders.post(url).contentType(MediaType.APPLICATION_JSON).content(json).header(CSRF_HEADER, csrfToken()));
    }

    public ResultActions putJson(String url, String json) throws Exception {
        return send(MockMvcRequestBuilders.put(url).contentType(MediaType.APPLICATION_JSON).content(json).header(CSRF_HEADER, csrfToken()));
    }

    public ResultActions patchJson(String url, String json) throws Exception {
        return send(MockMvcRequestBuilders.patch(url).contentType(MediaType.APPLICATION_JSON).content(json).header(CSRF_HEADER, csrfToken()));
    }

    /** A file upload, as the admin media library sends it. */
    public ResultActions upload(String url, String fileName, String contentType, byte[] bytes, String altText) throws Exception {
        return send(MockMvcRequestBuilders.multipart(url)
                .file(new org.springframework.mock.web.MockMultipartFile("file", fileName, contentType, bytes))
                .param("altText", altText)
                .header(CSRF_HEADER, csrfToken()));
    }

    public ResultActions put(String url) throws Exception {
        return send(MockMvcRequestBuilders.put(url).header(CSRF_HEADER, csrfToken()));
    }

    public ResultActions delete(String url) throws Exception {
        return send(MockMvcRequestBuilders.delete(url).header(CSRF_HEADER, csrfToken()));
    }

    public ResultActions register(String name, String email, String password) throws Exception {
        return postJson("/api/auth/register", """
                {"name": "%s", "email": "%s", "password": "%s"}""".formatted(name, email, password));
    }

    public ResultActions login(String email, String password) throws Exception {
        return postJson("/api/auth/login", """
                {"email": "%s", "password": "%s"}""".formatted(email, password));
    }

    public ResultActions logout() throws Exception {
        return postJson("/api/auth/logout", "{}");
    }

    public String csrfToken() throws Exception {
        String body = get("/api/auth/csrf").andReturn().getResponse().getContentAsString();
        return JsonPath.read(body, "$.token");
    }

    /** The current session cookie, e.g. to check it changes on sign-in or to replay it after sign-out. */
    public Cookie sessionCookie() {
        return session;
    }

    public ResultActions send(AbstractMockHttpServletRequestBuilder<?> request) throws Exception {
        if (session != null) {
            request.cookie(session);
        }
        ResultActions result = mvc.perform(request);
        remember(result.andReturn().getResponse());
        return result;
    }

    private void remember(MockHttpServletResponse response) {
        Cookie updated = response.getCookie(SESSION_COOKIE);
        if (updated != null) {
            session = updated.getMaxAge() == 0 || updated.getValue().isEmpty() ? null : updated;
        }
    }
}
