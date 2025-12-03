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

# Зависимые поля (требуют вызова API для получения options)
DEPENDENT_FIELDS = {
    "21": "20",      # Модель зависит от Марки
    "2095": "21",    # Поколение зависит от Модели
}

# Статичные значения по умолчанию: Feature ID -> Default Option ID
STATIC_DEFAULTS = {
    "775": "18592",    # Регистрация -> Республика Молдова
    "593": "18668",    # Состояние -> С пробегом
    "1761": "29670",   # Наличие -> На месте
    "1763": "33044",   # Происхождение автомобиля -> Другое
    "795": "23241",    # Автор объявления -> Автодилер
    "1196": "21978",   # Руль -> Правый
    "846": "19119",    # Количество мест -> 5
    "851": "19085",         # Количество дверей

}

# Динамические поля: Feature ID -> Ключ из AI парсера
DYNAMIC_IDS_MAP = {
    "make": "20",           # Марка
    "model": "21",          # Модель
    "year": "19",           # Год выпуска
    "vin": "2512",          # VIN-код
    "price": "2",           # Цена
    "mileage": "104",       # Пробег
    "engine": "2553",       # Двигатель
    "power": "107",         # Мощность
    "fuel_type": "151",     # Тип топлива
    "transmission": "101",  # КПП
    "drive": "108",         # Привод
    "body_type": "102",     # Тип кузова
    "color": "17",          # Цвет
    "description": "13",    # Описание
    "range": "2513",        # Autonomie (запас хода)
    "battery": "2554",      # Ёмкость батареи
    "charge_time": "2555",  # Быстрая зарядка
    "title": "12",          # Заголовок объявления
    "generation": "2095",   # Поколение
}

# CORS настройки
CORS_ORIGINS = [
    "http://localhost:4200",
    "http://localhost:3000",
]

# Путь к файлам данных
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
FEATURES_FILE_PATH = os.path.join(BASE_DIR, "data", "feacher_for_post.json")
