"""
API роутер для создания объявлений на 999.md.
"""
import httpx , json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from ..services.ai_parser import ai_parser_service
from app.config.settings import NINE_API_KEY, BASE_URL_999, TYPE_999_ADVERT

router = APIRouter(prefix="/api", tags=["advert"])

# 999.md API URL
NINE_API_URL = BASE_URL_999

# Константы категорий для авто
CATEGORY_ID = "658"           # Транспорт
SUBCATEGORY_ID = "659"        # Легковые авто  
OFFER_TYPE = "776"            # Продам

# Feature ID для изображений
IMAGES_FEATURE_ID = "14"


class FeatureValue(BaseModel):
    """Значение характеристики."""
    id: str
    value: str
    unit: Optional[str] = None


class CreateAdvertRequest(BaseModel):
    """Запрос на создание объявления."""
    images: List[str]                    # URLs изображений
    features: List[FeatureValue]         # Массив характеристик
    region_id: Optional[str] = "12"      # Регион (по умолчанию Кишинёв)
    phone_number: Optional[str] = None   # Номер телефона
    category_id: Optional[str] = CATEGORY_ID
    subcategory_id: Optional[str] = SUBCATEGORY_ID
    offer_type: Optional[str] = OFFER_TYPE


def format_feature_value(feat: FeatureValue) -> Dict[str, Any]:
    """
    Форматирует значение характеристики для 999.md API.
    
    Некоторые поля требуют специального формата:
    - Цена (id=2): {"id": "2", "value": 16900, "unit": "eur"}
    - Пробег (id=104): {"id": "104", "value": 73000, "unit": "km"}
    - Телефон (id=16): {"id": "16", "value": ["37378000000"]}
    - Заголовок (id=12): {"id": "12", "value": {"ro": "...", "ru": "..."}}
    - Описание (id=13): {"id": "13", "value": {"ro": "...", "ru": "..."}}
    - Чекбоксы: {"id": "908", "value": true}
    """
    feature_id = feat.id
    value = feat.value
    unit = feat.unit
    
    # Заголовок и Описание - требуют объект с языками ro/ru
    if feature_id in ["12", "13"]:
        # Переводим русский текст на румынский
        ro_value = ai_parser_service.translate_russian_to_romanian(value)
        return {
            "id": feature_id,
            "value": {
                "ro": ro_value if ro_value else value,
                "ru": value
            }
        }
    
    # Числовые поля - конвертируем в int
    numeric_fields = ["2", "19", "104", "107", "2513", "2554", "2555"]
    if feature_id in numeric_fields:
        try:
            value = int(value)
        except (ValueError, TypeError):
            pass
    
    # Поля с unit (цена, пробег, мощность и т.д.)
    if unit:
        return {"id": feature_id, "value": value, "unit": unit}
    
    # Телефон - должен быть массивом
    if feature_id == "16":
        if isinstance(value, str):
            # Убираем + и форматируем
            phone = value.replace("+", "").replace(" ", "").replace("-", "")
            return {"id": feature_id, "value": [phone]}
        return {"id": feature_id, "value": value}
    
    # Булевые поля (обмен, торг и т.д.)
    boolean_fields = ["908", "939", "940"]  # обмен, торг, кредит
    if feature_id in boolean_fields:
        bool_value = value.lower() in ["true", "1", "yes", "да"] if isinstance(value, str) else bool(value)
        return {"id": feature_id, "value": bool_value}
    
    # Обычные поля
    return {"id": feature_id, "value": value}


async def upload_image_to_999(image_url: str, api_key: str) -> Optional[str]:
    """
    Загружает одно изображение на 999.md и возвращает его ID/имя.
    
    Args:
        image_url: URL изображения для загрузки
        api_key: API ключ 999.md
        
    Returns:
        Имя загруженного изображения (например: "ba2b163dsteag6f4ecd28dadff121350.jpg?metadata=...")
        или None при ошибке
    """
    try:
        async with httpx.AsyncClient() as client:
            # 1. Скачиваем изображение по URL
            print(f"  📥 Скачиваем: {image_url[:60]}...")
            
            img_response = await client.get(image_url, timeout=30.0, follow_redirects=True)
            if img_response.status_code != 200:
                print(f"  ❌ Не удалось скачать изображение: {img_response.status_code}")
                return None
            
            image_data = img_response.content
            content_type = img_response.headers.get("content-type", "image/jpeg")
            
            # Определяем расширение файла
            if "png" in content_type:
                ext = "png"
            elif "gif" in content_type:
                ext = "gif"
            elif "webp" in content_type:
                ext = "webp"
            else:
                ext = "jpg"
            
            # Генерируем имя файла
            import hashlib
            file_hash = hashlib.md5(image_data).hexdigest()
            filename = f"{file_hash}.{ext}"
            
            # 2. Загружаем на 999.md
            print(f"  📤 Загружаем на 999.md: {filename}")
            
            # Формируем multipart запрос
            files = {
                "file": (filename, image_data, content_type)
            }
            
            upload_response = await client.post(
                f"{NINE_API_URL}/images",
                files=files,
                headers={
                    "Authorization": f"Bearer {api_key}",
                },
                timeout=60.0
            )
            
            print(f"  📨 Ответ загрузки: {upload_response.status_code}")
            
            if upload_response.status_code in [200, 201]:
                result = upload_response.json()
                print(f"  ✅ Загружено: {result}")
                
                # Возвращаем имя/ID изображения из ответа
                # Формат может быть разным, проверяем варианты
                image_id = result.get("filename") or result.get("id") or result.get("name") or result.get("image")
                
                if image_id:
                    return image_id
                    
                # Если в ответе весь объект - возвращаем как есть
                if isinstance(result, str):
                    return result
                    
                print(f"  ⚠️ Неизвестный формат ответа: {result}")
                return None
            else:
                print(f"  ❌ Ошибка загрузки: {upload_response.text}")
                return None
                
    except Exception as e:
        print(f"  ❌ Исключение при загрузке: {str(e)}")
        return None


async def upload_images_to_999(images: List[str], api_key: str) -> List[str]:
    """
    Загружает все изображения на 999.md и возвращает список их ID.
    """
    print(f"\n📷 Загрузка {len(images)} изображений на 999.md...")
    
    uploaded_ids = []
    
    for i, image_url in enumerate(images):
        print(f"\n[{i+1}/{len(images)}] Обработка изображения:")
        image_id = await upload_image_to_999(image_url, api_key)
        
        if image_id:
            uploaded_ids.append(image_id)
        else:
            print(f"  ⚠️ Пропускаем изображение #{i+1}")
    
    print(f"\n✅ Успешно загружено: {len(uploaded_ids)} из {len(images)} изображений")
    return uploaded_ids


def build_999_request(
    request: CreateAdvertRequest, 
    uploaded_image_ids: List[str]
) -> Dict[str, Any]:
    """
    Формирует запрос для 999.md API.
    """
    # Форматируем features
    formatted_features = []
    
    # Добавляем изображения как feature id=14
    if uploaded_image_ids:
        formatted_features.append({
            "id": IMAGES_FEATURE_ID,
            "value": uploaded_image_ids
        })
    
    # Добавляем остальные features
    for feat in request.features:
        if not feat.value or feat.value == "":
            continue
        formatted_features.append(format_feature_value(feat))
    
    # Добавляем регион (id=5)
    if request.region_id:
        formatted_features.append({"id": "5", "value": request.region_id})
    
    # Добавляем телефон если есть (id=16)
    if request.phone_number:
        phone = request.phone_number.replace("+", "").replace(" ", "").replace("-", "")
        formatted_features.append({"id": "16", "value": [phone]})
    
    return {
        "category_id": request.category_id,
        "subcategory_id": request.subcategory_id,
        "offer_type": request.offer_type,
        "state": TYPE_999_ADVERT,  # Скрытое объявление для тестирования
        "features": formatted_features
    }


@router.post("/create-advert")
async def create_advert(request: CreateAdvertRequest) -> Dict[str, Any]:
    """
    Создаёт объявление на 999.md.
    """
    print("=" * 60)
    print("📤 POST /api/create-advert")
    print(f"🖼️  Images: {len(request.images)} шт.")
    print(f"📋 Features: {len(request.features)} шт.")
    print(f"📍 Region: {request.region_id}")
    print("=" * 60)
    
    # Проверяем API ключ
    if not NINE_API_KEY:
        print("❌ NINE_API_KEY не настроен в .env")
        return {
            "success": False,
            "error": "API ключ 999.md не настроен. Добавьте NINE_API_KEY в .env файл.",
            "advert_id": None,
            "url": None
        }
    
    # Загружаем изображения на 999.md
    uploaded_image_ids = []
    if request.images:
        uploaded_image_ids = await upload_images_to_999(request.images, NINE_API_KEY)
        
        if not uploaded_image_ids:
            print("⚠️ Не удалось загрузить ни одного изображения")
    
    # Формируем запрос
    api_request = build_999_request(request, uploaded_image_ids)
    
    print("\n📦 Сформированный запрос для 999.md API:")
    
    print(json.dumps(api_request, indent=2, ensure_ascii=False))
    
    try:
        async with httpx.AsyncClient() as client:
            # Отправляем запрос на создание объявления
            response = await client.post(
                f"{NINE_API_URL}/adverts",
                json=api_request,
                headers={
                    "Authorization": f"Bearer {NINE_API_KEY}",
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                timeout=30.0
            )
            
            print(f"\n📨 Ответ от 999.md API: {response.status_code}")
            
            if response.status_code == 200 or response.status_code == 201:
                result = response.json()
                print(f"✅ Успешно! Response: {json.dumps(result, indent=2, ensure_ascii=False)}")
                
                advert_id = result.get("id") or result.get("advert_id")
                advert_url = result.get("url") or f"https://999.md/ru/{advert_id}"
                
                return {
                    "success": True,
                    "advert_id": str(advert_id),
                    "url": advert_url,
                    "message": "Объявление успешно создано",
                    "uploaded_images": len(uploaded_image_ids),
                    "api_response": result
                }
            else:
                error_text = response.text
                print(f"❌ Ошибка от 999.md API: {error_text}")
                
                return {
                    "success": False,
                    "error": f"Ошибка 999.md API: {response.status_code}",
                    "details": error_text,
                    "advert_id": None,
                    "url": None
                }
                
    except httpx.TimeoutException:
        print("❌ Таймаут при запросе к 999.md API")
        return {
            "success": False,
            "error": "Таймаут при подключении к 999.md API",
            "advert_id": None,
            "url": None
        }
    except Exception as e:
        print(f"❌ Исключение: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "advert_id": None,
            "url": None
        }

