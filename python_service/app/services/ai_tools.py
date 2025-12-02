"""
AI Tools - Инструменты для работы с данными авто.

Этот модуль предоставляет удобные функции-обёртки для использования
в качестве инструментов AI-агентов или API endpoints.
"""
from typing import List, Dict, Any, Optional
from app.services.nine_api import nine_service


def search_car_generations(
    model_id: str,
    subcat: Optional[str] = None
) -> Dict[str, Any]:
    """
    Инструмент для поиска поколений автомобиля по ID модели.
    
    Используется для получения списка доступных поколений (generations)
    конкретной модели автомобиля из базы 999.md.
    
    Args:
        model_id (str): ID модели автомобиля (обязательный параметр).
                      
    
    Returns:
        Dict[str, Any]: Словарь с результатом:
            - success (bool): Успешность запроса
            - data (list): Список поколений [{"id": "...", "name": "..."}]
            - count (int): Количество найденных поколений
            - error (str, optional): Сообщение об ошибке (если есть)
    
    Примеры использования:

    """
    # Валидация входных данных
    if not model_id or model_id == "undefined":
        return {
            "success": False,
            "data": [],
            "count": 0,
            "error": "model_id обязателен и не может быть пустым или 'undefined'"
        }
    
    try:
        # Вызов основной функции
        if subcat:
            generations = nine_service.get_generations(model_id=model_id, subcat=subcat)
        else:
            generations = nine_service.get_generations(model_id=model_id)
        
        return {
            "success": True,
            "data": generations,
            "count": len(generations),
            "model_id": model_id
        }
    
    except Exception as e:
        return {
            "success": False,
            "data": [],
            "count": 0,
            "error": str(e)
        }


# Описание инструмента для AI-агентов (OpenAI function calling format)
