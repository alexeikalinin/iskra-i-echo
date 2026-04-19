как# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Проект: «Искра и Эхо»

Мобильная cozy casual puzzle-игра в стиле Studio Ghibli, сочетающая цепочки мини-игр, Tamagotchi-элемент и нарратив о дружбе трёх древних существ.

## Запуск проекта

Сборщик не нужен — игра работает напрямую через браузер.

```bash
# Вариант 1: встроенный Python HTTP-сервер
python3 -m http.server 8080
# Открыть: http://localhost:8080

# Вариант 2: Node.js (если установлен)
npx serve .
# Открыть: http://localhost:3000
```

> Открывать `index.html` как `file://` нельзя — Service Worker и некоторые Canvas API требуют HTTP-контекста.

### Иконки PWA (нужны один раз)
1. Открыть `generate-icons.html` в браузере
2. Скачать `icon-192.png` и `icon-512.png` → положить в `icons/`

## Технический стек

- **Phaser 3.60** (CDN, `phaser.min.js`) — игровой движок
- **PWA** — `manifest.json` + `service-worker.js`, portrait-only
- Нет сборщика, нет npm — чистый HTML + JS через `<script>` теги
- **localStorage** через `SaveManager` — единственная точка сохранений
- Все текстуры генерируются программно через Canvas 2D API в `PreloadScene`

## Архитектура (Этап 6)

### Порядок загрузки файлов (index.html)
```
config.js → SaveManager.js → GameState.js → сцены → main.js
```
Порядок критичен: каждый следующий файл зависит от предыдущего.

### Поток сцен
```
BootScene → PreloadScene → MainMenuScene → CompanionSelectScene
                                                    ↓ (Этап 7)
                                               ChapterScene → Mini-game scenes
```

### Глобальные синглтоны
| Переменная | Файл | Назначение |
|---|---|---|
| `window.SaveManager` | `js/utils/SaveManager.js` | Единственный доступ к localStorage |
| `window.GameState` | `js/managers/GameState.js` | Всё состояние игры + автосохранение |
| `GAME_CONFIG`, `COLORS`, `COMPANIONS`, `ANIM` | `js/config.js` | Константы, цвета, данные персонажей |

### GameState API (ключевые методы)
```javascript
GameState.load()                         // загрузить из localStorage
GameState.save()                         // записать в localStorage
GameState.isFirstVisit()                 // компаньон ещё не выбран?
GameState.setFirstCompanion('svetlya')   // выбрать компаньона + сохранить
GameState.get('story.currentChapter')    // получить по точечному пути
GameState.set('settings.musicVolume', 0.5)
GameState.completeChapter(3)             // завершить главу (автоматически разблокирует Тень)
GameState.evolveCompanion('svetlya')     // стадия эволюции +1 (макс. 5)
```

### Добавление новой сцены
1. Создать `js/scenes/NewScene.js` с классом `class NewScene extends Phaser.Scene`
2. Добавить ключ в `GAME_CONFIG.SCENES` (`js/config.js`)
3. Подключить `<script>` в `index.html` (перед `main.js`)
4. Добавить класс в массив `scene: [...]` в `js/main.js`
5. Добавить путь в `PRECACHE_ASSETS` в `service-worker.js`

### Визуальные константы
Все цвета — в `COLORS` (`config.js`), именованные по персонажу и назначению.
Тайминги анимаций — в `ANIM`. Никогда не хардкодить числа напрямую.

### Персонажи (три компаньона)
- **Светля** — свет, энергия, надежда (динамичная)
- **Дух** — память, мудрость, воспоминания (спокойный)
- **Тень** — защита, покой, забота (тихий); разблокируется после главы 3
Подробности — в `Character_Bible_Iskra_i_Eho.md.docx`: 5 стадий эволюции, эмоциональные системы, стиль речи.

### Игровой цикл
1. Выбор первого компаньона (Светля или Дух)
2. 15 сюжетных глав — в каждой цепочка из 4–5 мини-игр (порядок в `CHAPTER_MINI_GAMES`)
3. После каждой мини-игры — эмоциональная реакция компаньона
4. Post-game: режим «Дом Воспоминаний» (разблокируется после главы 15)

### 8 типов мини-игр
Match-3, Лабиринт, Hidden Object, Кроссворд/Word Puzzle, Spot the Difference, Memory Pairs, Sliding Puzzle, Bubble Shooter. Спецификации — в `MiniGames_Specifications.md.docx`.

## Обязательные документы

При генерации любого кода необходимо учитывать содержимое этих файлов:

| Файл | Содержимое |
|------|------------|
| `Character_Bible_Iskra_i_Eho.md.docx` | Внешность, анимации, диалоги, эволюция персонажей |
| `MiniGames_Specifications.md.docx` | Правила, баланс и техтребования всех 8 мини-игр |
| `Story_Scene_Breakdown.md.docx` | Сюжет 15 глав, цепочки мини-игр, ключевые диалоги |
| `PostGame_Design.md.docx` | Режим «Дом Воспоминаний», сезонные события, retention |
| `Visual_Audio_UI_Bible.md.docx` | Art style, цветовая палитра, UI, музыка и SFX |

## Стиль кода

- Комментарии и документация — на русском языке (в соответствии с контекстом проекта)
- Код должен быть чистым, хорошо прокомментированным и расширяемым
- Сохранять cozy, тёплый и эмоциональный тон в текстах и диалогах
- При создании визуальных элементов строго следовать Visual & Audio Bible
