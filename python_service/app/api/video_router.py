"""
Роутер для конвертации видео (MOV -> MP4 и другие форматы).
"""
import subprocess
import tempfile
import os
import json
import re
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/video", tags=["Video Processing"])

# Максимальное разрешение видео
MAX_WIDTH = 1920
MAX_HEIGHT = 1080


async def get_video_resolution(input_path: str) -> tuple[int, int]:
    """
    Получает разрешение видео с помощью FFprobe.
    
    Args:
        input_path: Путь к видео файлу
    
    Returns:
        Кортеж (ширина, высота) в пикселях
    
    Raises:
        HTTPException: Если не удалось получить информацию о видео
    """
    try:
        cmd = [
            'ffprobe',
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height',
            '-of', 'json',
            input_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode != 0:
            raise HTTPException(
                status_code=500,
                detail="Failed to get video resolution"
            )
        
        data = json.loads(result.stdout)
        if data.get('streams') and len(data['streams']) > 0:
            stream = data['streams'][0]
            width = stream.get('width', 0)
            height = stream.get('height', 0)
            
            if width > 0 and height > 0:
                return (width, height)
        
        raise HTTPException(
            status_code=500,
            detail="Could not determine video resolution"
        )
        
    except json.JSONDecodeError:
        raise HTTPException(
            status_code=500,
            detail="Failed to parse video resolution"
        )


async def calculate_scaled_resolution(width: int, height: int) -> tuple[int, int]:
    """
    Вычисляет новое разрешение для масштабирования видео.
    Если видео больше MAX_WIDTH x MAX_HEIGHT, масштабируем пропорционально.
    Если меньше, оставляем как есть.
    
    Args:
        width: Текущая ширина видео
        height: Текущая высота видео
    
    Returns:
        Кортеж (новая_ширина, новая_высота). Оба значения чётные для совместимости с кодеком.
    """
    # Если разрешение уже в пределах нормы
    if width <= MAX_WIDTH and height <= MAX_HEIGHT:
        return (width, height)
    
    # Вычисляем коэффициент масштабирования
    scale_w = MAX_WIDTH / width
    scale_h = MAX_HEIGHT / height
    scale = min(scale_w, scale_h)  # Используем меньший масштаб для сохранения пропорций
    
    new_width = int(width * scale)
    new_height = int(height * scale)
    
    # Убедимся, что оба значения чётные (требование для видео кодеков)
    new_width = new_width if new_width % 2 == 0 else new_width - 1
    new_height = new_height if new_height % 2 == 0 else new_height - 1
    
    return (new_width, new_height)


async def trim_video_to_60_seconds(input_path: str, output_path: str) -> None:
    """
    Обрезает видео до 60 секунд с помощью FFmpeg.
    
    Args:
        input_path: Путь к исходному видео файлу
        output_path: Путь к обрезанному видео файлу
    
    Raises:
        HTTPException: Если обрезка не удалась
    """
    cmd = [
        'ffmpeg',
        '-i', input_path,          # input file
        '-t', '60',                # trim to 60 seconds
        '-c', 'copy',              # copy without re-encoding (fast)
        '-y',                      # overwrite output
        output_path
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=120  # 2 minutes timeout for trimming
    )
    
    if result.returncode != 0:
        error_msg = result.stderr or "Unknown FFmpeg error"
        raise HTTPException(
            status_code=500,
            detail=f"Video trimming failed: {error_msg}"
        )


async def scale_video_resolution(
    input_path: str, 
    output_path: str, 
    target_width: int, 
    target_height: int
) -> None:
    """
    Масштабирует разрешение видео до целевого размера.
    
    Args:
        input_path: Путь к исходному видео файлу
        output_path: Путь к видео с изменённым разрешением
        target_width: Целевая ширина
        target_height: Целевая высота
    
    Raises:
        HTTPException: Если масштабирование не удалось
    """
    # FFmpeg scale фильтр с -1 для сохранения пропорций
    scale_filter = f'scale={target_width}:{target_height}'
    
    cmd = [
        'ffmpeg',
        '-i', input_path,
        '-vf', scale_filter,       # apply scale filter
        '-c:v', 'libx264',         # video codec
        '-c:a', 'aac',             # audio codec
        '-b:a', '128k',            # audio bitrate
        '-movflags', 'faststart',
        '-y',
        output_path
    ]
    
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        timeout=300
    )
    
    if result.returncode != 0:
        error_msg = result.stderr or "Unknown FFmpeg error"
        raise HTTPException(
            status_code=500,
            detail=f"Video scaling failed: {error_msg}"
        )


@router.post("/convert-to-mp4")
async def convert_video_to_mp4(
    file: UploadFile = File(...),
    quality: str = "medium"
):
    """
    Конвертирует видео (MOV, AVI, MKV и др.) в MP4 формат.
    Видео автоматически:
    - Обрезается до 60 секунд
    - Масштабируется до максимум 1920x1080 пикселей (если больше)
    
    Args:
        file: Видео файл для конвертации
        quality: Качество выходного видео - low, medium, high (по умолчанию medium)
    
    Returns:
        Конвертированное видео в формате MP4 (максимум 60 секунд, 1920x1080)
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Поддерживаемые форматы для конвертации
    supported_extensions = ['.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.3gp']
    filename_lower = file.filename.lower()
    
    # Проверяем, нужна ли конвертация
    file_ext = os.path.splitext(filename_lower)[1]
    if file_ext == '.mp4':
        file_ext = '.mp4'
    
    if file_ext not in supported_extensions and file_ext != '.mp4':
        raise HTTPException(
            status_code=400, 
            detail=f"Unsupported video format: {file_ext}. Supported: {', '.join(supported_extensions)}"
        )
    
    # Настройки качества
    quality_settings = {
        "low": ["-crf", "28", "-preset", "faster"],
        "medium": ["-crf", "23", "-preset", "medium"],
        "high": ["-crf", "18", "-preset", "slow"],
    }
    
    if quality not in quality_settings:
        raise HTTPException(status_code=400, detail="Quality must be: low, medium, or high")
    
    settings = quality_settings[quality]
    
    try:
        # Читаем файл
        contents = await file.read()
        
        # Создаём временные файлы
        with tempfile.NamedTemporaryFile(suffix=file_ext, delete=False) as input_file:
            input_file.write(contents)
            input_path = input_file.name
        
        # Создаём пути для промежуточных файлов
        trimmed_path = input_path.rsplit('.', 1)[0] + '_trimmed' + file_ext
        scaled_path = input_path.rsplit('.', 1)[0] + '_scaled.mp4'
        output_path = input_path.rsplit('.', 1)[0] + '.mp4'
        
        original_width = 0
        original_height = 0
        scaled_width = 0
        scaled_height = 0
        
        try:
            # Шаг 1: Сначала обрезаем видео до 60 секунд
            await trim_video_to_60_seconds(input_path, trimmed_path)
            
            # Шаг 2: Получаем разрешение обрезанного видео
            original_width, original_height = await get_video_resolution(trimmed_path)
            
            # Шаг 3: Вычисляем новое разрешение (масштабируем если нужно)
            scaled_width, scaled_height = await calculate_scaled_resolution(original_width, original_height)
            
            # Шаг 4: Если разрешение отличается, масштабируем видео
            if scaled_width != original_width or scaled_height != original_height:
                await scale_video_resolution(trimmed_path, scaled_path, scaled_width, scaled_height)
                # Используем масштабированное видео для финальной конвертации
                final_input = scaled_path
            else:
                # Если масштабирование не требуется, конвертируем обрезанное видео напрямую
                final_input = trimmed_path
            
            # Шаг 5: Финальная конвертация в MP4 с нужным качеством
            cmd = [
                'ffmpeg',
                '-i', final_input,
                '-c:v', 'libx264',
                '-c:a', 'aac',
                *settings,
                '-movflags', 'faststart',
                '-b:a', '128k',
                '-y',
                output_path
            ]
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minutes timeout
            )
            
            if result.returncode != 0:
                error_msg = result.stderr or "Unknown FFmpeg error"
                raise HTTPException(
                    status_code=500, 
                    detail=f"FFmpeg conversion failed: {error_msg}"
                )
            
            # Читаем результат
            with open(output_path, 'rb') as f:
                output_data = f.read()
            
            # Генерируем новое имя файла
            new_filename = file.filename.rsplit('.', 1)[0] + '.mp4'
            
            was_scaled = scaled_width != original_width or scaled_height != original_height
            
            return Response(
                content=output_data,
                media_type="video/mp4",
                headers={
                    "Content-Disposition": f'attachment; filename="{new_filename}"',
                    "X-Original-Filename": file.filename,
                    "X-Converted-Filename": new_filename,
                    "X-Video-Trimmed": "true",
                    "X-Video-Duration": "60",
                    "X-Original-Resolution": f"{original_width}x{original_height}",
                    "X-Final-Resolution": f"{scaled_width}x{scaled_height}",
                    "X-Video-Scaled": "true" if was_scaled else "false"
                }
            )
            
        finally:
            # Удаляем временные файлы
            for path in [input_path, trimmed_path, scaled_path, output_path]:
                if os.path.exists(path):
                    os.unlink(path)
                
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500, 
            detail="Video processing timed out. File might be too large or complex."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to process video: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Проверка работоспособности сервиса конвертации видео."""
    try:
        # Проверяем, что FFmpeg доступен
        result = subprocess.run(
            ['ffmpeg', '-version'], 
            capture_output=True, 
            text=True, 
            timeout=10
        )
        if result.returncode == 0:
            return {
                "status": "ok",
                "service": "video-converter",
                "supported_formats": [".mov", ".avi", ".mkv", ".webm", ".wmv", ".flv", ".m4v", ".3gp"],
                "output_format": "MP4 (H.264 + AAC)",
                "max_duration": "60 seconds",
                "max_resolution": f"{MAX_WIDTH}x{MAX_HEIGHT}",
                "ffmpeg_version": result.stdout.split('\n')[0] if result.stdout else "unknown"
            }
        else:
            return {
                "status": "error",
                "service": "video-converter",
                "error": "FFmpeg not found or not working"
            }
    except subprocess.TimeoutExpired:
        return {
            "status": "error",
            "service": "video-converter",
            "error": "FFmpeg check timed out"
        }
    except Exception as e:
        return {
            "status": "error",
            "service": "video-converter",
            "error": f"FFmpeg check failed: {str(e)}"
        }
