package com.code76.store.accounts.repository;

import com.code76.store.accounts.domain.UserAccount;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {

    /** Expects an already-normalised (trimmed, lower-case) email. */
    Optional<UserAccount> findByEmail(String email);

    boolean existsByEmail(String email);
}
