import json
import os
import requests
import base64
import re
from typing import List, Dict, Any, Optional
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_openai import ChatOpenAI
from langchain.tools import tool
from langchain.agents import  create_agent
from dotenv import load_dotenv

load_dotenv()

NINE_API_KEY = os.getenv("NINE_API_KEY")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FEATURES_PATH = os.path.join(BASE_DIR, "feacher_for_post.json")

# Load features
try:
    with open(FEATURES_PATH, "r", encoding="utf-8") as f:
        FEATURES_DATA = json.load(f)
except Exception as e:
    print(f"Error loading features: {e}")
    FEATURES_DATA = {"features_groups": []}

# Flatten features for quick access
FLATTENED_FEATURES: Dict[str, Dict] = {}
for group in FEATURES_DATA.get("features_groups", []):
    for feature in group.get("features", []):
        FLATTENED_FEATURES[str(feature["id"])] = feature


def get_headers():
    """Получить заголовки для API 999.md"""
    if not NINE_API_KEY:
        return {"Accept": "application/json"}
    credentials = f"{NINE_API_KEY}:"
    encoded = base64.b64encode(credentials.encode()).decode()
    return {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json"
    }


# ==================== TOOLS ====================

@tool
def get_all_features_list() -> str:
    """
    Возвращает список всех доступных характеристик с их ID, названиями и типами.
    Используй для понимания какие характеристики нужно заполнить.
    """
    result = []
    for fid, f in FLATTENED_FEATURES.items():
        info = f"ID: {fid}, Название: {f['title']}, Тип: {f['type']}, Обязательное: {f.get('required', False)}"
        if f.get("depends_on"):
            info += f", Зависит от: {f['depends_on']}"
        if f.get("default_value"):
            info += f", Есть значение по умолчанию"
        result.append(info)
    return "\n".join(result)


@tool
def find_make_option(make_name: str) -> str:
    """
    Ищет марку автомобиля по названию и возвращает её ID.
    Пример: find_make_option("BMW") -> "34"
    make_name: Название марки (например: BMW, Mercedes, Toyota, Volkswagen)
    """
    feature = FLATTENED_FEATURES.get("20")  # Марка
    if not feature or not feature.get("options"):
        return "Ошибка: характеристика Марка не найдена"
    
    query = make_name.lower().strip()
    
    # Точное совпадение
    for opt in feature["options"]:
        if opt["title"].lower() == query:
            return json.dumps({"id": "20", "value": str(opt["id"]), "title": opt["title"]})
    
    # Частичное совпадение
    for opt in feature["options"]:
        if query in opt["title"].lower() or opt["title"].lower() in query:
            return json.dumps({"id": "20", "value": str(opt["id"]), "title": opt["title"]})
    
    # Показать похожие
    similar = [opt["title"] for opt in feature["options"] if query[:3] in opt["title"].lower()][:5]
    return f"Марка '{make_name}' не найдена. Похожие: {similar}"


@tool
def find_model_option(make_option_id: str, model_name: str) -> str:
    """
    Ищет модель автомобиля по названию для указанной марки через API 999.md.
    make_option_id: ID опции марки (например "34" для BMW)
    model_name: Название модели (например "X5", "Corolla", "Golf")
    """
    url = "https://partners-api.999.md/dependent_options"
    params = {
        "subcategory_id": "659",
        "dependency_feature_id": "20",  # Зависимость от Марки
        "parent_option_id": make_option_id,
        "lang": "ru"
    }
    
    try:
        response = requests.get(url, headers=get_headers(), params=params)
        if response.status_code != 200:
            return f"Ошибка API: {response.text}"
        
        data = response.json()
        options = data if isinstance(data, list) else data.get("Options", [])
        
        if not options:
            return "Модели не найдены для этой марки"
        
        query = model_name.lower().strip()
        
        # Точное совпадение
        for opt in options:
            title = opt.get("title", opt.get("value", ""))
            if title.lower() == query:
                return json.dumps({"id": "21", "value": str(opt["id"]), "title": title})
        
        # Частичное совпадение
        for opt in options:
            title = opt.get("title", opt.get("value", ""))
            if query in title.lower() or title.lower() in query:
                return json.dumps({"id": "21", "value": str(opt["id"]), "title": title})
        
        # Показать доступные
        available = [opt.get("title", opt.get("value", "???")) for opt in options[:10]]
        return f"Модель '{model_name}' не найдена. Доступные: {available}"
        
    except Exception as e:
        return f"Ошибка: {str(e)}"


@tool
def find_generation_option(model_option_id: str, generation_text: str) -> str:
    """
    Ищет поколение автомобиля для указанной модели через API 999.md.
    model_option_id: ID опции модели (например "1010" для X5)
    generation_text: Текст поколения или годы (например "2019-2023", "E70", "II рестайлинг")
    """
    url = "https://partners-api.999.md/dependent_options"
    params = {
        "subcategory_id": "659",
        "dependency_feature_id": "21",  # Зависимость от Модели
        "parent_option_id": model_option_id,
        "lang": "ru"
    }
    
    try:
        response = requests.get(url, headers=get_headers(), params=params)
        if response.status_code != 200:
            return f"Ошибка API: {response.text}"
        
        data = response.json()
        options = data if isinstance(data, list) else data.get("Options", [])
        
        if not options:
            return "Поколения не найдены для этой модели"
        
        query = generation_text.lower().strip()
        
        # Поиск по году или тексту
        for opt in options:
            title = opt.get("title", opt.get("value", ""))
            if query in title.lower():
                return json.dumps({"id": "2095", "value": str(opt["id"]), "title": title})
        
        # Если есть только одно поколение - вернуть его
        if len(options) == 1:
            opt = options[0]
            title = opt.get("title", opt.get("value", ""))
            return json.dumps({"id": "2095", "value": str(opt["id"]), "title": title})
        
        # Показать доступные
        available = [opt.get("title", opt.get("value", "???")) for opt in options]
        return f"Поколение не найдено. Доступные: {available}"
        
    except Exception as e:
        return f"Ошибка: {str(e)}"


@tool
def find_dropdown_option(feature_id: str, search_text: str) -> str:
    """
    Ищет значение в выпадающем списке характеристики.
    feature_id: ID характеристики (например "151" для Типа топлива, "101" для КПП)
    search_text: Текст для поиска (например "дизель", "автомат", "седан")
    
    Используй для: Регистрация(775), Состояние(593), Наличие(1761), Происхождение(1763),
    Автор(795), Руль(1196), Места(846), Кузов(102), Двери(851), Двигатель(2553),
    Топливо(151), КПП(101), Привод(108), Цвет(17)
    """
    feature = FLATTENED_FEATURES.get(str(feature_id))
    if not feature:
        return f"Характеристика с ID {feature_id} не найдена"
    
    options = feature.get("options", [])
    if not options:
        return f"У характеристики '{feature['title']}' нет опций"
    
    query = search_text.lower().strip()
    
    # Точное совпадение
    for opt in options:
        if opt["title"].lower() == query:
            return json.dumps({"id": str(feature_id), "value": str(opt["id"]), "title": opt["title"]})
    
    # Частичное совпадение
    for opt in options:
        if query in opt["title"].lower() or opt["title"].lower() in query:
            return json.dumps({"id": str(feature_id), "value": str(opt["id"]), "title": opt["title"]})
    
    # Показать доступные
    available = [opt["title"] for opt in options]
    return f"Значение '{search_text}' не найдено в '{feature['title']}'. Доступные: {available}"


@tool
def get_feature_default_value(feature_id: str) -> str:
    """
    Возвращает значение по умолчанию для характеристики, если оно есть.
    feature_id: ID характеристики
    """
    feature = FLATTENED_FEATURES.get(str(feature_id))
    if not feature:
        return f"Характеристика с ID {feature_id} не найдена"
    
    default = feature.get("default_value")
    if not default:
        return f"У характеристики '{feature['title']}' нет значения по умолчанию"
    
    if "options" in default:
        opt = default["options"]
        return json.dumps({"id": str(feature_id), "value": str(opt["id"]), "title": opt["title"]})
    
    return json.dumps(default)


@tool
def create_numeric_feature(feature_id: str, value: float, unit: str = None) -> str:
    """
    Создает числовую характеристику.
    feature_id: ID характеристики
    value: Числовое значение
    unit: Единица измерения (eur/usd/mdl для цены, km/mi для пробега, hp для мощности)
    
    Используй для: Цена(2), Год(19), Пробег(104), Мощность(107), Autonomie(2513), 
    Ёмкость батареи(2554), Быстрая зарядка(2555)
    """
    feature = FLATTENED_FEATURES.get(str(feature_id))
    if not feature:
        return f"Характеристика с ID {feature_id} не найдена"
    
    result = {"id": str(feature_id), "value": value}
    
    if unit and feature.get("units"):
        if unit.lower() in [u.lower() for u in feature["units"]]:
            result["unit"] = unit.lower()
        else:
            result["unit"] = feature["units"][0]  # Первая единица по умолчанию
    elif feature.get("units"):
        result["unit"] = feature["units"][0]
    
    return json.dumps(result)


@tool
def create_text_feature(feature_id: str, text: str) -> str:
    """
    Создает текстовую характеристику.
    feature_id: ID характеристики
    text: Текстовое значение
    
    Используй для: VIN-код(2512), Описание(13), Теги(1404)
    """
    feature = FLATTENED_FEATURES.get(str(feature_id))
    if not feature:
        return f"Характеристика с ID {feature_id} не найдена"
    
    return json.dumps({"id": str(feature_id), "value": text})


@tool  
def get_feature_info_by_name(feature_name: str) -> str:
    """
    Находит характеристику по названию и возвращает её детали.
    feature_name: Название на русском (например: "Марка", "Пробег", "Цвет")
    """
    query = feature_name.lower().strip()
    
    for fid, f in FLATTENED_FEATURES.items():
        if query in f["title"].lower():
            info = {
                "id": fid,
                "title": f["title"],
                "type": f["type"],
                "required": f.get("required", False),
                "depends_on": f.get("depends_on"),
                "has_default": "default_value" in f,
                "units": f.get("units")
            }
            if f.get("options") and len(f["options"]) <= 20:
                info["options"] = [{"id": o["id"], "title": o["title"]} for o in f["options"]]
            elif f.get("options"):
                info["options_count"] = len(f["options"])
            return json.dumps(info, ensure_ascii=False)
    
    return f"Характеристика '{feature_name}' не найдена"


# ==================== AGENT ====================

class AIParserAgent:
    def __init__(self):
        self.llm = ChatOpenAI(model="gpt-4o", temperature=0, api_key=os.getenv("OPENAI_API_KEY"))
        
        # Create agent directly with create_agent
        self.agent = create_agent(
            model=self.llm,
            tools=[
                get_all_features_list,
                find_make_option,
                find_model_option,
                find_generation_option,
                find_dropdown_option,
                get_feature_default_value,
                create_numeric_feature,
                create_text_feature,
                get_feature_info_by_name
            ],
            system_prompt="""Ты эксперт по парсингу объявлений автомобилей для сайта 999.md.

Твоя задача: проанализировать текст объявления и извлечь структурированные данные.

ВАЖНЫЕ ID ХАРАКТЕРИСТИК:
- 20: Марка (обязательно)
- 21: Модель (обязательно, зависит от марки)
- 2095: Поколение (обязательно, зависит от модели)
- 2: Цена (обязательно, unit: eur/usd/mdl)
- 19: Год выпуска (обязательно)
- 104: Пробег (обязательно, unit: km/mi)
- 151: Тип топлива (обязательно)
- 101: КПП (обязательно)
- 108: Привод (обязательно)
- 102: Тип кузова (обязательно)
- 2553: Двигатель/объем (обязательно)
- 775: Регистрация (есть default)
- 593: Состояние (есть default)
- 1761: Наличие (есть default)
- 1763: Происхождение (есть default)
- 795: Автор (есть default)
- 1196: Руль (есть default)
- 846: Количество мест (есть default)
- 17: Цвет (опционально)
- 851: Количество дверей (опционально)
- 107: Мощность (опционально, unit: hp)
- 2512: VIN-код (опционально)
- 13: Описание (опционально)

ПРОЦЕСС:
1. Найди марку через find_make_option
2. Используя ID марки, найди модель через find_model_option  
3. Используя ID модели, найди поколение через find_generation_option (передай год если есть)
4. Заполни числовые поля через create_numeric_feature (цена, год, пробег, мощность)
5. Заполни dropdown поля через find_dropdown_option (топливо, КПП, привод, кузов, цвет)
6. Для полей с default_value - если значение не найдено в тексте, используй get_feature_default_value
7. Текстовые поля через create_text_feature (VIN, описание)

ФОРМАТ ОТВЕТА - только JSON массив:
[
  {"id": "20", "value": "34"},
  {"id": "21", "value": "1010"},
  {"id": "2", "value": 15000, "unit": "eur"},
  ...
]

НЕ добавляй характеристику если:
- Нет данных в тексте И нет default_value
- Не смог найти подходящее значение

ОБЯЗАТЕЛЬНО добавляй default_value для характеристик у которых оно есть, даже если в тексте нет данных."""
        )

    def parse(self, text: str) -> Dict[str, Any]:
        """Распарси текст объявления и верни структурированный JSON."""
        try:
            # Вызови agent
            result = self.agent.invoke({
                "messages": [{
                    "role": "user",
                    "content": f"Распарси это объявление и верни ТОЛЬКО JSON массив характеристик (ничего больше):\n\n{text}"
                }]
            })
            
            # Извлеки последнее сообщение ИИ из истории
            output = ""
            if isinstance(result, dict) and "messages" in result:
                # Массив сообщений - бери последнее AIMessage
                messages = result["messages"]
                for msg in reversed(messages):  # Ищи с конца
                    if hasattr(msg, 'content') and msg.content:
                        output = msg.content
                        break
            elif isinstance(result, dict) and "output" in result:
                output = result["output"]
            else:
                output = str(result)
            
            print(f"🔍 Extracted output: {output[:100]}...")  # Дебаг
            
            # Очисти от markdown
            if "```json" in output:
                output = output.split("```json")[1].split("```")[0].strip()
            elif "```" in output:
                output = output.split("```")[1].split("```")[0].strip()
            
            print(f"🔍 Cleaned output: {output[:100]}...")  # Дебаг
            
            # Найди JSON массив
            json_match = re.search(r'\[[\s\S]*\]', output)
            if json_match:
                output = json_match.group()
            
            print(f"🔍 Final JSON: {output[:100]}...")  # Дебаг
            
            # Распарси JSON
            features_list = json.loads(output)
            
            # Очисти features - оставь только id, value, unit
            clean_features = []
            for f in features_list:
                clean_f = {"id": str(f["id"]), "value": f["value"]}
                if "unit" in f:
                    clean_f["unit"] = f["unit"]
                clean_features.append(clean_f)
            
            return {
                "category_id": "658",
                "subcategory_id": "659",
                "offer_type": "776",
                "features": clean_features
            }
            
        except json.JSONDecodeError as e:
            print(f"❌ JSON Parsing Error: {e}")
            print(f"❌ Output was: {output}")
            return {
                "category_id": "658",
                "subcategory_id": "659",
                "offer_type": "776",
                "features": [],
                "error": f"JSON parsing failed: {str(e)}"
            }
        except Exception as e:
            print(f"❌ AI Parsing failed: {e}")
            import traceback
            traceback.print_exc()
            return {
                "category_id": "658",
                "subcategory_id": "659",
                "offer_type": "776",
                "features": [],
                "error": str(e)
            }

# Singleton instance
ai_parser = AIParserAgent()
