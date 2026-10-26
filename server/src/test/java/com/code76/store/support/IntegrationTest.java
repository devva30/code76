package com.code76.store.support;

import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Full application against a real PostgreSQL container, with Flyway migrations
 * and the demo catalogue loaded, and a fake Razorpay. All such tests share one cached context.
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
@SpringBootTest
@AutoConfigureMockMvc
@Import({TestcontainersConfiguration.class, FakeRazorpayConfiguration.class})
@ActiveProfiles({"test", "demo-data"})
public @interface IntegrationTest {
}
