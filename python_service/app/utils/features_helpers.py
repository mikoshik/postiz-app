"""
Вспомогательные функции для работы с features.
"""
import json
import os
from typing import Optional, Dict, Any, List
from app.config.settings import STATIC_DEFAULTS, DYNAMIC_IDS_MAP


# Путь к файлу с фичами
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_FILE_PATH = os.path.join(BASE_DIR, "data", "feacher_for_post.json")


def load_features_json() -> dict:
    """Загружает JSON файл с фичами."""
    try:
        with open(FEATURES_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"❌ Файл {FEATURES_FILE_PATH} не найден")
        return {"features_groups": []}
    except json.JSONDecodeError as e:
        print(f"❌ Ошибка парсинга JSON: {e}")
        return {"features_groups": []}


def find_option_by_id(options: list, option_id: str) -> Optional[dict]:
    """Находит опцию по ID в списке опций."""
    if not options:
        return None
    for opt in options:
        if str(opt.get("id")) == str(option_id):
            return {"id": str(opt["id"]), "title": opt.get("title", "")}
    return None


def find_option_by_title(options: list, title: str) -> Optional[dict]:
    """Находит опцию по названию (для AI результатов)."""
    if not options or not title:
        return None
    title_lower = title.lower().strip()
    
    # Точное совпадение
    for opt in options:
        if opt.get("title", "").lower().strip() == title_lower:
            return {"id": str(opt["id"]), "title": opt.get("title", "")}
    
    # Частичное совпадение
    for opt in options:
        if title_lower in opt.get("title", "").lower():
            return {"id": str(opt["id"]), "title": opt.get("title", "")}
    
    return None


def build_ai_request(features_data: dict) -> dict:
    """
    Формирует запрос для AI парсера только с динамическими полями.
    Для drop_down - передаём options, для текстовых - пустую строку.
    """
    ai_request = {}
    
    for group in features_data.get("features_groups", []):
        for feature in group.get("features", []):
            feature_id = str(feature.get("id", ""))
            
            # Только динамические поля
            if feature_id not in DYNAMIC_IDS_MAP:
                continue
            
            ai_key = DYNAMIC_IDS_MAP[feature_id]
            feature_type = feature.get("type", "")
            options = feature.get("options", [])
            
            # Для drop_down с options - передаём список опций
            if options and feature_type == "drop_down_options":
                ai_request[ai_key] = {
                    "value": "",
                    "options": [opt.get("title", "") for opt in options]
                }
            else:
                # Для текстовых/числовых полей - просто пустая строка
                ai_request[ai_key] = ""
    
    return ai_request


def process_feature(feature: dict, ai_result: dict) -> dict:
    """Обрабатывает одну фичу и возвращает очищенную структуру."""
    feature_id = str(feature.get("id", ""))
    feature_type = feature.get("type", "")
    options = feature.get("options", [])
    
    # Базовая структура
    processed = {
        "id": feature_id,
        "title": feature.get("title", ""),
        "type": feature_type,
        "required": feature.get("required", False),
        "label": "",
        "label_id": "",
    }
    
    # Добавляем options если есть
    if options:
        processed["options"] = [
            {"id": str(opt["id"]), "title": opt.get("title", "")} 
            for opt in options
        ]
    
    # Добавляем units если есть
    if feature.get("units"):
        processed["units"] = feature.get("units")
    
    # --- ОПРЕДЕЛЯЕМ LABEL ---
    
    # 1. Проверяем динамические поля (AI результат)
    if feature_id in DYNAMIC_IDS_MAP:
        ai_key = DYNAMIC_IDS_MAP[feature_id]
        ai_value = ai_result.get(ai_key)
        
        if ai_value:
            # Для полей с опциями - ищем соответствующую опцию
            if options and feature_type == "drop_down_options":
                matched_option = find_option_by_title(options, str(ai_value))
                if matched_option:
                    processed["label"] = matched_option["title"]
                    processed["label_id"] = matched_option["id"]
                else:
                    processed["label"] = str(ai_value)
            else:
                processed["label"] = str(ai_value)
    
    # 2. Если label пустой - проверяем статичные дефолты
    if not processed["label"] and feature_id in STATIC_DEFAULTS:
        default_option_id = STATIC_DEFAULTS[feature_id]
        
        if options:
            matched_option = find_option_by_id(options, default_option_id)
            if matched_option:
                processed["label"] = matched_option["title"]
                processed["label_id"] = matched_option["id"]
    
    # 3. Проверяем default_value из JSON
    if not processed["label"] and feature.get("default_value"):
        default_val = feature["default_value"]
        if isinstance(default_val, dict) and "options" in default_val:
            opt = default_val["options"]
            processed["label"] = opt.get("title", "")
            processed["label_id"] = str(opt.get("id", ""))
    
    return processed
