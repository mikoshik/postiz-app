"""
Вспомогательные функции для работы с API.
"""
import base64
from app.config.settings import NINE_API_KEY


def get_api_headers() -> dict:
    """
    Получить заголовки для авторизации в API 999.md.
    
    Returns:
        Словарь с заголовками для HTTP запросов
    """
    if not NINE_API_KEY:
        print("⚠️ Warning: No NINE_API_KEY в .env")
        return {"Accept": "application/json"}
    
    credentials = f"{NINE_API_KEY}:"
    encoded = base64.b64encode(credentials.encode()).decode()
    
    return {
        "Authorization": f"Basic {encoded}",
        "Accept": "application/json"
    }
