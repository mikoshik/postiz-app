"""
Postiz Python Service - FastAPI приложение.
"""
import traceback
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config.settings import CORS_ORIGINS
from app.api.nine_router import router as nine_router
from app.api.posts_router import router as posts_router
from app.api.adverb_post import router as advert_router


def create_app() -> FastAPI:
    """
    Фабрика для создания FastAPI приложения.
    
    Returns:
        Настроенное FastAPI приложение
    """
    app = FastAPI(
        title="Postiz Python Service",
        description="API для AI парсинга и работы с данными авто",
        version="1.0.0"
    )

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Глобальный обработчик ошибок - показывает ВСЕ ошибки
    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        error_detail = {
            "error": str(exc),
            "type": type(exc).__name__,
            "path": str(request.url),
            "traceback": traceback.format_exc()
        }
        print(f"❌ GLOBAL ERROR: {error_detail}")
        return JSONResponse(
            status_code=500,
            content=error_detail
        )

    # Регистрация роутеров
    app.include_router(nine_router)
    app.include_router(posts_router)
    app.include_router(advert_router)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    @app.get("/")
    async def root():
        return {"message": "Postiz Python Service", "docs": "/docs"}

    return app


# Создаём экземпляр приложения
app = create_app()
