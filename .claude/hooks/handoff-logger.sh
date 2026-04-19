#!/bin/bash
# handoff-logger.sh — автоматически логирует конец сессии в HANDOFF.md
# Вызывается Stop-хуком Claude Code

PROJECT_DIR="/Users/alexei.kalinin/Documents/VibeCoding/Iskra-i-Echo"
HANDOFF_FILE="$PROJECT_DIR/HANDOFF.md"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M')

# Найти недавно изменённые JS файлы (последние 4 часа)
CHANGED_FILES=$(find "$PROJECT_DIR/js" -name "*.js" -newer "$PROJECT_DIR/CLAUDE.md" -not -name "*.min.js" 2>/dev/null | sed "s|$PROJECT_DIR/||" | tr '\n' ', ' | sed 's/,$//')

# Если файлов нет — ищем за последние 24 часа
if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES=$(find "$PROJECT_DIR/js" -name "*.js" -mtime -1 2>/dev/null | sed "s|$PROJECT_DIR/||" | tr '\n' ', ' | sed 's/,$//')
fi

# Если совсем ничего нет
if [ -z "$CHANGED_FILES" ]; then
    CHANGED_FILES="нет изменений"
fi

# Добавить запись в HANDOFF.md (перед закрывающим комментарием)
cat >> "$HANDOFF_FILE" << EOF

---
### [$TIMESTAMP] Автозапись конца сессии
**Изменённые JS файлы:** $CHANGED_FILES
**Следующий шаг:** см. последнюю запись выше или раздел "Этап 7" в IDEAS.md
EOF

echo "Handoff log updated: $TIMESTAMP"
