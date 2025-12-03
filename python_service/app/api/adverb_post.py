"""
API роутер для создания объявлений на 999.md.
"""
import json
from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

router = APIRouter(prefix="/api", tags=["advert"])


class FeatureValue(BaseModel):
    """Значение характеристики."""
    id: str
    value: str
    unit: Optional[str] = None


class CreateAdvertRequest(BaseModel):
    """Запрос на создание объявления."""
    images: List[str]  # URLs изображений
    features: List[FeatureValue]  # Массив характеристик


@router.post("/create-advert")
async def create_advert(request: CreateAdvertRequest) -> Dict[str, Any]:
    """
    Создаёт объявление на 999.md.
    
    Args:
        request.images: Список URL изображений
        request.features: Массив характеристик [{"id": "20", "value": "139", "unit": "eur"}, ...]
    
    Returns:
        Результат создания объявления
    """
    print("=" * 50)
    print("📤 POST /api/create-advert")
    print(f"🖼️  Images: {len(request.images)} шт.")
    print(f"📋 Features: {len(request.features)} шт.")
    print("=" * 50)
    
    # Логируем изображения
    for i, img in enumerate(request.images):
        print(f"  Image [{i}]: {img[:50]}..." if len(img) > 50 else f"  Image [{i}]: {img}")
    
    # Логируем features
    for feat in request.features:
        unit_str = f", unit={feat.unit}" if feat.unit else ""
        print(f"  Feature ID={feat.id}: value={feat.value}{unit_str}")
    
    # TODO: Здесь будет вызов 999.md API
    # Пока возвращаем заглушку
    
    print("=" * 50)
    print("✅ Заглушка: объявление 'создано'")
    print("=" * 50)
    
    return {
        "success": True,
        "advert_id": "STUB_12345",
        "url": "https://999.md/ru/12345",
        "message": f"Получено {len(request.images)} фото и {len(request.features)} характеристик"
    }
