package com.cinema.report.repository;

import com.cinema.report.entity.Submission;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface SubmissionRepository extends JpaRepository<Submission, Long> {
    
    Page<Submission> findAllByOrderByIdDesc(Pageable pageable);
    
    long countByStatus(String status);
    
    List<Submission> findByIsPinnedTrue();
    
    @Query("SELECT s FROM Submission s WHERE " +
           "(:keyword IS NULL OR :keyword = '' OR " +
           "LOWER(s.reporterName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.cinemaName) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.selectedCity) LIKE LOWER(CONCAT('%', :keyword, '%')) OR " +
           "LOWER(s.selectedCounty) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY s.id DESC")
    Page<Submission> searchByKeyword(@Param("keyword") String keyword, Pageable pageable);
    
    @Query("SELECT s.selectedCity, COUNT(s) FROM Submission s GROUP BY s.selectedCity")
    List<Object[]> countByCity();
    
    @Modifying
    @Query("UPDATE Submission s SET s.status = :status, s.note = :note, s.updatedAt = CURRENT_TIMESTAMP WHERE s.id IN :ids")
    int batchUpdateStatus(@Param("ids") List<Long> ids, @Param("status") String status, @Param("note") String note);
    
    @Modifying
    @Query("DELETE FROM Submission s WHERE s.id IN :ids")
    int batchDelete(@Param("ids") List<Long> ids);
    
    @Query("SELECT s FROM Submission s WHERE (:status IS NULL OR :status = '' OR s.status = :status) AND (:city IS NULL OR :city = '' OR s.selectedCity = :city) ORDER BY s.id DESC")
    Page<Submission> findByFilters(@Param("status") String status, @Param("city") String city, Pageable pageable);
}
