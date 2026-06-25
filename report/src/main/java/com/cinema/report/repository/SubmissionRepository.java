package com.cinema.report.repository;

import com.cinema.report.entity.Submission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, String> {
    
    Page<Submission> findByStatusOrderByCreatedAtDesc(String status, Pageable pageable);
    
    Page<Submission> findBySelectedCityOrderByCreatedAtDesc(String city, Pageable pageable);
    
    Page<Submission> findByStatusAndSelectedCityOrderByCreatedAtDesc(String status, String city, Pageable pageable);
    
    Page<Submission> findAllByOrderByCreatedAtDesc(Pageable pageable);
    
    long countByStatus(String status);
    
    List<Submission> findByIsPinnedTrue();
    
    @Query("SELECT s FROM Submission s WHERE " +
           "(:keyword IS NULL OR :keyword = '' OR " +
           "LOWER(s.reporterName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.cinemaName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.selectedCity) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.selectedCounty) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY s.createdAt DESC")
    Page<Submission> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
    
    @Query("SELECT s.selectedCity, COUNT(s) FROM Submission s GROUP BY s.selectedCity")
    List<Object[]> countByCity();
}
