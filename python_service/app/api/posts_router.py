"""
API роутер для AI парсинга и конфигурации постов.
"""
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Dict, Any, List

from app.schemas.models import ParseRequest, PostConfigRequest, PostConfigResponse
from app.services.ai_parser import ai_parser_service
from app.services.nine_api import nine_service
from app.config.settings import (
    STATIC_DEFAULTS, 
    DEPENDENT_FIELDS, 
    DYNAMIC_IDS_MAP,
    FEATURE_MARKA_ID,
    FEATURE_MODEL_ID,
    FEATURE_GENERATION_ID,
    FEATURES_FILE_PATH
)

router = APIRouter(prefix="/api", tags=["posts"])

# Поля которые пропускаем (заполняются статичными значениями)
SKIP_AI_FIELDS = set(STATIC_DEFAULTS.keys())

# Приоритетные поля - парсятся первыми (нужны для зависимых полей)
PRIORITY_FIELDS = {
    DYNAMIC_IDS_MAP["vin"],    # VIN-код
    DYNAMIC_IDS_MAP["year"],   # Год выпуска
    FEATURE_MARKA_ID,          # Марка
}


def load_features_json() -> Dict[str, Any]:
    """Загружает JSON с фичами."""
    try:
        with open(FEATURES_FILE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Ошибка загрузки features: {e}")
        return {}


def get_static_default(feature_id: str, options: list) -> Dict[str, str]:
    """Получает статичное значение по умолчанию."""
    default_option_id = STATIC_DEFAULTS.get(feature_id)
    if not default_option_id or default_option_id == "generation":
        return {"label": "", "label_id": ""}
    
    for opt in options or []:
        if str(opt.get("id")) == default_option_id:
            return {"label": opt.get("title", ""), "label_id": default_option_id}
    
    return {"label": "", "label_id": default_option_id}


def collect_all_features(features_data: Dict) -> List[Dict]:
    """Собирает все поля из всех групп в плоский список."""
    all_features = []
    for group in features_data.get("features_groups", []):
        for feature in group.get("features", []):
            feature_copy = feature.copy()
            feature_copy["_group_title"] = group.get("title", "")
            all_features.append(feature_copy)
    return all_features


def parse_feature(
    feature: Dict, 
    text: str, 
    parsed_values: Dict[str, Dict[str, str]]
) -> Dict[str, str]:
    """
    Парсит одно поле.
    Возвращает {"label": "...", "label_id": "..."} или {"label": ""}
    """
    feature_id = str(feature.get("id", ""))
    feature_title = feature.get("title", "")
    feature_type = feature.get("type", "")
    feature_options = feature.get("options", [])
    
    # Статичные дефолты
    if feature_id in SKIP_AI_FIELDS:
        default = get_static_default(feature_id, feature_options)
        print(f"⏭️ Статичное: {feature_title} = {default['label']}")
        return default
    
    # Зависимые поля (модель, поколение) - пропускаем на первом проходе
    if feature_id in DEPENDENT_FIELDS:
        return {"label": "", "label_id": ""}
    
    # Обычный парсинг через AI
    result = ai_parser_service.parse_single_field(
        text=text,
        field={
            "id": feature_id,
            "title": feature_title,
            "type": feature_type,
            "options": feature_options
        }
    )
    return result


def parse_dependent_feature(
    feature: Dict,
    text: str,
    parsed_values: Dict[str, Dict[str, str]]
) -> tuple[Dict[str, str], List[Dict]]:
    """
    Парсит зависимое поле (модель, поколение).
    Возвращает (result, api_options)
    """
    feature_id = str(feature.get("id", ""))
    feature_title = feature.get("title", "")
    feature_type = feature.get("type", "")
    
    parent_id = DEPENDENT_FIELDS.get(feature_id)
    parent_value = parsed_values.get(parent_id, {})
    parent_label_id = parent_value.get("label_id", "")
    
    if not parent_label_id:
        print(f"⚠️ Пропуск {feature_title}: нет родительского значения (parent_id={parent_id})")
        return {"label": "", "label_id": ""}, []
    
    api_options = []
    
    # Модель - загружаем через API
    if feature_id == FEATURE_MODEL_ID:
        print(f"🔄 Загрузка моделей для марки ID={parent_label_id}")
        api_options = nine_service.get_models(parent_label_id)
        feature_options = [{"id": o["id"], "title": o["name"]} for o in api_options]
        
        result = ai_parser_service.parse_single_field(
            text=text,
            field={
                "id": feature_id,
                "title": feature_title,
                "type": feature_type,
                "options": feature_options
            }
        )
        return result, feature_options
    
    # Поколение - загружаем через API + используем VIN и год
    if feature_id == FEATURE_GENERATION_ID:
        print(f"🔄 Загрузка поколений для модели ID={parent_label_id}")
        api_options = nine_service.get_generations(parent_label_id)
        feature_options = [{"id": o["id"], "title": o["name"]} for o in api_options]
        
        if not feature_options:
            print(f"⚠️ Нет поколений для модели {parent_label_id}")
            return {"label": "", "label_id": ""}, []
        
        # Получаем VIN и год из уже распарсенных данных
        vin_id = DYNAMIC_IDS_MAP["vin"]
        year_id = DYNAMIC_IDS_MAP["year"]
        
        vin = parsed_values.get(vin_id, {}).get("label", "")
        year = parsed_values.get(year_id, {}).get("label", "")
        make = parsed_values.get(FEATURE_MARKA_ID, {}).get("label", "")
        model = parsed_values.get(FEATURE_MODEL_ID, {}).get("label", "")
        
        print(f"📋 Данные для определения поколения: VIN={vin}, Year={year}, Make={make}, Model={model}")
        
        # Форматируем поколения для AI
        generations_for_ai = [
            {"id": str(o["id"]), "name": o["name"]} 
            for o in api_options
        ]
        
        result = ai_parser_service.detect_generation(
            vin=vin,
            year=int(year) if year and year.isdigit() else 0,
            make=make,
            model=model,
            generations=generations_for_ai
        )
        return result, feature_options
    
    return {"label": "", "label_id": ""}, []


@router.post("/post-config", response_model=PostConfigResponse)
async def get_post_config(request: PostConfigRequest) -> Dict[str, Any]:
    """
    Получает конфигурацию полей для создания поста.
    
    Логика:
    1. Загружаем структуру полей из features.json
    2. ПЕРВЫЙ ПРОХОД: парсим все базовые поля (включая VIN, год, марку)
    3. ВТОРОЙ ПРОХОД: парсим зависимые поля (модель → поколение)
    4. Возвращаем структуру с группами и полями
    """
    print(f"📋 POST /api/post-config. Текст: {request.text[:100] if request.text else 'Пусто'}...")
    
    # 1. Загружаем JSON с фичами
    features_data = load_features_json()
    
    if not features_data.get("features_groups"):
        return JSONResponse(
            content={"error": "Не удалось загрузить конфигурацию полей"}, 
            status_code=500
        )
    
    # 2. Хранилище распарсенных значений
    parsed_values: Dict[str, Dict[str, str]] = {}
    
    # 3. Хранилище обновлённых options (для зависимых полей)
    updated_options: Dict[str, List[Dict]] = {}
    
    if request.text:
        # Собираем все поля
        all_features = collect_all_features(features_data)
        
        # ===== ПЕРВЫЙ ПРОХОД: базовые поля =====
        print("=" * 50)
        print("🔵 ПЕРВЫЙ ПРОХОД: парсинг базовых полей")
        print("=" * 50)
        
        for feature in all_features:
            feature_id = str(feature.get("id", ""))
            
            # Пропускаем зависимые поля - их парсим во втором проходе
            if feature_id in DEPENDENT_FIELDS:
                continue
            
            result = parse_feature(feature, request.text, parsed_values)
            parsed_values[feature_id] = result
        
        # ===== ВТОРОЙ ПРОХОД: зависимые поля (в правильном порядке) =====
        print("=" * 50)
        print("🟢 ВТОРОЙ ПРОХОД: парсинг зависимых полей")
        print("=" * 50)
        
        # Порядок важен: сначала модель (зависит от марки), потом поколение (зависит от модели)
        dependent_order = [FEATURE_MODEL_ID, FEATURE_GENERATION_ID]
        
        for dep_id in dependent_order:
            # Находим feature по ID
            feature = next((f for f in all_features if str(f.get("id")) == dep_id), None)
            if not feature:
                continue
            
            result, api_options = parse_dependent_feature(feature, request.text, parsed_values)
            parsed_values[dep_id] = result
            
            if api_options:
                updated_options[dep_id] = api_options
    
    # 4. Собираем результат с группами
    result_groups = []
    
    for group in features_data.get("features_groups", []):
        processed_group = {
            "title": group.get("title", ""),
            "features": []
        }
        
        for feature in group.get("features", []):
            feature_id = str(feature.get("id", ""))
            parsed = parsed_values.get(feature_id, {"label": "", "label_id": ""})
            
            # Берём обновлённые options если есть (для модели, поколения)
            options = updated_options.get(feature_id, feature.get("options", []))
            
            processed_feature = {
                "id": feature_id,
                "title": feature.get("title", ""),
                "type": feature.get("type", ""),
                "required": feature.get("required", False),
                "units": feature.get("units"),
                "options": options,
                "label": parsed.get("label", ""),
                "label_id": parsed.get("label_id", ""),
            }
            
            processed_group["features"].append(processed_feature)
        
        result_groups.append(processed_group)
    
    # Красивый вывод title, label, label_id в JSON формате
    for group in result_groups:
        print("=" * 50)
        print(f"Группа: {group['title']}")
        print("=" * 50)
        for feature in group["features"]:
            print(json.dumps({
                "title": feature["title"],
                "label": feature["label"],
                "label_id": feature["label_id"]
            }, ensure_ascii=False, indent=4))
        print("=" * 50)
    
    # Подсчёт количества пустых label
    empty_labels_count = sum(
        1 for group in result_groups for feature in group["features"] if not feature["label"]
    )
    print(f"Количество пустых label: {empty_labels_count}")
    
    return {"features_groups": result_groups}
