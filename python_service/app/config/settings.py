"""
Конфигурация приложения.
Загрузка переменных окружения и константы.
"""
import os
from dotenv import load_dotenv

# Загружаем .env файл
load_dotenv()

# API ключи
NINE_API_KEY = os.getenv("NINE_API_KEY")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Константы 999.md API
CATEGORY_ID = "658"           # Транспорт
DEFAULT_SUBCATEGORY = "659"   # Легковые авто
DEFAULT_OFFER_TYPE = "776"    # Продам

# ID характеристик
FEATURE_MARKA_ID = "20"       # Марка
FEATURE_MODEL_ID = "21"       # Модель
FEATURE_GENERATION_ID = "2095" # Поколение

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

# CORS настройки
CORS_ORIGINS = [
    "http://localhost:4200",
    "http://localhost:3000",
]

# Путь к файлам данных
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_FILE_PATH = os.path.join(BASE_DIR, "data", "feacher_for_post.json")
