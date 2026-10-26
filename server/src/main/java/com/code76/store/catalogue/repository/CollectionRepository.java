package com.code76.store.catalogue.repository;

import com.code76.store.catalogue.domain.CuratedCollection;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CollectionRepository extends JpaRepository<CuratedCollection, Long> {

    Optional<CuratedCollection> findBySlug(String slug);

    List<CuratedCollection> findAllByActiveTrueOrderBySortOrderAscNameAsc();

    List<CuratedCollection> findAllByOrderBySortOrderAscNameAsc();
}
