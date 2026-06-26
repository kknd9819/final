package com.cinema.report.entity;

import com.cinema.report.config.JsonListConverter;
import com.cinema.report.config.JsonObjectMapConverter;
import com.fasterxml.jackson.annotation.JsonFormat;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Entity
@Getter
@Setter
@Table(name = "submissions", indexes = {
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_selected_city", columnList = "selected_city"),
    @Index(name = "idx_timestamp", columnList = "timestamp"),
    @Index(name = "idx_is_pinned", columnList = "is_pinned")
})
public class Submission {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id")
    private Long id;
    
    @Column(name = "timestamp")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime timestamp;
    
    @Column(name = "reporter_name", length = 100, nullable = false)
    private String reporterName;
    
    @Column(name = "reporter_title", length = 20)
    private String reporterTitle = "";
    
    @Column(name = "reporter_phone", length = 20, nullable = false)
    private String reporterPhone;
    
    @Column(name = "selected_city", length = 100, nullable = false)
    private String selectedCity;
    
    @Column(name = "selected_county", length = 100)
    private String selectedCounty = "";
    
    @Column(name = "cinema_name", length = 200, nullable = false)
    private String cinemaName;
    
    @Column(name = "hazards", columnDefinition = "JSON")
    @Convert(converter = JsonObjectMapConverter.class)
    private Map<String, Object> hazards = new HashMap<>();
    
    @Column(name = "others_text", columnDefinition = "TEXT")
    private String othersText;
    
    @Column(name = "photos", columnDefinition = "JSON")
    @Convert(converter = JsonListConverter.class)
    private List<Map<String, Object>> photos = new ArrayList<>();
    
    @Column(name = "others_photos", columnDefinition = "JSON")
    @Convert(converter = JsonListConverter.class)
    private List<Map<String, Object>> othersPhotos = new ArrayList<>();
    
    @Column(name = "status")
    private String status = "pending";
    
    @Column(name = "note", columnDefinition = "TEXT")
    private String note;
    
    @Column(name = "reward_amount")
    private Integer rewardAmount = 0;
    
    @Column(name = "is_pinned")
    private Boolean isPinned = false;
    
    @Column(name = "created_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime createdAt;
    
    @Column(name = "updated_at")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss")
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
        if (this.timestamp == null) {
            this.timestamp = this.createdAt;
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        this.updatedAt = LocalDateTime.now();
    }
}
