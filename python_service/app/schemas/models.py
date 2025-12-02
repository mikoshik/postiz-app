"""
Pydantic схемы для валидации данных.
"""
from pydantic import BaseModel
from typing import Optional, List, Union


class ParseRequest(BaseModel):
    """Запрос на AI парсинг текста."""
    text: str


class PostConfigRequest(BaseModel):
    """Запрос на получение конфигурации поста."""
    text: Optional[str] = None


class FeatureOption(BaseModel):
    """Опция характеристики."""
    id: str
    title: str


class ProcessedFeature(BaseModel):
    """Обработанная характеристика."""
    id: str
    title: str
    type: str
    required: bool = False
    label: str = ""
    label_id: str = ""
    options: Optional[List[FeatureOption]] = None
    units: Optional[Union[str, List[str]]] = None


class FeatureGroup(BaseModel):
    """Группа характеристик."""
    title: str
    features: List[ProcessedFeature]


class PostConfigResponse(BaseModel):
    """Ответ с конфигурацией поста."""
    features_groups: List[FeatureGroup]


class MakeModel(BaseModel):
    """Марка/модель автомобиля."""
    id: str
    name: str
