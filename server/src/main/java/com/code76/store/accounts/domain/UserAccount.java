package com.code76.store.accounts.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

/**
 * A customer account. The password itself is never stored, only its one-way hash,
 * and the hash never leaves the server (it is not part of any DTO).
 */
@Entity
@Table(name = "users")
public class UserAccount {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Always trimmed and lower-cased (see AccountService.normaliseEmail). */
    @Column(nullable = false, unique = true, length = 254)
    private String email;

    @Column(name = "full_name", nullable = false, length = 80)
    private String fullName;

    @Column(name = "password_hash", nullable = false)
    private String passwordHash;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private Role role = Role.CUSTOMER;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(name = "last_login_at")
    private Instant lastLoginAt;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected UserAccount() {
    }

    public UserAccount(String email, String fullName, String passwordHash) {
        this.email = email;
        this.fullName = fullName;
        this.passwordHash = passwordHash;
    }

    public void recordLogin(Instant at) {
        this.lastLoginAt = at;
    }

    public Long getId() { return id; }
    public String getEmail() { return email; }
    public String getFullName() { return fullName; }
    public String getPasswordHash() { return passwordHash; }
    public Role getRole() { return role; }
    public boolean isEnabled() { return enabled; }
    public Instant getLastLoginAt() { return lastLoginAt; }
    public Instant getCreatedAt() { return createdAt; }

    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public void setRole(Role role) { this.role = role; }
}
