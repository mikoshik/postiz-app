"""
Сервис для работы с 999.md API.
"""
import requests
from typing import List, Dict, Any

from app.config.settings import (
    CATEGORY_ID,
    DEFAULT_SUBCATEGORY,
    DEFAULT_OFFER_TYPE,
    FEATURE_MARKA_ID,
    FEATURE_MODEL_ID,
)
from app.utils.api_helpers import get_api_headers


class NineService:
    """Сервис для работы с API 999.md."""
    
    BASE_URL = "https://partners-api.999.md"
    
    def get_makes(self, subcat: str = DEFAULT_SUBCATEGORY) -> List[Dict[str, str]]:
        """
        Получает список марок автомобилей.
        
        Args:
            subcat: ID подкатегории
            
        Returns:
            Список марок [{"id": "...", "name": "..."}]
        """
        print(f"🔄 Запрос МАРОК (feature_id={FEATURE_MARKA_ID})...")
        
        url = f"{self.BASE_URL}/features"
        params = {
            "category_id": CATEGORY_ID,
            "subcategory_id": subcat,
            "offer_type": DEFAULT_OFFER_TYPE,
            "lang": "ru"
        }
        
        try:
            response = requests.get(url, headers=get_api_headers(), params=params)
            
            if response.status_code != 200:
                print(f"Ошибка 999: {response.text}")
                return []

            data = response.json()

            # Ищем характеристику "Марка" (ID 20)
            for group in data.get("features_groups", []):
                for feature in group.get("features", []):
                    if str(feature["id"]) == FEATURE_MARKA_ID:
                        options = feature.get("options", [])
                        result = sorted(
                            [{"id": str(opt["id"]), "name": opt["title"]} for opt in options],
                            key=lambda x: x["name"]
                        )
                        print(f"✅ Успех: Найдено {len(result)} марок.")
                        return result
            
            return []

        except Exception as e:
            print(f"❌ Exception: {str(e)}")
            return []

    def get_models(self, make_id: str, subcat: str = DEFAULT_SUBCATEGORY) -> List[Dict[str, str]]:
        """
        Получает список моделей для выбранной марки.
        
        Args:
            make_id: ID марки
            subcat: ID подкатегории
            
        Returns:
            Список моделей [{"id": "...", "name": "..."}]
        """
        if not make_id or make_id == "undefined":
            return []

        print(f"🚀 ЗАПРОС МОДЕЛЕЙ для марки ID: {make_id}...")

        url = f"{self.BASE_URL}/dependent_options"
        params = {
            "subcategory_id": subcat,
            "dependency_feature_id": FEATURE_MARKA_ID,
            "parent_option_id": make_id,
            "lang": "ru"
        }

        try:
            response = requests.get(url, headers=get_api_headers(), params=params)
            
            print(f"🔗 Ссылка: {response.url}")
            
            if response.status_code != 200:
                print(f"📦 Ошибка 999: {response.text}")
                return []

            data = response.json()
            options = data.get("Options", [])
            
            if not options:
                print("⚠️ Список моделей пуст.")
                return data

            result = sorted(
                [{"id": str(opt["id"]), "name": opt.get("title", opt.get("value", "???"))} for opt in options],
                key=lambda x: x["name"]
            )
            print(f"✅ Успех: Найдено {len(result)} моделей.")
            return result

        except Exception as e:
            print(f"❌ CRITICAL ERROR: {str(e)}")
            return []

    def get_generations(self, model_id: str, subcat: str = DEFAULT_SUBCATEGORY) -> List[Dict[str, str]]:
        """
        Получает список поколений для выбранной модели.
        
        Args:
            model_id: ID модели
            subcat: ID подкатегории
            
        Returns:
            Список поколений [{"id": "...", "name": "..."}]
        """
        if not model_id or model_id == "undefined":
            return []

        print(f"🚀 ЗАПРОС ПОКОЛЕНИЙ. Родитель (Модель): {FEATURE_MODEL_ID}, Значение ID: {model_id}")

        url = f"{self.BASE_URL}/dependent_options"
        params = {
            "subcategory_id": subcat,
            "dependency_feature_id": FEATURE_MODEL_ID,
            "parent_option_id": model_id,
            "lang": "ru"
        }

        try:
            response = requests.get(url, headers=get_api_headers(), params=params)
            
            print(f"🔗 Ссылка: {response.url}")
            
            if response.status_code != 200:
                print(f"📦 Ошибка от 999: {response.text}")
                return []

            data = response.json()
            print(f"📦 Ответ 999: {data}")

            # Парсинг ответа (Универсальный)
            options = []
            if isinstance(data, list):
                options = data
            elif isinstance(data, dict):
                options = data.get("Options", [])

            result = sorted(
                [{"id": str(opt["id"]), "name": opt.get("title", opt.get("value", "???"))} for opt in options],
                key=lambda x: x["name"]
            )
            
            print(f"✅ Успех: Найдено {len(result)} поколений.")
            return result

        except Exception as e:
            print(f"❌ Python Error: {str(e)}")
            return []


# Singleton instance
nine_service = NineService()
