"""
AI парсер для извлечения данных из текста объявлений.
Обрабатывает каждое поле по отдельности с типизированными промптами.
"""
import json
from typing import Dict, Any, List, Optional
from langchain_openai import ChatOpenAI
from langchain_core.messages import HumanMessage, SystemMessage
from app.config.settings import OPENAI_API_KEY
from app.services.prompts import (
    DESCRIPTION_BLOCKS_PARSING_PROMPT,
    SPECIFIC_PROMPTS,
    PROMPTS,
    FIELD_SPECIFIC_MAPPING,
    GENERATION_DETECTION_PROMPT,
    TRANSLATION_RUSSIAN_TO_ROMANIAN_PROMPT,
)


class AIParserService:
    """Сервис для AI парсинга текста объявлений по одному полю."""

    def __init__(self):
        self.llm = ChatOpenAI(
            model="gpt-4o-mini",
            temperature=0,
            api_key=OPENAI_API_KEY
        )

    def parse_single_field(
        self,
        text: str,
        field: Dict[str, Any],
        options: Optional[List[Dict]] = None,
        use_specific: bool = True
    ) -> Dict[str, Any]:
        """
        Парсит одно поле из текста объявления.
        
        Args:
            text: Текст объявления
            field: Данные поля (id, title, type, options)
            options: Опции для зависимых полей (загруженные через API)
            use_specific: Использовать специфичную обработку для особых полей
        
        Returns:
            {"label": "...", "label_id": "..."} или {"label": ""}
        """
        field_id = str(field.get("id", ""))
        field_title = field.get("title", "")
        field_type = field.get("type", "textbox_text")
        field_options = options or field.get("options", [])
        
        print(f"🔍 Парсинг поля: {field_title} (ID: {field_id}, Type: {field_type})")
        
        # Проверяем, есть ли специфичная обработка для этого поля
        specific_key = FIELD_SPECIFIC_MAPPING.get(field_id)
        
        if use_specific and specific_key:
            return self._parse_specific_field(text, field_id, specific_key)
        
        try:
            # Получаем промпт для типа поля
            prompt_template = PROMPTS.get(field_type, PROMPTS["textbox_text"])
            system_prompt = prompt_template.format(field_title=field_title)
            
            # Формируем сообщение пользователя
            user_message = f"ТЕКСТ ОБЪЯВЛЕНИЯ:\n{text}"
            
            # Добавляем options для dropdown
            if field_type == "drop_down_options" and field_options:
                options_text = json.dumps(
                    [{"id": str(o.get("id")), "title": o.get("title") or o.get("name", "")} 
                     for o in field_options],
                    ensure_ascii=False
                )
                user_message += f"\n\nOPTIONS:\n{options_text}"
            
            # Вызов LLM
            messages = [
                SystemMessage(content=system_prompt),
                HumanMessage(content=user_message)
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            # Очистка и парсинг JSON
            result_text = self._clean_json_response(output)
            result = json.loads(result_text)
            
            print(f"✅ Результат для {field_title}: {result}")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка парсинга поля {field_title}: {str(e)}")
            return {"label": "", "label_id": ""} if field_type == "drop_down_options" else {"label": ""}

    def _parse_specific_field(
        self,
        text: str,
        field_id: str,
        specific_key: str
    ) -> Dict[str, Any]:
        """
        Парсит поле с использованием специфичного промпта.
        
        Args:
            text: Текст объявления
            field_id: ID поля
            specific_key: Ключ специфичного промпта
        
        Returns:
            {"label": "..."} с обработанным значением
        """
        print(f"🎯 Специфичная обработка поля ID={field_id} ({specific_key})")
        
        try:
            # Для описания используем специальный метод
            if specific_key == "description":
                return self._parse_description_field(text)
            
            specific_prompt = SPECIFIC_PROMPTS.get(specific_key)
            if not specific_prompt:
                return {"label": ""}
            
            messages = [
                SystemMessage(content=specific_prompt),
                HumanMessage(content=f"ТЕКСТ ОБЪЯВЛЕНИЯ:\n{text}")
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            result_text = self._clean_json_response(output)
            result = json.loads(result_text)
            
            print(f"✅ Специфичный результат: {str(result)[:100]}...")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка специфичного парсинга: {str(e)}")
            return {"label": ""}

    def _parse_description_field(self, text: str) -> Dict[str, Any]:
        """
        Парсит поле описания с извлечением блоков, генерацией резюме, трансформацией и финальным форматированием.
        
        Args:
            text: Текст объявления
        
        Returns:
            {"label": "...полное описание..."}
        """
        print("📝 Парсинг поля описания (с резюме, блоками и трансформацией)")
        
        try:
            # Шаг 1: Извлекаем блоки из текста
            blocks = self._extract_description_blocks(text)
            print(f"✅ Извлечены блоки: {list(blocks.keys())}")
            
            if not blocks:
                print("⚠️ Блоки не найдены, возвращаем пустое описание")
                return {"label": ""}
            
            # Шаг 2: Генерируем краткое резюме
            summary = self._generate_description_summary(blocks)
            print(f"✅ Резюме сгенерировано: {summary[:80]}...")
            
            # Шаг 3: Трансформируем блоки в красивое описание
            transformed_description = self._transform_description_blocks(blocks)
            
            # Шаг 4: Добавляем финальный шаблон с контактами
            address = self._extract_address_from_blocks(blocks)
            final_description = self._add_description_footer(transformed_description, address)
            
            # Шаг 5: Объединяем резюме с полным описанием
            complete_description = f"{summary}\n\n{final_description}"
            
            print(f"✅ Сформировано финальное описание, длина: {len(complete_description)} символов")
            return {"label": complete_description}
            
        except Exception as e:
            print(f"❌ Ошибка при парсинге описания: {str(e)}")
            import traceback
            traceback.print_exc()
            return {"label": ""}

    def _extract_description_blocks(self, text: str) -> Dict[str, str]:
        """
        Извлекает из текста структурированные блоки описания.
        
        Args:
            text: Текст объявления
        
        Returns:
            {"available": "...", "location": "...", "vin": "...", "condition": "...", "possible": "..."}
        """
        try:
            messages = [
                SystemMessage(content=DESCRIPTION_BLOCKS_PARSING_PROMPT),
                HumanMessage(content=f"ТЕКСТ ОБЪЯВЛЕНИЯ:\n{text}")
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            result_text = self._clean_json_response(output)
            blocks = json.loads(result_text)
            
            # Очищаем блоки от пустых значений
            blocks = {k: v.strip() for k, v in blocks.items() if isinstance(v, str) and v.strip()}
            
            return blocks
            
        except Exception as e:
            print(f"❌ Ошибка при извлечении блоков: {str(e)}")
            import traceback
            traceback.print_exc()
            return {}

    def _transform_description_blocks(self, blocks: Dict[str, str]) -> str:
        """
        Трансформирует извлеченные блоки в красивое, структурированное описание.
        Преобразует сухие списки в читаемый текст с заголовками СОСТОЯНИЕ, КОМПЛЕКТАЦИЯ, ПРЕИМУЩЕСТВА.
        
        Args:
            blocks: Словарь извлеченных блоков (available, condition, possible)
        
        Returns:
            Отформатированное описание
        """
        try:
            from app.services.prompts import DESCRIPTION_BLOCKS_TRANSFORMATION_PROMPT
            
            # Подготавливаем входные данные для трансформации
            transformation_input = {
                "available": blocks.get("available", ""),
                "condition": blocks.get("condition", ""),
                "possible": blocks.get("possible", "")
            }
            
            user_message = "БЛОКИ ДЛЯ ТРАНСФОРМАЦИИ:\n" + json.dumps(
                transformation_input,
                ensure_ascii=False,
                indent=2
            )
            
            messages = [
                SystemMessage(content=DESCRIPTION_BLOCKS_TRANSFORMATION_PROMPT),
                HumanMessage(content=user_message)
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            result_text = self._clean_json_response(output)
            transformed = json.loads(result_text)
            
            # Собираем финальный текст из трансформированных блоков
            result = []
            
            if transformed.get("condition"):
                result.append("СОСТОЯНИЕ:")
                result.append(transformed["condition"])
                result.append("")
            
            if transformed.get("features"):
                result.append("КОМПЛЕКТАЦИЯ:")
                result.append(transformed["features"])
                result.append("")
            
            if transformed.get("advantages"):
                result.append("ПРЕИМУЩЕСТВА:")
                result.append(transformed["advantages"])
            
            return "\n".join(result).strip()
            
        except Exception as e:
            print(f"❌ Ошибка при трансформации блоков: {str(e)}")
            import traceback
            traceback.print_exc()
            # Возвращаем блоки как есть, если трансформация не сработала
            return self._build_description_from_blocks(blocks)

    def _extract_address_from_blocks(self, blocks: Dict[str, str]) -> str:
        """
        Извлекает адрес из блока location.
        
        Args:
            blocks: Словарь блоков
        
        Returns:
            Адрес (первая строка блока location)
        """
        location_block = blocks.get("location", "")
        if location_block:
            # Берем первую строку после удаления emoji и пробелов
            lines = location_block.split("\n")
            for line in lines:
                clean_line = line.replace("📍", "").replace("Мы находимся:", "").strip()
                if clean_line and not clean_line.startswith("📞") and not clean_line.startswith("+"):
                    return clean_line
        return "Bugeac, Pavlova 1A"

    def _add_description_footer(self, description: str, address: str) -> str:
        """
        Добавляет финальный шаблон с контактами и условиями к описанию.
        
        Args:
            description: Основное описание
            address: Адрес парковки
        
        Returns:
            Полное описание с финальным шаблоном
        """
        from app.services.prompts import DESCRIPTION_FOOTER_TEMPLATE
        
        footer = DESCRIPTION_FOOTER_TEMPLATE.format(address=address)
        
        return f"{description}\n{footer}"

    def _build_description_from_blocks(self, blocks: Dict[str, str]) -> str:
        """
        Собирает финальное описание из блоков с правильным форматированием.
        Используется как fallback при ошибке трансформации.
        
        Args:
            blocks: Словарь извлеченных блоков
        
        Returns:
            Форматированное описание
        """
        result = []
        
        # Порядок блоков в финальном описании
        block_order = ["available", "location", "vin", "condition", "possible"]
        
        for block_key in block_order:
            if block_key in blocks and blocks[block_key]:
                block_content = blocks[block_key]
                
                # Добавляем блок
                result.append(block_content)
                result.append("")  # Пустая строка между блоками
        
        # Удаляем последнюю пустую строку
        if result and result[-1] == "":
            result.pop()
        
        return "\n".join(result)

    def generate_description_from_template(
        self,
        car_details: str
    ) -> str:
        """
        Генерирует описание по шаблону (DEPRECATED - используется для обратной совместимости).
        Для новой логики используйте _parse_description_field.
        
        Args:
            car_details: Детали о состоянии автомобиля
        
        Returns:
            Полное описание по шаблону
        """
        print("⚠️ generate_description_from_template вызван (deprecated метод)")
        
        if not car_details:
            car_details = "автомобиля"
        
        # Возвращаем просто детали, т.к. DESCRIPTION_TEMPLATE больше не используется
        return car_details

    def detect_generation(
        self,
        vin: str,
        year: int,
        make: str,
        model: str,
        generations: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Определяет поколение автомобиля по VIN-коду и году.
        
        Args:
            vin: VIN-код автомобиля
            year: Год выпуска
            make: Марка
            model: Модель
            generations: Список поколений из API
        
        Returns:
            {"label": "название", "label_id": "id"}
        """
        print(f"🚗 Определение поколения: {make} {model} {year}")
        
        try:
            # Форматируем поколения
            generations_text = json.dumps(generations, ensure_ascii=False, indent=2)
            
            prompt = GENERATION_DETECTION_PROMPT.format(
                vin=vin or "не указан",
                year=year or "не указан",
                make=make or "не указан",
                model=model or "не указан",
                generations=generations_text
            )
            
            messages = [
                SystemMessage(content=prompt),
                HumanMessage(content="Определи поколение автомобиля.")
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            result_text = self._clean_json_response(output)
            result = json.loads(result_text)
            
            print(f"🎯 Поколение: {result}")
            return result
            
        except Exception as e:
            print(f"❌ Ошибка определения поколения: {str(e)}")
            return {"label": "", "label_id": ""}

    def translate_russian_to_romanian(self, text: str) -> str:
        """
        Переводит текст с русского на румынский.
        
        Args:
            text: Текст на русском
        
        Returns:
            Текст на румынском
        """
        print("🌐 Перевод текста с русского на румынский")
        
        try:
            messages = [
                SystemMessage(content=TRANSLATION_RUSSIAN_TO_ROMANIAN_PROMPT),
                HumanMessage(content=text)
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            print("✅ Перевод завершен")
            return output.strip()
            
        except Exception as e:
            print(f"❌ Ошибка перевода: {str(e)}")
            return ""

    def _clean_json_response(self, text: str) -> str:
        """Очищает ответ от markdown и лишних символов."""
        if "```json" in text:
            text = text.split("```json")[1].split("```")[0].strip()
        elif "```" in text:
            text = text.split("```")[1].split("```")[0].strip()
        return text.strip()

    def _generate_description_summary(self, blocks: Dict[str, str]) -> str:
        """
        Генерирует краткое резюме описания - самое важное о машине в 1-2 предложениях.
        
        Args:
            blocks: Словарь извлеченных блоков
        
        Returns:
            Краткое резюме
        """
        try:
            from app.services.prompts import DESCRIPTION_SUMMARY_PROMPT
            
            # Подготавливаем входные данные для генерации резюме
            summary_input = {
                "available": blocks.get("available", ""),
                "condition": blocks.get("condition", ""),
                "possible": blocks.get("possible", "")
            }
            
            user_message = "ИНФОРМАЦИЯ ОБ АВТОМОБИЛЕ:\n" + json.dumps(
                summary_input,
                ensure_ascii=False,
                indent=2
            )
            
            messages = [
                SystemMessage(content=DESCRIPTION_SUMMARY_PROMPT),
                HumanMessage(content=user_message)
            ]
            
            response = self.llm.invoke(messages)
            output = response.content
            
            result_text = self._clean_json_response(output)
            result = json.loads(result_text)
            
            summary = result.get("summary", "").strip()
            
            if not summary:
                print("⚠️ Резюме не сгенерировано, используем fallback")
                summary = self._generate_fallback_summary(blocks)
            
            return summary
            
        except Exception as e:
            print(f"❌ Ошибка при генерации резюме: {str(e)}")
            import traceback
            traceback.print_exc()
            return self._generate_fallback_summary(blocks)

    def _generate_fallback_summary(self, blocks: Dict[str, str]) -> str:
        """
        Генерирует резюме как fallback, если основная генерация не сработала.
        Парсит информацию вручную из блоков.
        
        Args:
            blocks: Словарь блоков
        
        Returns:
            Краткое резюме
        """
        available = blocks.get("available", "")
        condition = blocks.get("condition", "")
        
        # Пытаемся извлечь марку, модель и год из available блока
        lines = available.split("\n")
        make = ""
        model = ""
        year = ""
        price = ""
        
        for line in lines:
            if "Марка:" in line:
                make = line.split("Марка:")[1].strip()
            elif "Модель:" in line:
                model = line.split("Модель:")[1].strip()
            elif "Год:" in line:
                year = line.split("Год:")[1].strip()
            elif "Цена:" in line:
                price = line.split("Цена:")[1].strip()
        
        # Проверяем условие
        condition_text = ""
        if "идеальное состояние" in condition.lower():
            condition_text = "идеальное состояние"
        elif "свежепригнана" in condition.lower():
            condition_text = "свежепригнанный"
        elif "отличное состояние" in condition.lower():
            condition_text = "отличное состояние"
        else:
            condition_text = "хорошее состояние"
        
        # Собираем fallback резюме
        if make and year:
            return f"{make} {year}, {condition_text}. Надежный автомобиль с хорошей комплектацией."
        
        return "Надежный автомобиль в хорошем состоянии с интересной комплектацией."


# Singleton instance
ai_parser_service = AIParserService()
