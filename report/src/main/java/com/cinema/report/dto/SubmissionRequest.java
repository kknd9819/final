package com.cinema.report.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class SubmissionRequest {
    private String reporterName;
    private String reporterTitle;
    private String reporterPhone;
    private String selectedCity;
    private String selectedCounty;
    private String cinemaName;
    private Map<String, Object> hazards;
    private String othersText;
    private List<Map<String, Object>> photos;
    private List<Map<String, Object>> othersPhotos;
}
