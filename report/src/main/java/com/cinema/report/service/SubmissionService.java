package com.cinema.report.service;

import com.cinema.report.dto.StatusUpdateRequest;
import com.cinema.report.dto.SubmissionRequest;
import com.cinema.report.entity.Submission;
import com.cinema.report.repository.SubmissionRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;

@Service
public class SubmissionService {
    
    @Autowired
    private SubmissionRepository submissionRepository;
    
    @Value("${app.upload.dir}")
    private String uploadDir;
    
    @Transactional
    public Submission submit(SubmissionRequest request) {
        Submission submission = new Submission();
        submission.setReporterName(request.getReporterName());
        submission.setReporterTitle(request.getReporterTitle() != null ? request.getReporterTitle() : "");
        submission.setReporterPhone(request.getReporterPhone());
        submission.setSelectedCity(request.getSelectedCity());
        submission.setSelectedCounty(request.getSelectedCounty() != null ? request.getSelectedCounty() : "");
        submission.setCinemaName(request.getCinemaName());
        
        if (request.getHazards() != null) {
            submission.setHazards(request.getHazards());
        }
        if (request.getPhotos() != null) {
            submission.setPhotos(processPhotos(request.getPhotos()));
        }
        if (request.getOthersPhotos() != null) {
            submission.setOthersPhotos(processPhotos(request.getOthersPhotos()));
        }
        
        submission.setOthersText(request.getOthersText());
        submission.setStatus("pending");
        
        return submissionRepository.save(submission);
    }
    
    /**
     * 处理照片列表，将 base64 图片数据保存为文件，数据库只存 URL
     */
    private List<Map<String, Object>> processPhotos(List<Map<String, Object>> photos) {
        if (photos == null) return null;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> photo : photos) {
            Map<String, Object> newPhoto = new HashMap<>(photo);
            Object urlObj = newPhoto.get("url");
            if (urlObj instanceof String) {
                String url = (String) urlObj;
                if (url.startsWith("data:image")) {
                    String savedUrl = saveBase64ToFile(url);
                    if (savedUrl != null) {
                        newPhoto.put("url", savedUrl);
                    }
                }
            }
            Object srcObj = newPhoto.get("src");
            if (srcObj instanceof String) {
                String src = (String) srcObj;
                if (src.startsWith("data:image")) {
                    String savedUrl = saveBase64ToFile(src);
                    if (savedUrl != null) {
                        newPhoto.put("src", savedUrl);
                        if (!newPhoto.containsKey("url")) {
                            newPhoto.put("url", savedUrl);
                        }
                    }
                }
            }
            result.add(newPhoto);
        }
        return result;
    }
    
    private String saveBase64ToFile(String base64Data) {
        try {
            String[] parts = base64Data.split(",", 2);
            if (parts.length != 2) return null;
            
            String mimeType = parts[0];
            String base64 = parts[1];
            
            String extension = ".png";
            if (mimeType.contains("jpeg") || mimeType.contains("jpg")) {
                extension = ".jpg";
            } else if (mimeType.contains("gif")) {
                extension = ".gif";
            } else if (mimeType.contains("webp")) {
                extension = ".webp";
            }
            
            String filename = UUID.randomUUID().toString() + extension;
            
            File uploadDirectory = new File(uploadDir);
            if (!uploadDirectory.exists()) {
                uploadDirectory.mkdirs();
            }
            
            byte[] imageBytes = Base64.getDecoder().decode(base64);
            Path filePath = Paths.get(uploadDir, filename);
            Files.write(filePath, imageBytes);
            
            return "/images/" + filename;
        } catch (Exception e) {
            return null;
        }
    }
    
    public Page<Submission> list(String city, String status, String keyword, String sort, int page, int pageSize) {
        Pageable pageable = PageRequest.of(page, pageSize);
        
        if (keyword != null && !keyword.trim().isEmpty()) {
            return submissionRepository.searchByKeyword(keyword, pageable);
        }
        
        return submissionRepository.findByFilters(status, city, pageable);
    }
    
    public Submission getDetail(Long id) {
        return submissionRepository.findById(id).orElse(null);
    }
    
    @Transactional
    public void updateStatus(StatusUpdateRequest request) {
        if (request.getIds() != null && request.getIds().size() > 1) {
            // Batch update
            String note = request.getNote() != null ? request.getNote() : "";
            int updated = submissionRepository.batchUpdateStatus(request.getIds(), request.getStatus(), note);
            if (updated == 0) {
                throw new RuntimeException("未找到匹配的记录");
            }
        } else {
            // Single update
            Long id = request.getIds() != null && !request.getIds().isEmpty() 
                ? request.getIds().get(0) 
                : request.getId();
            Submission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Submission not found"));
            
            if (request.getStatus() != null) {
                submission.setStatus(request.getStatus());
            }
            if (request.getNote() != null) {
                submission.setNote(request.getNote());
            }
            if (request.getRewardAmount() != null) {
                submission.setRewardAmount(request.getRewardAmount());
            }
            
            submissionRepository.save(submission);
        }
    }
    
    public Map<String, Object> getStats() {
        Map<String, Object> stats = new HashMap<>();
        
        long total = submissionRepository.count();
        stats.put("total", total);
        
        Map<String, Long> byStatus = new HashMap<>();
        byStatus.put("pending", submissionRepository.countByStatus("pending"));
        byStatus.put("reviewing", submissionRepository.countByStatus("reviewing"));
        byStatus.put("resolved", submissionRepository.countByStatus("resolved"));
        byStatus.put("invalid", submissionRepository.countByStatus("invalid"));
        stats.put("byStatus", byStatus);
        
        Map<String, Long> byCity = new HashMap<>();
        List<Object[]> cityCounts = submissionRepository.countByCity();
        for (Object[] row : cityCounts) {
            String city = (String) row[0];
            Long count = (Long) row[1];
            byCity.put(city, count);
        }
        stats.put("byCity", byCity);
        
        return stats;
    }
    
    @Transactional
    public boolean togglePin(Long id) {
        Submission submission = submissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Submission not found"));
        
        List<Submission> pinnedSubmissions = submissionRepository.findByIsPinnedTrue();
        
        if (submission.getIsPinned()) {
            submission.setIsPinned(false);
            submissionRepository.save(submission);
            return false;
        } else {
            if (pinnedSubmissions.size() >= 3) {
                throw new RuntimeException("最多只能置顶3条记录");
            }
            submission.setIsPinned(true);
            submissionRepository.save(submission);
            return true;
        }
    }
    
    @Transactional
    public void delete(Long id) {
        submissionRepository.deleteById(id);
    }
    
    @Transactional
    public void deleteByUser(Long id) {
        Submission submission = submissionRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("记录不存在"));
        
        if (!"pending".equals(submission.getStatus())) {
            throw new RuntimeException("该记录已被管理员处理，无法删除");
        }
        
        submissionRepository.deleteById(id);
    }
    
    @Transactional
    public int batchDelete(List<Long> ids) {
        return submissionRepository.batchDelete(ids);
    }
    
    @Transactional
    public int batchUpdateStatus(List<Long> ids, String status, String note) {
        return submissionRepository.batchUpdateStatus(ids, status, note);
    }
}
