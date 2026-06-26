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
        if (photos == null) {
            return null;
        }
        List<Map<String, Object>> result = new ArrayList<>();
        for (Map<String, Object> photo : photos) {
            Map<String, Object> newPhoto = new HashMap<>(photo);
            // 检查 url 字段是否为 base64 数据
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
            // 检查 src 字段
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

    /**
     * 将 base64 图片数据解码并保存到 images 文件夹
     */
    private String saveBase64ToFile(String base64Data) {
        try {
            // 解析 base64 数据: data:image/png;base64,xxxxx
            String[] parts = base64Data.split(",", 2);
            if (parts.length != 2) {
                return null;
            }

            String mimeType = parts[0]; // data:image/png;base64
            String base64 = parts[1];

            // 从 mimeType 提取扩展名
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

        if (city != null && !city.trim().isEmpty() && status != null && !status.trim().isEmpty()) {
            return submissionRepository.findByStatusAndSelectedCityOrderByIdDesc(status, city, pageable);
        }

        if (city != null && !city.trim().isEmpty()) {
            return submissionRepository.findBySelectedCityOrderByIdDesc(city, pageable);
        }

        if (status != null && !status.trim().isEmpty()) {
            return submissionRepository.findByStatusOrderByIdDesc(status, pageable);
        }

        return submissionRepository.findAllByOrderByIdDesc(pageable);
    }

    public Submission getDetail(String id) {
        return submissionRepository.findById(id).orElse(null);
    }

    @Transactional
    public void updateStatus(StatusUpdateRequest request) {
        Submission submission = submissionRepository.findById(request.getId())
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
    public boolean togglePin(String id) {
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
    public void delete(String id) {
        submissionRepository.deleteById(id);
    }

    @Transactional
    public void deleteByUser(String id) {
        Submission submission = submissionRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("记录不存在"));

        if (!"pending".equals(submission.getStatus())) {
            throw new RuntimeException("该记录已被管理员处理，无法删除");
        }

        submissionRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public List<Submission> getHistoryByPhone(String reporterPhone) {
        return submissionRepository.findByReporterPhoneOrderByIdDesc(reporterPhone);
    }
}
