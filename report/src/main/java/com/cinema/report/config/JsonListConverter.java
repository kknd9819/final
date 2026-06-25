package com.cinema.report.config;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Converter
public class JsonListConverter implements AttributeConverter<List<Map<String, Object>>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<Map<String, Object>>> TYPE_REF = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<Map<String, Object>> attribute) {
        if (attribute == null) return null;
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new RuntimeException("JSON序列化失败", e);
        }
    }

    @Override
    public List<Map<String, Object>> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isEmpty()) return new ArrayList<>();
        try {
            // 先尝试解析为 JsonNode 来判断是数组还是对象
            com.fasterxml.jackson.databind.JsonNode node = MAPPER.readTree(dbData);
            
            if (node.isArray()) {
                // 如果是数组，直接反序列化为 List
                return MAPPER.readValue(dbData, TYPE_REF);
            } else if (node.isObject()) {
                // 如果是对象（旧格式 Map），转换为单元素 List
                Map<String, Object> map = MAPPER.readValue(dbData, new TypeReference<Map<String, Object>>() {});
                List<Map<String, Object>> list = new ArrayList<>();
                list.add(map);
                return list;
            } else {
                // 其他情况返回空列表
                return new ArrayList<>();
            }
        } catch (IOException e) {
            throw new RuntimeException("JSON反序列化失败: " + e.getMessage(), e);
        }
    }
}
