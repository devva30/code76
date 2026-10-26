package com.code76.store.media;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/** An uploaded image. The bytes are only loaded when serving the file (see MediaRepository projections). */
@Entity
@Table(name = "media_assets")
public class MediaAsset {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "public_key", nullable = false, unique = true, length = 32)
    private String publicKey;

    @Column(name = "file_name", nullable = false, length = 160)
    private String fileName;

    @Column(name = "content_type", nullable = false, length = 40)
    private String contentType;

    @Column(nullable = false, length = 5)
    private String extension;

    @Column(nullable = false)
    private byte[] bytes;

    @Column(name = "size_bytes", nullable = false)
    private int sizeBytes;

    @Column(nullable = false)
    private int width;

    @Column(nullable = false)
    private int height;

    @Column(nullable = false, unique = true, length = 64)
    private String sha256;

    @Column(name = "alt_text", nullable = false, length = 300)
    private String altText = "";

    @Column(name = "uploaded_by")
    private Long uploadedBy;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected MediaAsset() {
    }

    public MediaAsset(String publicKey, String fileName, ImageInspector.ImageInfo info, byte[] bytes, String sha256,
                      String altText, Long uploadedBy) {
        this.publicKey = publicKey;
        this.fileName = fileName;
        this.contentType = info.contentType();
        this.extension = info.extension();
        this.width = info.width();
        this.height = info.height();
        this.bytes = bytes;
        this.sizeBytes = bytes.length;
        this.sha256 = sha256;
        this.altText = altText == null ? "" : altText;
        this.uploadedBy = uploadedBy;
    }

    /** Where the image is served from, e.g. /media/Xy3…Q.webp */
    public String url() {
        return "/media/" + publicKey + "." + extension;
    }

    public Long getId() { return id; }
    public String getPublicKey() { return publicKey; }
    public String getFileName() { return fileName; }
    public String getContentType() { return contentType; }
    public String getExtension() { return extension; }
    public int getSizeBytes() { return sizeBytes; }
    public int getWidth() { return width; }
    public int getHeight() { return height; }
    public String getSha256() { return sha256; }
    public String getAltText() { return altText; }
    public Instant getCreatedAt() { return createdAt; }

    public void setAltText(String altText) { this.altText = altText == null ? "" : altText; }
}
