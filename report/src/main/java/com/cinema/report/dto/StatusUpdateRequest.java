package com.cinema.report.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class StatusUpdateRequest {
    private Long id;
    private List<Long> ids;
    private String status;
    private String note;
    private Integer rewardAmount;
}
