# Читаем файл
with open(".env", "r") as f:
    text = f.read()

# Заменяем кавычки
new_text = text.replace("'", '"')

# Сохраняем обратно
with open(".env", "w") as f:
    f.write(new_text)

print("Готово! Кавычки заменены.")