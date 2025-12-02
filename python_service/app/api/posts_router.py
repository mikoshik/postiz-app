"""
API роутер для AI парсинга и конфигурации постов.
"""
import json
from fastapi import APIRouter
from fastapi.responses import JSONResponse
from typing import Dict, Any

from app.schemas.models import ParseRequest, PostConfigRequest, PostConfigResponse
from app.services.ai_parser import ai_parser_service
from app.utils.features_helpers import (
    load_features_json,
    build_ai_request,
    process_feature,
)

router = APIRouter(prefix="/api", tags=["posts"])


@router.post("/post-config", response_model=PostConfigResponse)
async def get_post_config(request: PostConfigRequest) -> Dict[str, Any]:
    """
    Получает конфигурацию полей для создания поста.
    
    - Загружает структуру полей из features.json
    - Если передан text - формирует запрос для AI только с динамическими полями
    - Применяет статичные дефолты для полей без AI значений
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
            print(f"🤖 AI запрос: {json.dumps(ai_request, ensure_ascii=False, indent=2)}")
            
            # Отправляем в AI парсер текст + структуру полей
            ai_result = ai_parser_service.parse_with_schema(request.text, ai_request)
            if not isinstance(ai_result, dict):
                ai_result = {}
            print(f"🤖 AI ответ: {ai_result}")
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
    
    # 4. Возвращаем словарь (FastAPI автоматически сериализует)
    return {"features_groups": result_groups}
