"""
API роутер для AI парсинга и конфигурации постов.
"""
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Dict, Any, Optional

from app.schemas.models import ParseRequest, PostConfigRequest, PostConfigResponse
from app.services.ai_parser import ai_parser_service
from app.services.nine_api import nine_service
from app.utils.features_helpers import (
    load_features_json,
    build_ai_request,
    process_feature,
)

router = APIRouter(prefix="/api", tags=["posts"])

# Маппинг названий полей на их title в API
FEATURE_TITLE_MAP = {
    "make": "Марка",
    "model": "Модель",
    "generation": "Поколение",
    "year": "Год выпуска",
    "vin": "VIN-код",
}


def extract_feature_value(result_groups: list, feature_key: str) -> Optional[str]:
    """
    Извлекает значение поля (label) из result_groups по ключу.
    
    Args:
        result_groups: Список групп с фичами
        feature_key: Ключ поля (например: "model", "make", "year", "vin")
    
    Returns:
        Значение поля (label) или None
    """
    # Получаем title по ключу
    feature_title = FEATURE_TITLE_MAP.get(feature_key, feature_key)
    
    for group in result_groups:
        for feature in group.get("features", []):
            # Ищем по title или по id
            if feature.get("title") == feature_title or feature.get("name") == feature_key:
                return feature.get("label") or feature.get("value")
    return None


def extract_feature_id(result_groups: list, feature_key: str) -> Optional[str]:
    """
    Извлекает ID выбранного значения (label_id) из result_groups по ключу.
    
    Args:
        result_groups: Список групп с фичами
        feature_key: Ключ поля (например: "model", "make")
    
    Returns:
        ID выбранного значения (label_id) или None
    """
    # Получаем title по ключу
    feature_title = FEATURE_TITLE_MAP.get(feature_key, feature_key)
    
    for group in result_groups:
        for feature in group.get("features", []):
            # Ищем по title или по id
            if feature.get("title") == feature_title or feature.get("name") == feature_key:
                label_id = feature.get("label_id") or feature.get("selected_id")
                if label_id:
                    return str(label_id)
                
                # Если label_id пустой, ищем ID по значению label в options
                label = feature.get("label") or feature.get("value")
                options = feature.get("options", [])
                for opt in options:
                    if opt.get("title") == label or opt.get("name") == label:
                        return str(opt.get("id"))
                return None
    return None


def update_feature_value(result_groups: list, feature_key: str, value: str, option_id: str = None) -> None:
    """
    Обновляет значение поля в result_groups.
    
    Args:
        result_groups: Список групп с фичами
        feature_key: Ключ поля
        value: Новое значение
        option_id: ID опции (опционально)
    """
    # Получаем title по ключу
    feature_title = FEATURE_TITLE_MAP.get(feature_key, feature_key)
    
    for group in result_groups:
        for feature in group.get("features", []):
            if feature.get("title") == feature_title or feature.get("name") == feature_key:
                feature["label"] = value
                if option_id:
                    feature["label_id"] = option_id
                return


def find_model_id_by_name(make_id: str, model_name: str) -> Optional[str]:
    """
    Ищет ID модели по названию через API 999.md.
    
    Args:
        make_id: ID марки автомобиля
        model_name: Название модели (например: "Octavia", "X5")
    
    Returns:
        ID модели или None
    """
    if not make_id or not model_name:
        return None
    
    try:
        # Получаем список моделей для марки
        models_list = nine_service.get_models(make_id)
        
        if not models_list:
            print(f"⚠️ Список моделей для марки {make_id} пуст")
            return None
        
        # Ищем модель по названию (без учёта регистра)
        model_name_lower = model_name.lower().strip()
        
        for model in models_list:
            if model.get("name", "").lower().strip() == model_name_lower:
                print(f"✅ Найдена модель: {model.get('name')} -> ID: {model.get('id')}")
                return str(model.get("id"))
        
        # Если точного совпадения нет, ищем частичное
        for model in models_list:
            if model_name_lower in model.get("name", "").lower():
                print(f"✅ Найдена модель (частичное): {model.get('name')} -> ID: {model.get('id')}")
                return str(model.get("id"))
        
        print(f"⚠️ Модель '{model_name}' не найдена в списке")
        return None
        
    except Exception as e:
        print(f"❌ Ошибка поиска модели: {str(e)}")
        return None


@router.post("/post-config", response_model=PostConfigResponse)
async def get_post_config(request: PostConfigRequest) -> Dict[str, Any]:
    """
    Получает конфигурацию полей для создания поста.
    
    - Загружает структуру полей из features.json
    - Если передан text - формирует запрос для AI только с динамическими полями
    - Применяет статичные дефолты для полей без AI значений
    - Определяет поколение автомобиля по VIN и году
    - Возвращает структуру с группами и полями
    """
    print(f"📋 POST /api/post-config. Текст: {request.text[:50] if request.text else 'Пусто'}...")
    
    # 1. Загружаем JSON с фичами
    features_data = load_features_json()
    
    if not features_data.get("features_groups"):
        return JSONResponse(
            content={"error": "Не удалось загрузить конфигурацию полей"}, 
            status_code=500
        )
    
    # 2. Запускаем AI парсер (если есть текст)
    ai_result = {}
    if request.text:
        try:
            # Формируем запрос только с динамическими полями
            ai_request = build_ai_request(features_data)
            print(f"🤖 AI запрос: {json.dumps(ai_request, ensure_ascii=False)[:50]}...")
            
            # Отправляем в AI парсер текст + структуру полей
            ai_result = ai_parser_service.parse_with_schema(request.text, ai_request)
            if not isinstance(ai_result, dict):
                ai_result = {}
            print(f"🤖 AI ответ: {json.dumps(ai_result, ensure_ascii=False)[:50]}...")
        except Exception as e:
            print(f"❌ AI Error: {str(e)}")
            ai_result = {}
    
    # 3. Обрабатываем и трансформируем структуру
    result_groups = []
    
    for group in features_data.get("features_groups", []):
        processed_group = {
            "title": group.get("title", ""),
            "features": []
        }
        
        for feature in group.get("features", []):
            processed_feature = process_feature(feature, ai_result)
            processed_group["features"].append(processed_feature)
        
        result_groups.append(processed_group)
    print(f"✅ Обработано групп: {result_groups} /n ")
    
    # 4. Определение поколения автомобиля
    try:
        # Извлекаем необходимые данные из result_groups
        make_id = extract_feature_id(result_groups, "make")
        model_id = extract_feature_id(result_groups, "model")
        vin = extract_feature_value(result_groups, "vin")
        year = extract_feature_value(result_groups, "year")
        make = extract_feature_value(result_groups, "make")
        model = extract_feature_value(result_groups, "model")
        
        print(f"🔍 Данные для определения поколения: make_id={make_id}, model_id={model_id}, vin={vin}, year={year}, make={make}, model={model}")
        
        # Если model_id не найден, но есть make_id и название модели — ищем через API
        if not model_id and make_id and model:
            print(f"🔎 Поиск model_id по названию '{model}' для марки {make_id}...")
            model_id = find_model_id_by_name(make_id, model)
            print(f"🔍 Результат поиска model_id: {model_id}")
        
        # Если есть model_id - запрашиваем список поколений
        if model_id and (vin or year):
            print(f"🚗 Запрос поколений для модели ID: {model_id}")
            generations_list = nine_service.get_generations(model_id)
            
            if generations_list:
                print(f"📋 Получено {len(generations_list)} поколений")
                
                # Форматируем поколения для AI
                generations_for_ai = []
                for gen in generations_list:
                    generations_for_ai.append({
                        "id": gen.get("id"),
                        "name": gen.get("name"),
                        "year_from": gen.get("year_from"),
                        "year_to": gen.get("year_to")
                    })
                
                # Вызываем AI для определения поколения
                generation_result = ai_parser_service.detect_generation(
                    vin=vin or "",
                    year=int(year) if year and year.isdigit() else 0,
                    make=make or "",
                    model=model or "",
                    generations=generations_for_ai
                )
                
                print(f"🎯 Результат определения поколения: {generation_result}")
                
                # Обновляем значение поколения в result_groups
                if generation_result.get("id"):
                    update_feature_value(
                        result_groups,
                        "generation",  # имя поля поколения
                        generation_result.get("name", ""),
                        generation_result.get("id")
                    )
                    print(f"✅ Поколение установлено: {generation_result.get('name')}")
            else:
                print("⚠️ Список поколений пуст")
        else:
            print("⚠️ Недостаточно данных для определения поколения")
            
    except Exception as e:
        print(f"❌ Ошибка определения поколения: {str(e)}")
        import traceback
        traceback.print_exc()
    
    # 5. Возвращаем словарь (FastAPI автоматически сериализует)
    return {"features_groups": result_groups}
