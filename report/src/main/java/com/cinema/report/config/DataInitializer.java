package com.cinema.report.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.io.File;

@Component
public class DataInitializer implements CommandLineRunner {
    
    @Value("${app.upload.dir}")
    private String uploadDir;
    
    @Override
    public void run(String... args) throws Exception {
        File uploadDirectory = new File(uploadDir);
        if (!uploadDirectory.exists()) {
            boolean created = uploadDirectory.mkdirs();
            if (created) {
                System.out.println("Created upload directory: " + uploadDirectory.getAbsolutePath());
            }
        }
    }
}
