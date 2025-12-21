"""
Роутер для конвертации видео (MOV -> MP4 и другие форматы).
"""
import subprocess
import tempfile
import os
from fastapi import APIRouter, UploadFile, File, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/video", tags=["Video Processing"])


@router.post("/convert-to-mp4")
async def convert_video_to_mp4(
    file: UploadFile = File(...),
    quality: str = "medium"
):
    """
    Конвертирует видео (MOV, AVI, MKV и др.) в MP4 формат.
    
    Args:
        file: Видео файл для конвертации
        quality: Качество выходного видео - low, medium, high (по умолчанию medium)
    
    Returns:
        Конвертированное видео в формате MP4
    """
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")
    
    # Поддерживаемые форматы для конвертации
    supported_extensions = ['.mov', '.avi', '.mkv', '.webm', '.wmv', '.flv', '.m4v', '.3gp']
    filename_lower = file.filename.lower()
    
    # Проверяем, нужна ли конвертация
    file_ext = os.path.splitext(filename_lower)[1]
    if file_ext == '.mp4':
        # Уже MP4, возвращаем как есть
        contents = await file.read()
        return Response(
            content=contents,
            media_type="video/mp4",
            headers={
                "Content-Disposition": f'attachment; filename="{file.filename}"',
            }
        )
    
    if file_ext not in supported_extensions:
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
        
        output_path = input_path.rsplit('.', 1)[0] + '.mp4'
        
        try:
            # Конвертируем с помощью FFmpeg через subprocess
            cmd = [
                'ffmpeg',
                '-i', input_path,  # input file
                '-c:v', 'libx264',  # video codec
                '-c:a', 'aac',      # audio codec
                *settings,           # quality settings
                '-movflags', 'faststart',  # fast start for web playback
                '-b:a', '128k',      # audio bitrate
                '-y',                # overwrite output
                output_path
            ]
            
            # Запускаем FFmpeg
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
            
            return Response(
                content=output_data,
                media_type="video/mp4",
                headers={
                    "Content-Disposition": f'attachment; filename="{new_filename}"',
                    "X-Original-Filename": file.filename,
                    "X-Converted-Filename": new_filename
                }
            )
            
        finally:
            # Удаляем временные файлы
            if os.path.exists(input_path):
                os.unlink(input_path)
            if os.path.exists(output_path):
                os.unlink(output_path)
                
    except subprocess.TimeoutExpired:
        raise HTTPException(
            status_code=500, 
            detail="Video conversion timed out. File might be too large or complex."
        )
    except Exception as e:
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to convert video: {str(e)}"
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
