from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import os
import requests
from dotenv import load_dotenv
import base64

# 1. Загрузка конфигов
load_dotenv()
NINE_API_KEY = os.getenv("NINE_API_KEY")

app = FastAPI()

# 2. CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:4200", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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