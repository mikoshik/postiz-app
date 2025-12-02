"""
API роутер для работы с 999.md.
"""
from fastapi import APIRouter, Query
from fastapi.responses import JSONResponse

from app.config.settings import DEFAULT_SUBCATEGORY
from app.services.nine_api import nine_service

router = APIRouter(prefix="/api/999", tags=["999.md"])


@router.get("/makes")
async def get_makes(subcat: str = DEFAULT_SUBCATEGORY):
    """
    Получить список марок автомобилей.
    
    Args:
        subcat: ID подкатегории (по умолчанию 659 - Легковые авто)
    """
    result = nine_service.get_makes(subcat)
    return JSONResponse(content=result)


@router.get("/models")
async def get_models(
    make_id: str = Query(default=""),
    subcat: str = DEFAULT_SUBCATEGORY
):
    """
    Получить список моделей для выбранной марки.
    
    Args:
        make_id: ID марки автомобиля
        subcat: ID подкатегории
    """
    result = nine_service.get_models(make_id, subcat)
    return JSONResponse(content=result)


@router.get("/generations")
async def get_generations(
    model_id: str = Query(default=""),
    subcat: str = DEFAULT_SUBCATEGORY
):
    """
    Получить список поколений для выбранной модели.
    
    Args:
        model_id: ID модели автомобиля
        subcat: ID подкатегории
    """
    result = nine_service.get_generations(model_id, subcat)
    return JSONResponse(content=result)
