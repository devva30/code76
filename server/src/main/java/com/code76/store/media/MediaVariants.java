package com.code76.store.media;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageWriteParam;
import javax.imageio.ImageWriter;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Smaller copies of uploaded photos, so a phone or a product card doesn't download a 1600-pixel
 * original. Only a few fixed widths are offered (no arbitrary sizes, so nobody can fill the
 * database), each made once on first request and then served from the database.
 */
@Service
public class MediaVariants {

    /** Small sizes only: above ~1000px the WebP original is already smaller than a JPEG copy. */
    public static final Set<Integer> WIDTHS = Set.of(320, 480, 640, 960);

    private final java.util.concurrent.ExecutorService background = java.util.concurrent.Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "media-variants");
        t.setDaemon(true);
        return t;
    });

    /** Makes every size of a photo in the background, so no visitor waits for the first copy. */
    public void prepareAll(String publicKey) {
        background.submit(() -> WIDTHS.stream().sorted().forEach(w -> get(publicKey, w)));
    }

    /** On startup, makes any missing sizes for photos already in the library. */
    @org.springframework.context.event.EventListener(org.springframework.boot.context.event.ApplicationReadyEvent.class)
    public void prepareExisting() {
        background.submit(() -> {
            List<String> keys = jdbc.queryForList("""
                    select a.public_key from media_assets a
                    where a.width > 320 and (select count(*) from media_variants v where v.asset_id = a.id) < ?""",
                    String.class, WIDTHS.size());
            if (!keys.isEmpty()) {
                log.info("Preparing smaller copies of {} photos", keys.size());
            }
            keys.forEach(k -> WIDTHS.stream().sorted().forEach(w -> get(k, w)));
        });
    }

    public record Variant(byte[] bytes, String contentType) {
    }

    private static final Logger log = LoggerFactory.getLogger(MediaVariants.class);

    private final JdbcTemplate jdbc;

    public MediaVariants(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    /** The photo at the given width, or empty when the original is already that small (serve the original). */
    public Optional<Variant> get(String publicKey, int width) {
        List<long[]> found = jdbc.query("select id, width from media_assets where public_key = ?",
                (rs, n) -> new long[] {rs.getLong(1), rs.getLong(2)}, publicKey);
        if (found.isEmpty() || found.getFirst()[1] <= width) {
            return Optional.empty();
        }
        long id = found.getFirst()[0];
        List<Variant> cached = jdbc.query("select bytes, content_type from media_variants where asset_id = ? and width = ?",
                (rs, n) -> new Variant(rs.getBytes(1), rs.getString(2)), id, width);
        if (!cached.isEmpty()) {
            return Optional.of(cached.getFirst());
        }
        byte[] original = jdbc.queryForObject("select bytes from media_assets where id = ?", byte[].class, id);
        try {
            Variant made = resize(original, width);
            jdbc.update("insert into media_variants (asset_id, width, content_type, bytes) values (?, ?, ?, ?) on conflict do nothing",
                    id, width, made.contentType(), made.bytes());
            return Optional.of(made);
        } catch (IOException | RuntimeException e) {
            log.warn("Couldn't make a {}px copy of media {}: {}", width, publicKey, e.toString());
            return Optional.empty(); // fall back to the original
        }
    }

    static Variant resize(byte[] original, int width) throws IOException {
        BufferedImage src = ImageIO.read(new ByteArrayInputStream(original));
        if (src == null) {
            throw new IOException("unreadable image");
        }
        boolean alpha = src.getColorModel().hasAlpha();
        int height = Math.max(1, Math.round(src.getHeight() * (width / (float) src.getWidth())));
        // Halve in steps first for a smooth result, then do the final bicubic step.
        BufferedImage current = src;
        int w = src.getWidth();
        int h = src.getHeight();
        while (w / 2 >= width) {
            w /= 2;
            h /= 2;
            current = scale(current, w, h, alpha);
        }
        current = scale(current, width, height, alpha);

        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (alpha) {
            ImageIO.write(current, "png", out);
            return new Variant(out.toByteArray(), "image/png");
        }
        ImageWriter writer = ImageIO.getImageWritersByFormatName("jpeg").next();
        ImageWriteParam param = writer.getDefaultWriteParam();
        param.setCompressionMode(ImageWriteParam.MODE_EXPLICIT);
        param.setCompressionQuality(0.84f);
        param.setProgressiveMode(ImageWriteParam.MODE_DEFAULT);
        try (ImageOutputStream ios = ImageIO.createImageOutputStream(out)) {
            writer.setOutput(ios);
            writer.write(null, new IIOImage(current, null, null), param);
        } finally {
            writer.dispose();
        }
        return new Variant(out.toByteArray(), "image/jpeg");
    }

    private static BufferedImage scale(BufferedImage in, int w, int h, boolean alpha) {
        BufferedImage out = new BufferedImage(w, h, alpha ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = out.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.drawImage(in, 0, 0, w, h, null);
        } finally {
            g.dispose();
        }
        return out;
    }
}
