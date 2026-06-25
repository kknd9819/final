package com.cinema.report.controller;

import com.cinema.report.dto.ApiResponse;
import com.cinema.report.dto.LoginRequest;
import com.cinema.report.dto.StatusUpdateRequest;
import com.cinema.report.dto.SubmissionRequest;
import com.cinema.report.entity.Submission;
import com.cinema.report.config.JwtUtil;
import com.cinema.report.service.GeocodeService;
import com.cinema.report.service.SubmissionService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api")
public class ApiController {
    
    @Autowired
    private SubmissionService submissionService;
    
    @Autowired
    private GeocodeService geocodeService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Value("${app.admin.username}")
    private String adminUsername;
    
    @Value("${app.admin.password}")
    private String adminPassword;
    
    @Value("${app.upload.dir}")
    private String uploadDir;
    
    @PostMapping("/submit")
    public ResponseEntity<?> submit(@RequestBody SubmissionRequest request) {
        try {
            Submission submission = submissionService.submit(request);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("id", submission.getId());
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("提交失败: " + e.getMessage()));
        }
    }
    
    @PostMapping("/upload")
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        try {
            if (file.isEmpty()) {
                return ResponseEntity.badRequest().body(ApiResponse.error("文件为空"));
            }
            
            String originalFilename = file.getOriginalFilename();
            String extension = "";
            if (originalFilename != null && originalFilename.contains(".")) {
                extension = originalFilename.substring(originalFilename.lastIndexOf("."));
            }
            
            String newFilename = UUID.randomUUID().toString() + extension;
            
            File uploadDirectory = new File(uploadDir);
            if (!uploadDirectory.exists()) {
                uploadDirectory.mkdirs();
            }
            
            Path filePath = Paths.get(uploadDir, newFilename);
            Files.write(filePath, file.getBytes());
            
            Map<String, String> result = new HashMap<>();
            result.put("uploadUrl", "/images/" + newFilename);
            result.put("publicUrl", "/images/" + newFilename);
            
            return ResponseEntity.ok(result);
        } catch (IOException e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("上传失败: " + e.getMessage()));
        }
    }
    
    @PostMapping("/delete-by-user")
    public ResponseEntity<?> deleteByUser(@RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            submissionService.deleteByUser(id);
            Map<String, Boolean> result = new HashMap<>();
            result.put("success", true);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }
    
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody LoginRequest request) {
        if (adminUsername.equals(request.getUsername()) && adminPassword.equals(request.getPassword())) {
            String token = jwtUtil.generateToken(request.getUsername());
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("token", token);
            return ResponseEntity.ok(result);
        } else {
            return ResponseEntity.status(401).body(ApiResponse.error("用户名或密码错误"));
        }
    }
    
    @GetMapping("/geocode")
    public ResponseEntity<?> geocode(@RequestParam("lat") double lat, @RequestParam("lng") double lng) {
        try {
            Map<String, Object> result = geocodeService.geocode(lat, lng);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("地理编码失败: " + e.getMessage()));
        }
    }
    
    @GetMapping("/list")
    public ResponseEntity<?> list(
            @RequestParam(value = "sort", required = false) String sort,
            @RequestParam(value = "city", required = false) String city,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "pageSize", defaultValue = "10") int pageSize,
            @RequestParam(value = "keyword", required = false) String keyword) {
        
        Page<Submission> submissions = submissionService.list(city, status, keyword, sort, page, pageSize);
        
        Map<String, Object> result = new HashMap<>();
        result.put("list", submissions.getContent());
        result.put("total", submissions.getTotalElements());
        result.put("page", submissions.getNumber());
        result.put("pageSize", submissions.getSize());
        
        return ResponseEntity.ok(result);
    }
    
    @GetMapping("/detail")
    public ResponseEntity<?> detail(@RequestParam("id") String id) {
        Submission submission = submissionService.getDetail(id);
        if (submission != null) {
            return ResponseEntity.ok(submission);
        } else {
            return ResponseEntity.notFound().build();
        }
    }
    
    @PostMapping("/status")
    public ResponseEntity<?> updateStatus(@RequestBody StatusUpdateRequest request) {
        try {
            submissionService.updateStatus(request);
            Map<String, Boolean> result = new HashMap<>();
            result.put("success", true);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("更新失败: " + e.getMessage()));
        }
    }
    
    @GetMapping("/stats")
    public ResponseEntity<?> stats() {
        Map<String, Object> stats = submissionService.getStats();
        return ResponseEntity.ok(stats);
    }
    
    @PostMapping("/pin")
    public ResponseEntity<?> pin(@RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            boolean pinned = submissionService.togglePin(id);
            Map<String, Object> result = new HashMap<>();
            result.put("success", true);
            result.put("pinned", pinned);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("操作失败: " + e.getMessage()));
        }
    }
    
    @DeleteMapping("/delete")
    public ResponseEntity<?> delete(@RequestBody Map<String, String> request) {
        try {
            String id = request.get("id");
            submissionService.delete(id);
            Map<String, Boolean> result = new HashMap<>();
            result.put("success", true);
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            return ResponseEntity.badRequest().body(ApiResponse.error("删除失败: " + e.getMessage()));
        }
    }
}
