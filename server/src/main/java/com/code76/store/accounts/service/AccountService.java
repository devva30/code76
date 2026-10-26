package com.code76.store.accounts.service;

import com.code76.store.accounts.domain.Role;
import com.code76.store.accounts.domain.UserAccount;
import com.code76.store.accounts.dto.AccountDtos.RegisterRequest;
import com.code76.store.accounts.dto.AccountDtos.UserDto;
import com.code76.store.accounts.repository.UserAccountRepository;
import com.code76.store.admin.AdminProperties;
import com.code76.store.common.error.ConflictException;
import com.code76.store.common.error.InvalidRequestException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Locale;
import java.util.Optional;

/** Creating accounts and reading the signed-in customer's profile. */
@Service
@Transactional
public class AccountService {

    /** bcrypt ignores everything after 72 bytes; multi-byte characters can hit that before 72 characters. */
    static final int MAX_PASSWORD_BYTES = 72;

    private final UserAccountRepository users;
    private final PasswordEncoder passwordEncoder;
    private final AdminProperties admins;

    public AccountService(UserAccountRepository users, PasswordEncoder passwordEncoder, AdminProperties admins) {
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.admins = admins;
    }

    /** One spelling per address: " Riya@Mail.COM " and "riya@mail.com" are the same account. */
    public static String normaliseEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase(Locale.ROOT);
    }

    public UserAccount register(RegisterRequest request) {
        String email = normaliseEmail(request.email());
        if (request.password().getBytes(StandardCharsets.UTF_8).length > MAX_PASSWORD_BYTES) {
            throw new InvalidRequestException("password", "is too long; use at most 72 characters (fewer with emoji or accents)");
        }
        if (users.existsByEmail(email)) {
            throw emailTaken();
        }
        UserAccount user = new UserAccount(email, request.name().trim(), passwordEncoder.encode(request.password()));
        if (admins.isAdminEmail(email)) {
            user.setRole(Role.ADMIN); // listed in ADMIN_EMAILS
        }
        try {
            return users.saveAndFlush(user);
        } catch (DataIntegrityViolationException raceWithAnotherSignUp) {
            throw emailTaken();
        }
    }

    public void recordLogin(Long userId) {
        users.findById(userId).ifPresent(u -> u.recordLogin(Instant.now()));
    }

    /** Empty if the account was deleted or disabled since the session started. */
    @Transactional(readOnly = true)
    public Optional<UserDto> findActiveUser(Long userId) {
        return users.findById(userId).filter(UserAccount::isEnabled).map(UserDto::from);
    }

    private static ConflictException emailTaken() {
        return new ConflictException("EMAIL_TAKEN", "An account with this email already exists. Try signing in instead.");
    }
}
