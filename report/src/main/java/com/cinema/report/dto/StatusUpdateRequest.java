package com.cinema.report.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class StatusUpdateRequest {
    private String id;
    private String status;
    private String note;
    private Integer rewardAmount;
}
