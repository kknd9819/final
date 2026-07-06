package com.cinema.report.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Map;
import java.util.TreeMap;

@Service
public class GeocodeService {
    
    @Value("${app.amap.key}")
    private String amapKey;
    
    @Value("${app.amap.secret}")
    private String amapSecret;
    
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    public Map<String, Object> geocode(double lat, double lng) {
        try {
            Map<String, String> params = new TreeMap<>();
            params.put("key", amapKey);
            params.put("location", lng + "," + lat);
            params.put("radius", "1000");
            params.put("extensions", "base");
            
            String signature = generateSignature(params);
            params.put("sig", signature);
            
            StringBuilder urlBuilder = new StringBuilder("https://restapi.amap.com/v3/geocode/reo?");
            for (Map.Entry<String, String> entry : params.entrySet()) {
                urlBuilder.append(entry.getKey())
                    .append("=")
                    .append(java.net.URLEncoder.encode(entry.getValue(), StandardCharsets.UTF_8.name()))
                    .append("&");
            }
            
            String url = urlBuilder.toString();
            if (url.endsWith("&")) {
                url = url.substring(0, url.length() - 1);
            }
            
            HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);
            
            int responseCode = connection.getResponseCode();
            BufferedReader reader;
            if (responseCode >= 200 && responseCode < 300) {
                reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), StandardCharsets.UTF_8));
            } else {
                reader = new BufferedReader(new InputStreamReader(connection.getErrorStream(), StandardCharsets.UTF_8));
            }
            
            StringBuilder responseBody = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                responseBody.append(line);
            }
            reader.close();
            connection.disconnect();
            
            return objectMapper.readValue(responseBody.toString(), Map.class);
        } catch (Exception e) {
            Map<String, Object> errorResult = new HashMap<>();
            errorResult.put("status", "0");
            errorResult.put("info", "Geocoding failed: " + e.getMessage());
            return errorResult;
        }
    }
    
    private String generateSignature(Map<String, String> params) throws Exception {
        StringBuilder sb = new StringBuilder();
        for (Map.Entry<String, String> entry : params.entrySet()) {
            sb.append(entry.getKey())
                .append("=")
                .append(entry.getValue())
                .append("&");
        }
        sb.append(amapSecret);
        
        String signStr = sb.toString();
        
        Mac mac = Mac.getInstance("HmacSHA256");
        SecretKeySpec secretKeySpec = new SecretKeySpec(
            amapSecret.getBytes(StandardCharsets.UTF_8), 
            "HmacSHA256"
        );
        mac.init(secretKeySpec);
        byte[] signBytes = mac.doFinal(signStr.getBytes(StandardCharsets.UTF_8));
        
        StringBuilder hexString = new StringBuilder();
        for (byte b : signBytes) {
            String hex = Integer.toHexString(0xff & b);
            if (hex.length() == 1) {
                hexString.append('0');
            }
            hexString.append(hex);
        }
        
        return hexString.toString();
    }
}
