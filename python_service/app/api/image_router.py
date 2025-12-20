"""
Роутер для конвертации изображений (HEIC -> JPG/PNG).
"""
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response
from io import BytesIO
import pillow_heif
from PIL import Image

# Регистрируем HEIF плагин для Pillow
pillow_heif.register_heif_opener()

router = APIRouter(prefix="/image", tags=["Image Processing"])


@router.post("/convert-heic")
async def convert_heic_to_jpeg(
    file: UploadFile = File(...),
    quality: int = 90,
    output_format: str = "JPEG"
):
    """
    Конвертирует HEIC/HEIF изображение в JPEG или PNG.
    
    Args:
        file: HEIC/HEIF файл для конвертации
        quality: Качество выходного изображения (1-100, по умолчанию 90)
        output_format: Формат выхода - JPEG или PNG (по умолчанию JPEG)
    
    Returns:
        Конвертированное изображение в формате JPEG или PNG
    """
    # Проверяем формат файла
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    filename_lower = file.filename.lower()
    if not (filename_lower.endswith('.heic') or filename_lower.endswith('.heif')):
        raise HTTPException(
            status_code=400, 
            detail="File must be HEIC or HEIF format"
        )
    
    # Проверяем параметры
    if quality < 1 or quality > 100:
        raise HTTPException(status_code=400, detail="Quality must be between 1 and 100")
    
    output_format = output_format.upper()
    if output_format not in ["JPEG", "PNG"]:
        raise HTTPException(status_code=400, detail="Output format must be JPEG or PNG")
    
    try:
        # Читаем файл
        contents = await file.read()
        
        # Открываем HEIC изображение с помощью Pillow (pillow-heif зарегистрирован)
        image = Image.open(BytesIO(contents))
        
        # Конвертируем в RGB если нужно (для JPEG)
        if output_format == "JPEG" and image.mode in ("RGBA", "P"):
            image = image.convert("RGB")
        
        # Сохраняем в нужном формате
        output_buffer = BytesIO()
        
        if output_format == "JPEG":
            image.save(output_buffer, format="JPEG", quality=quality, optimize=True)
            media_type = "image/jpeg"
            extension = "jpg"
        else:
            image.save(output_buffer, format="PNG", optimize=True)
            media_type = "image/png"
            extension = "png"
        
        output_buffer.seek(0)
        
        # Генерируем новое имя файла
        new_filename = file.filename.rsplit('.', 1)[0] + f'.{extension}'
        
        return Response(
            content=output_buffer.getvalue(),
            media_type=media_type,
            headers={
                "Content-Disposition": f'attachment; filename="{new_filename}"',
                "X-Original-Filename": file.filename,
                "X-Converted-Filename": new_filename
            }
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to convert image: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Проверка работоспособности сервиса конвертации."""
    return {
        "status": "ok",
        "service": "heic-converter",
        "supported_formats": ["HEIC", "HEIF"],
        "output_formats": ["JPEG", "PNG"]
    }
