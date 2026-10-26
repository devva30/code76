package com.code76.store.payments;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.security.GeneralSecurityException;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * Encrypts secrets kept in the database (AES-256-GCM). The key comes from SETTINGS_ENCRYPTION_KEY
 * (32 random bytes, base64) in the server's environment, so a copy of the database alone reveals nothing.
 */
@Component
public class SecretBox {

    private static final int IV_BYTES = 12;
    private static final int TAG_BITS = 128;

    private final SecretKeySpec key;
    private final SecureRandom random = new SecureRandom();

    public SecretBox(@Value("${app.settings.encryption-key:}") String base64Key) {
        this.key = parse(base64Key);
    }

    /** False until SETTINGS_ENCRYPTION_KEY is set; secrets can't be saved without it. */
    public boolean ready() {
        return key != null;
    }

    public String encrypt(String plain) {
        requireReady();
        try {
            byte[] iv = new byte[IV_BYTES];
            random.nextBytes(iv);
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, iv));
            byte[] sealed = c.doFinal(plain.getBytes(StandardCharsets.UTF_8));
            return "v1:" + Base64.getEncoder().encodeToString(ByteBuffer.allocate(iv.length + sealed.length).put(iv).put(sealed).array());
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException("Couldn't encrypt a secret", e);
        }
    }

    public String decrypt(String stored) {
        requireReady();
        if (stored == null || !stored.startsWith("v1:")) {
            throw new IllegalStateException("Unrecognised encrypted value");
        }
        try {
            byte[] all = Base64.getDecoder().decode(stored.substring(3));
            Cipher c = Cipher.getInstance("AES/GCM/NoPadding");
            c.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(TAG_BITS, all, 0, IV_BYTES));
            return new String(c.doFinal(all, IV_BYTES, all.length - IV_BYTES), StandardCharsets.UTF_8);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            // Wrong SETTINGS_ENCRYPTION_KEY, or the value was tampered with.
            throw new IllegalStateException("Couldn't decrypt a saved secret (has SETTINGS_ENCRYPTION_KEY changed?)", e);
        }
    }

    private void requireReady() {
        if (key == null) {
            throw new IllegalStateException("SETTINGS_ENCRYPTION_KEY is not set");
        }
    }

    private static SecretKeySpec parse(String base64Key) {
        if (base64Key == null || base64Key.isBlank()) {
            return null;
        }
        byte[] raw;
        try {
            raw = Base64.getDecoder().decode(base64Key.trim());
        } catch (IllegalArgumentException e) {
            throw new IllegalStateException("SETTINGS_ENCRYPTION_KEY must be base64 (32 random bytes).");
        }
        if (raw.length != 32) {
            throw new IllegalStateException("SETTINGS_ENCRYPTION_KEY must be 32 bytes (base64 of 32 random bytes).");
        }
        return new SecretKeySpec(raw, "AES");
    }
}
