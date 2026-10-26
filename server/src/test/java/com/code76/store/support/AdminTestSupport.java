package com.code76.store.support;

import org.springframework.test.web.servlet.MockMvc;

import javax.imageio.ImageIO;
import java.awt.Color;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.Random;

/** Signing in as the test admin (listed in application-test.yml) and making test images. */
public final class AdminTestSupport {

    public static final String ADMIN_EMAIL = "admin@code76.test";
    public static final String ADMIN_PASSWORD = "admin test passphrase";
    private static final Random RANDOM = new Random();

    private AdminTestSupport() {
    }

    /** The admin account is shared by all tests: create it the first time, sign in afterwards. */
    public static TestBrowser signedInAdmin(MockMvc mvc) throws Exception {
        TestBrowser browser = new TestBrowser(mvc);
        int status = browser.register("Store Admin", ADMIN_EMAIL, ADMIN_PASSWORD).andReturn().getResponse().getStatus();
        if (status == 409) {
            browser.login(ADMIN_EMAIL, ADMIN_PASSWORD).andReturn();
        }
        return browser;
    }

    /** A real PNG or JPEG with random colours, so every call is a different file. */
    public static byte[] image(String format, int width, int height) throws IOException {
        BufferedImage img = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(RANDOM.nextInt(0xFFFFFF)));
        g.fillRect(0, 0, width, height);
        g.setColor(new Color(RANDOM.nextInt(0xFFFFFF)));
        g.fillRect(0, 0, width / 2, height / 2);
        g.dispose();
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        ImageIO.write(img, format, out);
        return out.toByteArray();
    }

    /** The start of an extended (VP8X) WebP file: enough for the server to read its size. */
    public static byte[] webpHeader(int width, int height) {
        ByteBuffer b = ByteBuffer.allocate(64).order(ByteOrder.LITTLE_ENDIAN);
        b.put("RIFF".getBytes()).putInt(56).put("WEBP".getBytes()).put("VP8X".getBytes()).putInt(10);
        b.put((byte) 0).put(new byte[3]);
        int w = width - 1;
        int h = height - 1;
        b.put((byte) w).put((byte) (w >> 8)).put((byte) (w >> 16));
        b.put((byte) h).put((byte) (h >> 8)).put((byte) (h >> 16));
        byte[] tail = new byte[64 - b.position()];
        RANDOM.nextBytes(tail);
        b.put(tail);
        return b.array();
    }

    /** A PNG header that claims a huge width, without the pixels: must be rejected. */
    public static byte[] pngHeader(int width, int height) {
        ByteBuffer b = ByteBuffer.allocate(40);
        b.put(new byte[] {(byte) 0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A}).putInt(13).put("IHDR".getBytes()).putInt(width).putInt(height);
        return b.array();
    }
}
