from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional
import os
import requests
from dotenv import load_dotenv
import base64
from ai_parser import ai_parser
import json

# 1. Загрузка конфигов
load_dotenv()
NINE_API_KEY = os.getenv("NINE_API_KEY")

# --- КОНФИГУРАЦИЯ ПОЛЕЙ ---

# Статичные значения по умолчанию: Feature ID -> Default Option ID
STATIC_DEFAULTS = {
    "775": "18592",    # Регистрация -> Республика Молдова
    "593": "18668",    # Состояние -> С пробегом
    "1761": "29670",   # Наличие -> На месте
    "1763": "33044",   # Происхождение автомобиля -> Другое
    "795": "23241",    # Автор объявления -> Автодилер
    "1196": "21978",   # Руль -> Правый
    "846": "19007",    # Количество мест -> 3-4
}

# Динамические поля: Feature ID -> Ключ из AI парсера
DYNAMIC_IDS_MAP = {
    "20": "make",           # Марка
    "21": "model",          # Модель
    "2095": "generation",   # Поколение
    "19": "year",           # Год выпуска
    "2": "price",           # Цена
    "104": "mileage",       # Пробег
    "2553": "engine",       # Двигатель
    "107": "power",         # Мощность
    "151": "fuel_type",     # Тип топлива
    "101": "transmission",  # КПП
    "108": "drive",         # Привод
    "102": "body_type",     # Тип кузова
    "17": "color",          # Цвет
    "851": "doors",         # Количество дверей
    "2512": "vin",          # VIN-код
    "13": "description",    # Описание
    "2513": "range",        # Autonomie (запас хода)
    "2554": "battery",      # Ёмкость батареи
    "2555": "charge_time",  # Быстрая зарядка
}

# Путь к файлу с фичами
FEATURES_FILE_PATH = os.path.join(os.path.dirname(__file__), "feacher_for_post.json")

app = FastAPI()

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ParseRequest(BaseModel):
    text: str

class PostConfigRequest(BaseModel):
    text: Optional[str] = None  # Опциональный текст для AI парсинга


def load_features_json() -> dict:
    """Загружает JSON файл с фичами"""
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
    """Находит опцию по ID в списке опций"""
    if not options:
        return None
    for opt in options:
        if str(opt.get("id")) == str(option_id):
            return {"id": str(opt["id"]), "title": opt.get("title", "")}
    return None


def find_option_by_title(options: list, title: str) -> Optional[dict]:
    """Находит опцию по названию (для AI результатов)"""
    if not options or not title:
        return None
    title_lower = title.lower().strip()
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
    """Обрабатывает одну фичу и возвращает очищенную структуру"""
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


@app.post("/api/post-config")
async def get_post_config(request: PostConfigRequest):
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
            ai_result = ai_parser.parse(request.text, ai_request)
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
    
    # 4. Формируем финальный ответ (только features_groups)
    response = {
        "features_groups": result_groups
    }
    
    print(f"✅ Конфигурация сформирована: {len(result_groups)} групп")
    return JSONResponse(content=response)


@app.post("/api/ai/parse")
async def parse_text(request: ParseRequest):
    print(f"🤖 AI Parsing text: {request.text[:50]}...")
    try:
        result = ai_parser.parse(request.text)
        # Save the result to a JSON file
        with open("response.json", "w", encoding="utf-8") as json_file:
            json.dump(result, json_file, ensure_ascii=False, indent=4)
        return JSONResponse(content=result)
    except Exception as e:
        print(f"❌ AI Error: {str(e)}")
        return JSONResponse(content={"error": str(e)}, status_code=500)

# --- КОНСТАНТЫ 999 ---
CATEGORY_ID = "658"      # Транспорт
DEFAULT_SUBCATEGORY = "659"   # Легковые авто
DEFAULT_OFFER_TYPE = "776"    # Продам
FEATURE_GENERATION_ID = "2095" # Убедись, что эта строка есть

# ID Характеристик
FEATURE_MARKA_ID = "20"   # Марка (Это будет dependency_feature_id)
FEATURE_MODEL_ID = "21"   # Модель

# Хелпер для авторизации
def get_headers():
    if not NINE_API_KEY:
        print("⚠️ Warning: No NINE_API_KEY in .env")
        return {"Accept": "application/json"}
    
    credentials = f"{NINE_API_KEY}:"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json"
    }

# --- 1. ПОЛУЧЕНИЕ МАРОК (MAKES) ---
# Марки - это "Корневая" характеристика, поэтому берем её через общий список /features
@app.get("/api/999/makes")
async def get_makes(subcat: str = DEFAULT_SUBCATEGORY):
    print(f"🔄 Запрос МАРОК (feature_id={FEATURE_MARKA_ID})...")
    
    url = f"https://partners-api.999.md/features?category_id={CATEGORY_ID}&subcategory_id={subcat}&offer_type={DEFAULT_OFFER_TYPE}&lang=ru"
    
    try:
        response = requests.get(url, headers=get_headers())
        if response.status_code != 200:
            print(f"Ошибка 999: {response.text}")
            return JSONResponse(content=[])

        data = response.json()

        # Ищем характеристику "Марка" (ID 20)
        for group in data.get("features_groups", []):
            for feature in group.get("features", []):
                if str(feature["id"]) == FEATURE_MARKA_ID:
                    options = feature.get("options", [])
                    # Сортируем
                    result = sorted(
                        [{"id": str(opt["id"]), "name": opt["title"]} for opt in options],
                        key=lambda x: x["name"]
                    )
                    print(f"✅ Успех: Найдено {len(result)} марок.")
                    return JSONResponse(content=result)
        
        return JSONResponse(content=[])

    except Exception as e:
        print(f"❌ Exception: {str(e)}")
        return JSONResponse(content=[])


# --- 2. ПОЛУЧЕНИЕ МОДЕЛЕЙ (MODELS) ---
# ИСПРАВЛЕНО: Используем /dependent_options как в документации
@app.get("/api/999/models")
async def get_models(
    make_id: str = Query(default=""), 
    subcat: str = DEFAULT_SUBCATEGORY
):
    if not make_id or make_id == "undefined":
        return JSONResponse(content=[])

    print(f"🚀 ЗАПРОС МОДЕЛЕЙ для марки ID: {make_id}...")

    # Правильный эндпоинт из документации
    url = "https://partners-api.999.md/dependent_options"
    
    params = {
        "subcategory_id": subcat,            # 659
        "dependency_feature_id": FEATURE_MARKA_ID, # 20 (От чего зависим? От Марки)
        "parent_option_id": make_id,         # 124 (Какое значение выбрано? BMW)
        "lang": "ru"
    }

    try:
        response = requests.get(url, headers=get_headers(), params=params)
        
        print(f"🔗 Ссылка: {response.url}")
        
        if response.status_code != 200:
            print(f"📦 Ошибка 999: {response.text}")
            return JSONResponse(content=[])

        data = response.json()
        
        options = data.get("Options", [])
        
        if not options:
            print("⚠️ Список моделей пуст.")
            return JSONResponse(content=data)

        result = sorted(
            [{"id": str(opt["id"]), "name": opt.get("title", opt.get("value", "???"))} for opt in options],
            key=lambda x: x["name"]
        )
        print(f"✅ Успех:  {result} модели.")
        print(f"✅ Успех: Найдено {len(result)} моделей.")
        return JSONResponse(content=result)

    except Exception as e:
        print(f"❌ CRITICAL ERROR: {str(e)}")
        return JSONResponse(content=[])


# --- 3. ПОЛУЧЕНИЕ ПОКОЛЕНИЙ (GENERATIONS) ---
@app.get("/api/999/generations")
async def get_generations(
    model_id: str = Query(default=""), 
    subcat: str = DEFAULT_SUBCATEGORY
):
    # 1. Защита от дурака
    if not model_id or model_id == "undefined":
        return JSONResponse(content=[])

    print(f"🚀 ЗАПРОС ПОКОЛЕНИЙ. Родитель (Модель): {FEATURE_MODEL_ID}, Значение ID: {model_id}")

    # 2. URL (Как ты скинул)
    url = "https://partners-api.999.md/dependent_options"
    
    # 3. Параметры (Строго по твоей логике)
    params = {
        "subcategory_id": subcat,            # 659
        "dependency_feature_id": FEATURE_MODEL_ID, # 21 (Это ID характеристики "Модель")
        "parent_option_id": model_id,        # ID конкретной модели (например 1010)
        "lang": "ru"
    }

    try:
        # Шлем запрос с ключом (get_headers)
        response = requests.get(url, headers=get_headers(), params=params)
        
        # Логируем ссылку, чтобы ты мог проверить её в браузере, если что-то пойдет не так
        print(f"🔗 Ссылка: {response.url}")
        
        if response.status_code != 200:
            print(f"📦 Ошибка от 999: {response.text}")
            return JSONResponse(content=[])

        data = response.json()
        print(f"📦 Ответ 999: {data}")
        # 4. Парсинг ответа (Универсальный)
        # Иногда 999 возвращает просто список, иногда { options: [...] }
        options = []
        if isinstance(data, list):
            options = data
        elif isinstance(data, dict):
            options = data.get("Options", [])

        # 5. Форматирование
        result = sorted(
            [{"id": str(opt["id"]), "name": opt.get("title", opt.get("value", "???"))} for opt in options],
            key=lambda x: x["name"]
        )
        
        print(f"✅ Успех: Найдено {len(result)} поколений.")
        return JSONResponse(content=result)

    except Exception as e:
        print(f"❌ Python Error: {str(e)}")
        return JSONResponse(content=[])
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)