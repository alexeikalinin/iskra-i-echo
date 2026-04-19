/**
 * CrosswordScene.js — Мини-игра «Кроссворд» для «Искра и Эхо»
 *
 * Механика: заранее заданные слова размещены на сетке горизонтально
 * и вертикально с корректными пересечениями. Игрок тапает на ячейку,
 * выбирает слово из подсказок и вводит буквы через экранную клавиатуру.
 *
 * Получает данные:
 *   { chapter, miniGameIndex, companionId, difficulty }
 *
 * Возвращает в ChapterScene:
 *   { chapter, miniGameIndex, miniGameResult: { stars, score, timeMs, completed } }
 *
 * Сложность / размер:
 *   easy   — 5 слов, 300 сек
 *   normal — 7 слов, 240 сек
 *   hard   — 9 слов, 180 сек
 */

// ─── Наборы слов ────────────────────────────────────────────────────────────────
//
// Координаты: dir='H' — горизонталь (слева направо),
//             dir='V' — вертикаль   (сверху вниз)
// row/col — позиция первой буквы.
//
// Пересечения проверены вручную (совпадающая буква отмечена комментарием).
//
// easy (5 слов):
//   ОГОНЬ  H r=0 c=0 → О(0,0) Г(0,1) О(0,2) Н(0,3) Ь(0,4)
//   ОЗЕРО  V r=0 c=0 → О(0,0) З(1,0) Е(2,0) Р(3,0) О(4,0)  пересечение (0,0)='О'='О' ✓
//   НЕБО   H r=2 c=0 → Н(2,0) Е(2,1) Б(2,2) О(2,3)         пересечение с ОЗЕРО (2,0)='Е'≠'Н' ✗
//
// Пересечения сложно гарантировать при произвольных словах.
// Поэтому наборы слов построены так, чтобы буква пересечения
// совпадала явно — что проверено ниже для каждого набора.
//
// ── EASY ──────────────────────────────────────────────────────────────────────
// Слова и их позиции на сетке 11×11:
//
//   СВЕТ  H r=0 c=0: С(0,0)В(0,1)Е(0,2)Т(0,3)
//   ТЕНЬ  V r=0 c=3: Т(0,3)Е(1,3)Н(2,3)Ь(3,3)  пересечение(0,3): 'Т'='Т' ✓
//   ЛЕНЬ  H r=2 c=1: Л(2,1)Е(2,2)Н(2,3)Ь(2,4)  пересечение с ТЕНЬ (2,3):'Н'='Н' ✓
//   ЛУНА  V r=2 c=1: Л(2,1)У(3,1)Н(4,1)А(5,1)  пересечение с ЛЕНЬ (2,1):'Л'='Л' ✓
//   МАК   H r=4 c=1: М(4,1)А(4,2)К(4,3)        пересечение с ЛУНА (4,1):'Н'≠'М' ✗
//
// Исправляем — строим полностью совместимый набор:
//
//   СВЕТ  H r=0 c=0: С(0,0)В(0,1)Е(0,2)Т(0,3)
//   ТЕНЬ  V r=0 c=3: Т(0,3)Е(1,3)Н(2,3)Ь(3,3)   пересечение(0,3):'Т'='Т' ✓
//   ДЕНЬ  H r=2 c=0: Д(2,0)Е(2,1)Н(2,2)Ь(2,3)   пересечение с ТЕНЬ(2,3):'Н'≠'Ь' ✗
//
// Подбираем иначе — вертикаль пересекает горизонталь по индексу буквы:
//
//   МОРЕ  H r=4 c=0: М(4,0)О(4,1)Р(4,2)Е(4,3)
//   ЛЕТО  V r=2 c=2: Л(2,2)Е(3,2)Т(4,2)О(5,2)   пересечение(4,2):'Р'≠'Т' ✗
//
// Финальный подход — зафиксировать пересечения сначала, потом подобрать слова:
//
// Пересечение A = (2,4): нужна одна буква, которая входит в H-слово (позиция col=4-colStart)
//                        и в V-слово (позиция row=2-rowStart).
//
// Используем простую схему с двумя независимыми цепочками:
//
// Цепочка 1 (вертикаль пересекает горизонталь):
//   СВЕТ   H r=0 c=0 → С В Е Т
//   ВЕСНА  V r=0 c=1 → В(0,1) Е(1,1) С(2,1) Н(3,1) А(4,1)
//   пересечение (0,1): СВЕТ[1]='В', ВЕСНА[0]='В' ✓
//
//   МИС    H r=2 c=0 → М(2,0) И(2,1) С(2,2)
//   пересечение с ВЕСНА (2,1): ВЕСНА[2]='С', МИС[1]='И' ✗
//
// Лучший подход — тщательно подобрать слова с явными совпадениями букв.
// Финальные наборы (проверены вручную):

const WORD_SETS = {

  // ── EASY — 5 слов ──────────────────────────────────────────────────────────
  //
  // Схема сетки (показаны только буквы кроссворда, . = пустая):
  //
  //   col:  0 1 2 3 4 5
  // row 0:  С В Е Т . .
  // row 1:  . Е . Е . .
  // row 2:  . С . Н . .
  // row 3:  . Н . Ь . .
  // row 4:  . А . . . .
  // row 5:  . . . . . .
  //
  // СВЕТ  H r=0 c=0 → С(0,0) В(0,1) Е(0,2) Т(0,3)
  // ВЕСНА V r=0 c=1 → В(0,1) Е(1,1) С(2,1) Н(3,1) А(4,1)
  //   пересечение (0,1): СВЕТ[1]='В' = ВЕСНА[0]='В' ✓
  // ТЕНЬ  V r=0 c=3 → Т(0,3) Е(1,3) Н(2,3) Ь(3,3)
  //   пересечение (0,3): СВЕТ[3]='Т' = ТЕНЬ[0]='Т' ✓
  //
  // Нужно ещё 2 слова, пересекающих ВЕСНА или ТЕНЬ:
  //
  //   col:  0 1 2 3 4 5
  // row 2:  . С . Н . .    (ВЕСНА[2]='С' на (2,1); ТЕНЬ[2]='Н' на (2,3))
  // Добавим: СЕНО H r=2 c=1 → С(2,1) Е(2,2) Н(2,3) О(2,4)
  //   пересечение с ВЕСНА (2,1): ВЕСНА[2]='С' = СЕНО[0]='С' ✓
  //   пересечение с ТЕНЬ  (2,3): ТЕНЬ[2]='Н'  = СЕНО[2]='Н' ✓  (двойное пересечение!)
  //
  // 5-е слово — пересекает СЕНО:
  // ОДНО V r=2 c=4 → О(2,4) Д(3,4) Н(4,4) О(5,4)
  //   пересечение с СЕНО (2,4): СЕНО[3]='О' = ОДНО[0]='О' ✓
  //
  // Итого:
  //   СВЕТ  H r=0 c=0
  //   ТЕНЬ  V r=0 c=3
  //   ВЕСНА V r=0 c=1
  //   СЕНО  H r=2 c=1
  //   ОДНО  V r=2 c=4
  easy: [
    { word: 'СВЕТ',  clue: 'Что даёт Светля',       dir: 'H', row: 0, col: 0 },
    { word: 'ВЕСНА', clue: 'Время пробуждения',      dir: 'V', row: 0, col: 1 },
    { word: 'ТЕНЬ',  clue: 'Тихий страж',            dir: 'V', row: 0, col: 3 },
    { word: 'СЕНО',  clue: 'Летний запах полей',     dir: 'H', row: 2, col: 1 },
    { word: 'ОДНО',  clue: 'Единственное желание',   dir: 'V', row: 2, col: 4 },
  ],

  // ── NORMAL — 7 слов ────────────────────────────────────────────────────────
  //
  // Схема (показаны буквы на сетке 11×11):
  //
  //   col:  0 1 2 3 4 5 6 7
  // row 0:  И С К Р А . . .
  // row 1:  . . . . А . . .
  // row 2:  . . . . Т . . .
  // row 3:  . . . . Ь . . .
  // row 4:  . . . . . . . .
  //
  // ИСКРА  H r=0 c=0 → И С К Р А
  // ПАМЯТЬ V r=0 c=4 → П? — нет, нужна А в позиции (0,4)
  //
  // Начнём иначе. Определим сетку через пересечения:
  //
  //   col:  0 1 2 3 4 5 6 7
  // row 0:  С В Е Т Л Я . .
  // row 1:  . . . . У . . .
  // row 2:  . . З В У К . .
  // row 3:  . . . . . А . .
  // row 4:  . . . . . . . .
  //
  // СВЕТЛЯ H r=0 c=0 → С В Е Т Л Я
  // ЛУНА   V r=0 c=4 → Л(0,4) У(1,4) Н(2,4) А(3,4)
  //   пересечение (0,4): СВЕТЛЯ[4]='Л' = ЛУНА[0]='Л' ✓
  //
  // Далее ЛУНА[2]='Н' на (2,4). Добавим горизонталь через эту точку:
  // Слово с 'Н' посередине... ЗВУК H r=2 c=2 → З В У К — нет 'Н'.
  // ЗЕМЛЯ? Нет... ЛУННЫЙ? Ь на (2,4)='Н'.
  // Попробуем: ТАЙНА H r=2 c=2 → Т(2,2)А(2,3)Й(2,4)Н(2,5)А(2,6)
  //   пересечение (2,4): ЛУНА[2]='Н' ≠ ТАЙНА[2]='Й' ✗
  // СИНИЙ H r=2 c=2 → С(2,2)И(2,3)Н(2,4)И(2,5)Й(2,6)
  //   пересечение (2,4): ЛУНА[2]='Н' = СИНИЙ[2]='Н' ✓
  //
  // Продолжаем строить... но проще зафиксировать весь набор
  // вокруг русских слов игры, чётко раскладывая на бумаге.
  //
  // Финальная схема NORMAL (7 слов):
  //
  //   col:  0 1 2 3 4 5 6 7 8 9
  // row 0:  С В Е Т Л Я . . . .
  // row 1:  . Е . . У . . . . .
  // row 2:  . Р . . Н . . . . .
  // row 3:  . А . . А . . . . .
  // row 4:  . . . . . . . . . .
  // row 5:  . . . . . . . . . .
  // row 6:  . . З В Е З Д А . .
  // row 7:  . . . . . . . А . .
  // row 8:  . . . . . . . К . .
  // row 9:  . . . . . . . А . .
  //
  // СВЕТЛЯ H r=0 c=0 → С В Е Т Л Я
  // ВЕРА   V r=0 c=1 → В(0,1)Е(1,1)Р(2,1)А(3,1)
  //   пересечение (0,1): СВЕТЛЯ[1]='В' = ВЕРА[0]='В' ✓
  // ЛУНА   V r=0 c=4 → Л(0,4)У(1,4)Н(2,4)А(3,4)
  //   пересечение (0,4): СВЕТЛЯ[4]='Л' = ЛУНА[0]='Л' ✓
  // ЗВЕЗДА H r=6 c=2 → З В Е З Д А
  // МРАК   V r=2 c=1 → ... уже занято ВЕРА
  //
  // ЗВЕЗДА[5]='А' на (6,7). Вертикаль: ЗАКАТ V r=6 c=7 → З(6,7)?  ЗВЕЗДА[5]='А', ЗАКАТ[0]='З' ✗
  // Нужна вертикаль с 'А' в row=6. ДРУГ? ДАКО? ...
  // МАЯК V r=6 c=7 → М? ЗВЕЗДА[5]='А' на (6,7). Нужна вертикаль: ?А..
  // ЗАКАТ — нет. АКТ V r=6 c=7 → А(6,7)К(7,7)Т(8,7) — пересечение ✓, но слово короткое.
  // МАЯК V r=6 c=5 → ЗВЕЗДА[3]='З' на (6,5). М≠З ✗.
  //
  // Лучше взять пересечение по ЗВЕЗДА[2]='Е' на (6,4):
  // СЕВЕР V r=4 c=4 → С(4,4)Е(5,4)В(6,4)Е(7,4)Р(8,4)
  //   пересечение (6,4): ЗВЕЗДА[2]='Е' = СЕВЕР[2]='В' ✗
  // ОТВЕТ V r=4 c=4 → О(4,4)Т(5,4)В(6,4)Е(7,4)Т(8,4)
  //   ЗВЕЗДА[2]='Е' ≠ ОТВЕТ[2]='В' ✗
  //
  // СВЕТ V r=4 c=4 → С(4,4)В(5,4)Е(6,4)Т(7,4)
  //   пересечение (6,4): ЗВЕЗДА[2]='Е' = СВЕТ[2]='Е' ✓
  //
  // Итого NORMAL:
  //   СВЕТЛЯ  H r=0 c=0
  //   ВЕРА    V r=0 c=1   пересечение(0,1)='В' ✓
  //   ЛУНА    V r=0 c=4   пересечение(0,4)='Л' ✓
  //   ЗВЕЗДА  H r=6 c=2
  //   СВЕТ    V r=4 c=4   пересечение(6,4) ЗВЕЗДА[2]='Е' = СВЕТ[2]='Е' ✓
  //
  // Нужно ещё 2 слова. Добавим:
  // ДРУГ H r=3 c=0 → Д(3,0)Р(3,1)У(3,2)Г(3,3)
  //   пересечение с ВЕРА (3,1): ВЕРА[3]='А' ≠ ДРУГ[1]='Р' ✗
  // ЛУНА[3]='А' на (3,4). Горизонталь через (3,4):
  // ПАРК H r=3 c=2 → П(3,2)А(3,3)Р(3,4)К(3,5) — ЛУНА[3]='А' ≠ ПАРК[2]='Р' ✗
  // ДАРА H r=3 c=2 → Д(3,2)А(3,3)Р(3,4)А(3,5) — ЛУНА[3]='А' ≠ ДАРА[2]='Р' ✗
  // НАРА H r=3 c=2 → Н(3,2)А(3,3)Р(3,4)А(3,5) — ЛУНА[3]='А' ≠ НАРА[2]='Р' ✗
  // ВАЗА H r=3 c=1 → В(3,1)А(3,2)З(3,3)А(3,4) — ВЕРА[3]='А'=ВАЗА[0]='В' ✗ и ЛУНА[3]='А'=ВАЗА[3]='А' ✓
  //   но ВЕРА (3,1): ВЕРА[3]='А' ≠ ВАЗА[0]='В' ✗
  //
  // ОЧК — В(3,1)... нет.
  //
  // Добавим горизонталь через ВЕРА[3]='А' на (3,1):
  // слово с 'А' как первая буква: АИСТ H r=3 c=1 → А(3,1)И(3,2)С(3,3)Т(3,4)
  //   ВЕРА(3,1)='А' = АИСТ[0]='А' ✓
  //   ЛУНА(3,4)='А' ≠ АИСТ[3]='Т' ✗
  //
  // слово с 'А' как 1я буква и 4ой: АЛМА? нет. АРКА H r=3 c=1:
  // А(3,1)Р(3,2)К(3,3)А(3,4) — ВЕРА(3,1)='А'=АРКА[0]='А' ✓, ЛУНА(3,4)='А'=АРКА[3]='А' ✓ !!
  //
  // АРКА даёт двойное пересечение — идеально!
  // Добавим ещё одно слово (7-е):
  // ЛИСТ V r=6 c=2 → Л(6,2)И(7,2)С(8,2)Т(9,2)
  //   пересечение с ЗВЕЗДА (6,2): ЗВЕЗДА[0]='З' ≠ ЛИСТ[0]='Л' ✗
  // Нужна вертикаль с 'З' в row=6, col=2:
  // ЗАРЯ V r=6 c=2 → З(6,2)А(7,2)Р(8,2)Я(9,2) — ЗВЕЗДА[0]='З'=ЗАРЯ[0]='З' ✓
  //
  // Итого NORMAL (7 слов):
  //   СВЕТЛЯ  H r=0 c=0
  //   ВЕРА    V r=0 c=1   пересечение(0,1)='В' ✓
  //   ЛУНА    V r=0 c=4   пересечение(0,4)='Л' ✓
  //   АРКА    H r=3 c=1   пересечение(3,1) с ВЕРА='А' ✓; (3,4) с ЛУНА='А' ✓
  //   ЗВЕЗДА  H r=6 c=2
  //   СВЕТ    V r=4 c=4   пересечение(6,4) ЗВЕЗДА[2]='Е'=СВЕТ[2]='Е' ✓ (СВЕТ: С=r4,В=r5,Е=r6,Т=r7)
  //   ЗАРЯ    V r=6 c=2   пересечение(6,2) ЗВЕЗДА[0]='З'=ЗАРЯ[0]='З' ✓
  normal: [
    { word: 'СВЕТЛЯ', clue: 'Искрящийся компаньон',   dir: 'H', row: 0, col: 0 },
    { word: 'ВЕРА',   clue: 'Основа надежды',          dir: 'V', row: 0, col: 1 },
    { word: 'ЛУНА',   clue: 'Ночное светило',          dir: 'V', row: 0, col: 4 },
    { word: 'АРКА',   clue: 'Вход в другой мир',       dir: 'H', row: 3, col: 1 },
    { word: 'ЗВЕЗДА', clue: 'Светится в ночи',         dir: 'H', row: 6, col: 2 },
    { word: 'СВЕТ',   clue: 'Что несёт Светля',        dir: 'V', row: 4, col: 4 },
    { word: 'ЗАРЯ',   clue: 'Рассвет на горизонте',    dir: 'V', row: 6, col: 2 },
  ],

  // ── HARD — 9 слов ──────────────────────────────────────────────────────────
  //
  // Финальная схема HARD (строится аналогично, проверено):
  //
  // СВЕТЛЯЧОК H r=0 c=0 → С В Е Т Л Я Ч О К  (9 букв, col 0..8)
  // СТОН      V r=0 c=0 → С(0,0)Т(1,0)О(2,0)Н(3,0)
  //   пересечение(0,0): СВЕТЛЯЧОК[0]='С'=СТОН[0]='С' ✓
  // ВЕТЕР     V r=0 c=1 → В(0,1)Е(1,1)Т(2,1)Е(3,1)Р(4,1)
  //   пересечение(0,1): СВЕТЛЯЧОК[1]='В'=ВЕТЕР[0]='В' ✓
  // СОЧНЫЙ    H r=2 c=0 → С(2,0)О(2,1)Ч(2,2)Н(2,3)Ы(2,4)Й(2,5)
  //   пересечение(2,0): СТОН[2]='О'≠СОЧНЫЙ[0]='С' ✗
  // Нужна горизонталь с 'О' в col=0 row=2:
  // ОБЛАКО H r=2 c=0 → О(2,0)Б(2,1)Л(2,2)А(2,3)К(2,4)О(2,5)
  //   СТОН(2,0)='О'=ОБЛАКО[0]='О' ✓
  //   ВЕТЕР(2,1)='Т'≠ОБЛАКО[1]='Б' ✗
  // Нужна горизонталь где col=0 → 'О' И col=1 → 'Т':
  // ОТЧИЙ H r=2 c=0: О(2,0)Т(2,1)Ч(2,2)И(2,3)Й(2,4) — СТОН[2]='О'='О'✓, ВЕТЕР[2]='Т'='Т'✓ !!
  //
  // ОТЧИЙ дважды пересекается!
  //
  // Продолжаем строить 9-словный набор:
  // СВЕТЛЯЧОК[4]='Л' на (0,4). Вертикаль:
  // ЛУГА V r=0 c=4 → Л(0,4)У(1,4)Г(2,4)А(3,4)
  //   СВЕТЛЯЧОК[4]='Л'=ЛУГА[0]='Л' ✓
  //   ОТЧИЙ(2,4): ОТЧИЙ[4]='Й'≠ЛУГА[2]='Г' ✗
  // ЛИТЬ V r=0 c=4: Л(0,4)И(1,4)Т(2,4)Ь(3,4) — ОТЧИЙ[4]='Й'≠ЛИТЬ[2]='Т' ✗
  // ЛИСТ V r=0 c=4: Л(0,4)И(1,4)С(2,4)Т(3,4) — ОТЧИЙ[4]='Й'≠ЛИСТ[2]='С' ✗
  // ЛИМА V r=0 c=4: Л(0,4)И(1,4)М(2,4)А(3,4) — ОТЧИЙ[4]='Й'≠ЛИМА[2]='М' ✗
  // Нужна вертикаль с 'Л' row=0 и 'И' row=2 col=4: третья буква 'И'
  // ЛНИМИ? нет русского...
  // Пересечение (2,4) = ОТЧИЙ[4]='Й'. Вертикаль с 'Й' как 3я буква (r=0..):
  // ЛЕЙКА V r=0 c=4: Л(0,4)Е(1,4)Й(2,4)К(3,4)А(4,4)
  //   СВЕТЛЯЧОК[4]='Л'=ЛЕЙКА[0]='Л' ✓
  //   ОТЧИЙ(2,4)='Й'=ЛЕЙКА[2]='Й' ✓ !!
  //
  // Продолжаем. Нужно ещё 4 слова для 9-словного набора.
  // Используем ещё буквы из СВЕТЛЯЧОК: 'Я'=col5, 'Ч'=col6, 'О'=col7, 'К'=col8.
  //
  // ВЕТЕР[4]='Р' на (4,1). Горизонталь через (4,1):
  // Слово с 'Р' как 2я буква: АРФА H r=4 c=0: А(4,0)Р(4,1)Ф(4,2)А(4,3)
  //   ВЕТЕР(4,1)='Р'=АРФА[1]='Р' ✓
  //
  // ЛЕЙКА[3]='К' на (3,4). Горизонталь через (3,4):
  // Слово с 'К' как 1я буква... К... КОТИК? КЕДР?
  // Слово с 'К' как 2я буква (col=3): АККОРД? нет. ЭКРАН? нет.
  // ОКНО H r=3 c=3: О(3,3)К(3,4)Н(3,5)О(3,6) — ЛЕЙКА(3,4)='К'≠ОКНО[1]='К' ✓? нет: ОКНО[1]='К', (3,4)='К' ✓!
  //   СТОН(3,0)='Н': нет пересечения с ОКНО здесь (col=3).
  //   Всё хорошо — ОКНО пересекает ЛЕЙКА (3,4): ЛЕЙКА[3]='К'=ОКНО[1]='К' ✓
  //
  // Ещё 2 слова:
  // СВЕТЛЯЧОК[7]='О' на (0,7). Вертикаль:
  // ОСЕНЬ V r=0 c=7: О(0,7)С(1,7)Е(2,7)Н(3,7)Ь(4,7)
  //   СВЕТЛЯЧОК[7]='О'=ОСЕНЬ[0]='О' ✓
  //
  // 9-е слово: пересечение с ОСЕНЬ или другим словом.
  // ОСЕНЬ[2]='Е' на (2,7). Горизонталь через (2,7):
  // Слово с 'Е' как 8й символ? Нет, слово слишком длинное.
  // ОБЛАКО H r=4 c=3: О(4,3)Б(4,4)Л(4,5)А(4,6)К(4,7)О(4,8)
  //   ЛЕЙКА(4,4)='А'≠ОБЛАКО[1]='Б' ✗
  //   АРФА(4,0..3) уже занимает (4,0)(4,1)(4,2)(4,3).
  //   АРФА[3]='А' на (4,3). Горизонтальное слово через (4,3):
  //   нет нового слова (АРФА сама горизонталь).
  //
  // Возьмём 9-е слово как вертикаль через ОКНО:
  // ОКНО[2]='Н' на (3,5). Вертикаль: НОС V r=3 c=5: Н(3,5)О(4,5)С(5,5)
  //   ОКНО(3,5)='Н'=НОС[0]='Н' ✓
  //
  // Итого HARD (9 слов):
  //   СВЕТЛЯЧОК H r=0 c=0
  //   СТОН      V r=0 c=0   пересечение(0,0)='С' ✓
  //   ВЕТЕР     V r=0 c=1   пересечение(0,1)='В' ✓
  //   ОТЧИЙ     H r=2 c=0   пересечение(2,0)='О'✓, (2,1)='Т'✓
  //   ЛЕЙКА     V r=0 c=4   пересечение(0,4)='Л'✓, (2,4)='Й'✓
  //   АРФА      H r=4 c=0   пересечение(4,1)='Р' с ВЕТЕР ✓
  //   ОКНО      H r=3 c=3   пересечение(3,4)='К' с ЛЕЙКА ✓
  //   ОСЕНЬ     V r=0 c=7   пересечение(0,7)='О' с СВЕТЛЯЧОК ✓
  //   НОС       V r=3 c=5   пересечение(3,5)='Н' с ОКНО ✓
  hard: [
    { word: 'СВЕТЛЯЧОК', clue: 'Ночной огонёк',          dir: 'H', row: 0, col: 0 },
    { word: 'СТОН',      clue: 'Звук в тишине',           dir: 'V', row: 0, col: 0 },
    { word: 'ВЕТЕР',     clue: 'Голос леса',              dir: 'V', row: 0, col: 1 },
    { word: 'ОТЧИЙ',     clue: 'Родной, близкий',         dir: 'H', row: 2, col: 0 },
    { word: 'ЛЕЙКА',     clue: 'Для полива сада',         dir: 'V', row: 0, col: 4 },
    { word: 'АРФА',      clue: 'Струнный инструмент',     dir: 'H', row: 4, col: 0 },
    { word: 'ОКНО',      clue: 'Взгляд на другой мир',    dir: 'H', row: 3, col: 3 },
    { word: 'ОСЕНЬ',     clue: 'Время листопада',         dir: 'V', row: 0, col: 7 },
    { word: 'НОС',       clue: 'Нос корабля',             dir: 'V', row: 3, col: 5 },
  ],
};

// ─── Параметры сложности ─────────────────────────────────────────────────────

const CROSSWORD_DIFF = {
  easy:   { timeSec: 300, hints: 3 },
  normal: { timeSec: 240, hints: 3 },
  hard:   { timeSec: 180, hints: 3 },
};

// ─── Константы визуала ───────────────────────────────────────────────────────

const CW = {
  CELL_SIZE:      30,   // размер клетки кроссворда (px)
  CELL_GAP:        1,   // зазор между клетками
  KEY_W:          27,   // ширина клавиши клавиатуры
  KEY_H:          32,   // высота клавиши
  KEY_GAP:         3,   // зазор между клавишами
  GRID_OFFSET_X:   8,   // отступ сетки от левого края
  GRID_TOP:       90,   // верхняя Y сетки (под HUD)
  KBD_TOP:       590,   // верхняя Y клавиатуры
  HUD_H:          80,   // высота HUD
};

// ─── Раскладка экранной клавиатуры ──────────────────────────────────────────

const KBD_ROWS = [
  ['Й','Ц','У','К','Е','Н','Г','Ш','Щ','З','Х'],
  ['Ф','Ы','В','А','П','Р','О','Л','Д','Ж','Э'],
  ['Я','Ч','С','М','И','Т','Ь','Б','Ю','←'],
];

// ─── Сцена ───────────────────────────────────────────────────────────────────

class CrosswordScene extends Phaser.Scene {

  constructor() {
    super({ key: GAME_CONFIG.SCENES.CROSSWORD });
  }

  // ─── Инициализация ──────────────────────────────────────────────────────────

  init(data) {
    this._chapter     = data.chapter      || 1;
    this._mgIndex     = data.miniGameIndex || 0;
    this._companionId = data.companionId  || (typeof GameState !== 'undefined' && GameState.get('firstCompanion')) || 'svetlya';
    this._difficulty  = data.difficulty   || 'easy';
    this._startTime   = Date.now();

    const cfg = CROSSWORD_DIFF[this._difficulty] || CROSSWORD_DIFF.easy;
    this._timeLeft  = cfg.timeSec;
    this._hintsLeft = cfg.hints;

    this._score       = 0;
    this._gameOver    = false;
    this._hintsUsed   = 0;

    // Слова для текущей сложности — копируем чтобы добавить поле solved
    this._words = WORD_SETS[this._difficulty].map(w => ({
      ...w,
      solved:  false,
      letters: [], // массив текущих введённых букв (пробел = не введена)
    }));
    // Заполняем пустыми строками
    this._words.forEach(w => {
      w.letters = Array(w.word.length).fill('');
    });

    // Текущая выбранная ячейка
    this._selectedCell  = null; // { row, col }
    this._selectedWord  = null; // индекс в _words

    // Словарь: ключ "row_col" → список индексов слов, которые проходят через клетку
    this._cellToWords = {};

    // Визуальные объекты ячеек: _cellObjects["row_col"] = { bg, txt, numTxt }
    this._cellObjects = {};
  }

  // ─── Создание сцены ─────────────────────────────────────────────────────────

  create() {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;


    const companion = COMPANIONS[this._companionId];

    // Строим логику сетки
    this._buildGrid();

    // Фон
    this._drawBackground(W, H, companion);

    // HUD
    this._buildHUD(W, companion);

    // Рисуем сетку кроссворда
    this._drawGrid(W);

    // Панель подсказок (список слов)
    this._buildCluePanel(W, companion);

    // Экранная клавиатура
    this._buildKeyboard(W, companion);

    // Компаньон в HUD
    this._buildCompanion(W, companion);

    // Таймер
    this._timerEvent = this.time.addEvent({
      delay:         1000,
      callback:      this._onTick,
      callbackScope: this,
      loop:          true,
    });

    // Fade-in
    this.cameras.main.fadeIn(ANIM.FADE_IN, 10, 6, 30);
  }

  // ─── Построение логической сетки ────────────────────────────────────────────

  _buildGrid() {
    // Заполняем словарь cellToWords
    this._words.forEach((wordDef, wIdx) => {
      const { word, dir, row, col } = wordDef;
      for (let i = 0; i < word.length; i++) {
        const r = dir === 'H' ? row       : row + i;
        const c = dir === 'H' ? col + i   : col;
        const key = `${r}_${c}`;
        if (!this._cellToWords[key]) this._cellToWords[key] = [];
        if (!this._cellToWords[key].includes(wIdx)) {
          this._cellToWords[key].push(wIdx);
        }
      }
    });
  }

  // ─── Фон ────────────────────────────────────────────────────────────────────

  _drawBackground(W, H, companion) {
    const bg = this.add.graphics();
    bg.fillGradientStyle(0x0A0820, 0x0A0820, 0x150C2E, 0x150C2E, 1);
    bg.fillRect(0, 0, W, H);

    // Тонкий цветной отлив компаньона
    const glow = this.add.graphics();
    glow.fillStyle(companion.color, 0.03);
    glow.fillRect(0, 0, W, H);
  }

  // ─── HUD ────────────────────────────────────────────────────────────────────

  _buildHUD(W, companion) {
    // Фоновая полоса
    const hudBg = this.add.graphics();
    hudBg.fillStyle(0x0A0618, 0.88);
    hudBg.fillRect(0, 0, W, CW.HUD_H);
    hudBg.lineStyle(1, companion.color, 0.18);
    hudBg.lineBetween(0, CW.HUD_H, W, CW.HUD_H);

    // Название
    this.add.text(W / 2, 10, 'Кроссворд', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      fontStyle:  'bold italic',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0);

    // Счёт
    this.add.text(12, 10, 'Очки', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(0, 0);
    this._scoreTxt = this.add.text(12, 24, '0', {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
    }).setOrigin(0, 0);

    // Подсказки
    this._hintBtn = this._makeHintButton(W, companion);

    // Таймер (справа, оставляем место для орба — орб перемещён влево)
    this.add.text(W - 12, 10, 'Время', {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      color:      '#6A5A7A',
    }).setOrigin(1, 0);
    this._timerTxt = this.add.text(W - 12, 24, this._formatTime(this._timeLeft), {
      fontFamily: 'Georgia, serif',
      fontSize:   '20px',
      fontStyle:  'bold',
      color:      '#FFF4E0',
    }).setOrigin(1, 0).setDepth(6);

    // Прогресс (X из N слов)
    this._progressTxt = this.add.text(W / 2, 48, this._progressLabel(), {
      fontFamily: 'Georgia, serif',
      fontSize:   '12px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0);
  }

  _makeHintButton(W, companion) {
    const BW = 64, BH = 26;
    const x = W / 2 - 90, y = 50;

    const bg = this.add.graphics();
    this._hintBg = bg;
    this._redrawHintBtn(bg, BW, BH, companion, x, y);

    this._hintTxt = this.add.text(x, y + BH / 2, `? (${this._hintsLeft})`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      color:      '#FFF4E0',
    }).setOrigin(0.5);

    const zone = this.add.zone(x, y + BH / 2, BW, BH)
      .setInteractive({ useHandCursor: true }).setDepth(10);
    zone.on('pointerdown', () => this._useHint());

    return { bg, txt: this._hintTxt, zone };
  }

  _redrawHintBtn(bg, BW, BH, companion, x, y) {
    bg.clear();
    const alpha = this._hintsLeft > 0 ? 0.35 : 0.1;
    bg.fillStyle(companion.color, alpha);
    bg.fillRoundedRect(x - BW / 2, y, BW, BH, 13);
    bg.lineStyle(1, companion.color, this._hintsLeft > 0 ? 0.7 : 0.2);
    bg.strokeRoundedRect(x - BW / 2, y, BW, BH, 13);
  }

  _progressLabel() {
    const solved = this._words.filter(w => w.solved).length;
    return `${solved} / ${this._words.length} слов`;
  }

  // ─── Сетка кроссворда ───────────────────────────────────────────────────────

  _drawGrid(W) {
    const companion = COMPANIONS[this._companionId];
    const STEP = CW.CELL_SIZE + CW.CELL_GAP;

    // Определяем bounding box сетки для центровки
    let minRow = Infinity, maxRow = -Infinity;
    let minCol = Infinity, maxCol = -Infinity;
    this._words.forEach(({ word, dir, row, col }) => {
      minRow = Math.min(minRow, row);
      maxRow = Math.max(maxRow, dir === 'V' ? row + word.length - 1 : row);
      minCol = Math.min(minCol, col);
      maxCol = Math.max(maxCol, dir === 'H' ? col + word.length - 1 : col);
    });
    const gridCols = maxCol - minCol + 1;
    const gridRows = maxRow - minRow + 1;
    const gridW = gridCols * STEP - CW.CELL_GAP;

    // Центрируем по горизонтали
    this._gridOriginX = Math.floor((W - gridW) / 2);
    this._gridOriginY = CW.GRID_TOP;
    // Смещение от (0,0) исходных координат слов
    this._minRow = minRow;
    this._minCol = minCol;

    // Фон под сетку
    const pad = 8;
    const gridH = gridRows * STEP - CW.CELL_GAP;
    const fieldBg = this.add.graphics();
    fieldBg.fillStyle(0x080614, 0.75);
    fieldBg.fillRoundedRect(
      this._gridOriginX - pad, this._gridOriginY - pad,
      gridW + pad * 2, gridH + pad * 2, 10
    );
    fieldBg.lineStyle(1, companion.color, 0.15);
    fieldBg.strokeRoundedRect(
      this._gridOriginX - pad, this._gridOriginY - pad,
      gridW + pad * 2, gridH + pad * 2, 10
    );

    // Порядковые номера слов для клеток (нумерация по-кроссвордному)
    // Первая клетка каждого слова получает номер слова (индекс+1)
    const firstCells = {}; // ключ "row_col" → номер (строка)
    this._words.forEach((w, i) => {
      const key = `${w.row}_${w.col}`;
      if (!firstCells[key]) firstCells[key] = [];
      firstCells[key].push(i + 1);
    });

    // Отрисовываем ячейки
    Object.keys(this._cellToWords).forEach(key => {
      const [r, c] = key.split('_').map(Number);
      const px = this._gridOriginX + (c - this._minCol) * STEP;
      const py = this._gridOriginY + (r - this._minRow) * STEP;
      const S = CW.CELL_SIZE;

      // Фон ячейки
      const cellBg = this.add.graphics().setDepth(5);
      cellBg.fillStyle(0x1A1030, 1);
      cellBg.fillRect(px, py, S, S);
      cellBg.lineStyle(1, 0x2A2040, 1);
      cellBg.strokeRect(px, py, S, S);

      // Буква внутри
      const txt = this.add.text(px + S / 2, py + S / 2 + 1, '', {
        fontFamily: 'Georgia, serif',
        fontSize:   '15px',
        fontStyle:  'bold',
        color:      '#FFF4E0',
      }).setOrigin(0.5).setDepth(7);

      // Номер слова (маленький, верхний-левый угол)
      let numTxt = null;
      if (firstCells[key]) {
        numTxt = this.add.text(px + 2, py + 1, firstCells[key].join('/'), {
          fontFamily: 'Georgia, serif',
          fontSize:   '8px',
          color:      '#8A7A9A',
        }).setOrigin(0, 0).setDepth(8);
      }

      // Интерактивность
      const zone = this.add.zone(px + S / 2, py + S / 2, S, S)
        .setInteractive().setDepth(10);
      zone.on('pointerdown', () => this._onCellTap(r, c));

      this._cellObjects[key] = { cellBg, txt, numTxt, px, py };
    });
  }

  // ─── Тап по ячейке ──────────────────────────────────────────────────────────

  _onCellTap(row, col) {
    if (this._gameOver) return;
    const key = `${row}_${col}`;
    const wordIndices = this._cellToWords[key];
    if (!wordIndices || wordIndices.length === 0) return;

    // Если ячейка уже выбрана и через неё проходят несколько слов — переключаем слово
    if (this._selectedCell && this._selectedCell.row === row && this._selectedCell.col === col) {
      if (wordIndices.length > 1) {
        // Найдём следующее не-решённое слово среди пересекающихся
        const currentIdx = wordIndices.indexOf(this._selectedWord);
        const nextIdx = wordIndices[(currentIdx + 1) % wordIndices.length];
        this._selectWord(nextIdx, row, col);
      }
      return;
    }

    // Выбираем первое не-решённое слово (или первое, если все решены)
    let chosenWord = wordIndices[0];
    for (const wi of wordIndices) {
      if (!this._words[wi].solved) { chosenWord = wi; break; }
    }

    this._selectWord(chosenWord, row, col);
  }

  /** Выделить слово и конкретную ячейку */
  _selectWord(wordIdx, tapRow, tapCol) {
    const companion = COMPANIONS[this._companionId];

    // Снимаем предыдущее выделение
    if (this._selectedWord !== null) {
      this._highlightWord(this._selectedWord, 'normal', companion);
    }

    this._selectedWord = wordIdx;
    this._selectedCell = { row: tapRow, col: tapCol };

    // Подсвечиваем слово
    this._highlightWord(wordIdx, 'selected', companion);

    // Обновляем панель подсказок
    this._updateClueHighlight();
  }

  /** Подсветка ячеек слова */
  _highlightWord(wordIdx, mode, companion) {
    const w = this._words[wordIdx];
    const STEP = CW.CELL_SIZE + CW.CELL_GAP;
    const S = CW.CELL_SIZE;

    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row       : w.row + i;
      const c = w.dir === 'H' ? w.col + i   : w.col;
      const key = `${r}_${c}`;
      const obj = this._cellObjects[key];
      if (!obj) continue;

      obj.cellBg.clear();

      if (w.solved) {
        // Зелёный для решённых
        obj.cellBg.fillStyle(0x0A3020, 1);
        obj.cellBg.fillRect(obj.px, obj.py, S, S);
        obj.cellBg.lineStyle(1, 0x1A8040, 1);
        obj.cellBg.strokeRect(obj.px, obj.py, S, S);
      } else if (mode === 'selected') {
        // Цвет компаньона для выбранного слова
        obj.cellBg.fillStyle(companion.color, 0.22);
        obj.cellBg.fillRect(obj.px, obj.py, S, S);
        obj.cellBg.lineStyle(1.5, companion.color, 0.7);
        obj.cellBg.strokeRect(obj.px, obj.py, S, S);
      } else {
        // Обычный
        obj.cellBg.fillStyle(0x1A1030, 1);
        obj.cellBg.fillRect(obj.px, obj.py, S, S);
        obj.cellBg.lineStyle(1, 0x2A2040, 1);
        obj.cellBg.strokeRect(obj.px, obj.py, S, S);
      }
    }
  }

  // ─── Нажатие клавиши ────────────────────────────────────────────────────────

  _onKeyPress(letter) {
    if (this._gameOver) return;
    if (this._selectedWord === null || this._selectedCell === null) return;

    const w = this._words[this._selectedWord];
    if (w.solved) return;

    const { row, col } = this._selectedCell;

    if (letter === '←') {
      // Backspace — стираем букву в текущей ячейке
      // Определяем позицию в слове
      const pos = this._cellPositionInWord(this._selectedWord, row, col);
      if (pos >= 0) {
        w.letters[pos] = '';
        const key = `${row}_${col}`;
        if (this._cellObjects[key]) {
          this._cellObjects[key].txt.setText('');
        }
        // Двигаем курсор назад
        if (pos > 0) {
          const prevR = w.dir === 'H' ? w.row       : w.row + pos - 1;
          const prevC = w.dir === 'H' ? w.col + pos - 1 : w.col;
          this._selectedCell = { row: prevR, col: prevC };
          this._highlightCurrentCell();
        }
      }
      return;
    }

    // Вводим букву
    const pos = this._cellPositionInWord(this._selectedWord, row, col);
    if (pos < 0 || pos >= w.word.length) return;

    w.letters[pos] = letter;
    const key = `${row}_${col}`;
    if (this._cellObjects[key]) {
      this._cellObjects[key].txt.setText(letter);
    }

    // Двигаем курсор на следующую ячейку в слове
    if (pos < w.word.length - 1) {
      const nextR = w.dir === 'H' ? w.row       : w.row + pos + 1;
      const nextC = w.dir === 'H' ? w.col + pos + 1 : w.col;
      this._selectedCell = { row: nextR, col: nextC };
      this._highlightCurrentCell();
    } else {
      // Последняя буква — проверяем слово
      this._checkWord(this._selectedWord);
    }
  }

  /** Позиция ячейки (row, col) в слове (0-based), или -1 если не в слове */
  _cellPositionInWord(wordIdx, row, col) {
    const w = this._words[wordIdx];
    if (w.dir === 'H') {
      if (row !== w.row) return -1;
      const pos = col - w.col;
      if (pos < 0 || pos >= w.word.length) return -1;
      return pos;
    } else {
      if (col !== w.col) return -1;
      const pos = row - w.row;
      if (pos < 0 || pos >= w.word.length) return -1;
      return pos;
    }
  }

  /** Подсвечивает текущую выбранную ячейку внутри слова */
  _highlightCurrentCell() {
    const companion = COMPANIONS[this._companionId];
    const S = CW.CELL_SIZE;
    // Сначала перерисовываем всё слово как selected
    this._highlightWord(this._selectedWord, 'selected', companion);
    // Потом дополнительно выделяем конкретную ячейку ярче
    const { row, col } = this._selectedCell;
    const key = `${row}_${col}`;
    const obj = this._cellObjects[key];
    if (obj) {
      obj.cellBg.clear();
      obj.cellBg.fillStyle(companion.color, 0.45);
      obj.cellBg.fillRect(obj.px, obj.py, S, S);
      obj.cellBg.lineStyle(2, COLORS.WHITE, 0.85);
      obj.cellBg.strokeRect(obj.px, obj.py, S, S);
    }
  }

  // ─── Проверка слова ──────────────────────────────────────────────────────────

  _checkWord(wordIdx) {
    const w = this._words[wordIdx];
    const entered = w.letters.join('');
    const companion = COMPANIONS[this._companionId];

    if (entered === w.word) {
      // Правильно!
      w.solved = true;

      // Очки: 150 за слово
      const timeBonus = Math.floor(this._timeLeft * 1);
      const hintPenalty = this._hintsUsed * 50;
      this._score += Math.max(0, 150 + timeBonus - hintPenalty);
      this._updateHUD();

      // Зелёная подсветка
      this._highlightWord(wordIdx, 'solved', companion);

      // Анимация победы слова
      this._animateWordSolved(wordIdx, companion);

      // Обновляем панель подсказок
      this._updateCluePanel();
      this._updateClueHighlight();

      // Сбрасываем выбор
      this._selectedWord = null;
      this._selectedCell = null;

      // Проверяем победу (все слова)
      const allSolved = this._words.every(w => w.solved);
      if (allSolved) {
        this.time.delayedCall(600, () => this._endGame(true));
      }
    } else {
      // Неправильно — красное мигание
      this._animateWordWrong(wordIdx);
    }
  }

  /** Анимация: зеленоватая вспышка при правильном слове */
  _animateWordSolved(wordIdx, companion) {
    const w = this._words[wordIdx];
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row       : w.row + i;
      const c = w.dir === 'H' ? w.col + i   : w.col;
      const key = `${r}_${c}`;
      const obj = this._cellObjects[key];
      if (!obj) continue;

      // Подпрыгивание с задержкой
      this.tweens.add({
        targets:  obj.txt,
        y:        obj.txt.y - 4,
        duration: 120,
        delay:    i * 40,
        yoyo:     true,
        ease:     'Quad.easeOut',
      });

      // Масштабирование буквы
      this.tweens.add({
        targets:  obj.txt,
        scaleX:   1.35, scaleY: 1.35,
        duration: 150,
        delay:    i * 40,
        yoyo:     true,
        ease:     'Quad.easeOut',
        onComplete: () => {
          obj.txt.setColor('#6AFFA0'); // зелёный цвет буквы
        },
      });
    }
  }

  /** Анимация: красное мигание при неправильном вводе */
  _animateWordWrong(wordIdx) {
    const w = this._words[wordIdx];
    for (let i = 0; i < w.word.length; i++) {
      const r = w.dir === 'H' ? w.row       : w.row + i;
      const c = w.dir === 'H' ? w.col + i   : w.col;
      const key = `${r}_${c}`;
      const obj = this._cellObjects[key];
      if (!obj) continue;

      const S = CW.CELL_SIZE;
      // Красный фон на 400мс
      obj.cellBg.clear();
      obj.cellBg.fillStyle(0x3A0810, 1);
      obj.cellBg.fillRect(obj.px, obj.py, S, S);
      obj.cellBg.lineStyle(1.5, 0xFF4444, 0.8);
      obj.cellBg.strokeRect(obj.px, obj.py, S, S);
    }

    // Через 400мс сбрасываем обратно
    this.time.delayedCall(400, () => {
      const companion = COMPANIONS[this._companionId];
      this._highlightWord(wordIdx, 'selected', companion);
    });
  }

  // ─── Подсказка ──────────────────────────────────────────────────────────────

  _useHint() {
    if (this._gameOver) return;
    if (this._hintsLeft <= 0) {
      this._showMessage('Подсказки закончились!');
      return;
    }

    // Находим первую незаполненную букву в незавершённых словах
    let targetWord = -1;
    let targetPos  = -1;

    // Предпочитаем выбранное слово
    const candidates = this._selectedWord !== null
      ? [this._selectedWord, ...Object.keys(this._words).map(Number).filter(i => i !== this._selectedWord)]
      : this._words.map((_, i) => i);

    for (const wi of candidates) {
      const w = this._words[wi];
      if (w.solved) continue;
      for (let i = 0; i < w.word.length; i++) {
        if (w.letters[i] === '') {
          targetWord = wi;
          targetPos  = i;
          break;
        }
      }
      if (targetWord >= 0) break;
    }

    if (targetWord < 0) {
      this._showMessage('Все буквы уже введены!');
      return;
    }

    // Раскрываем букву
    const w = this._words[targetWord];
    w.letters[targetPos] = w.word[targetPos];

    const r = w.dir === 'H' ? w.row       : w.row + targetPos;
    const c = w.dir === 'H' ? w.col + targetPos : w.col;
    const key = `${r}_${c}`;
    if (this._cellObjects[key]) {
      this._cellObjects[key].txt.setText(w.word[targetPos]).setColor('#' + COMPANIONS[this._companionId].colorLight.toString(16).padStart(6, '0'));
    }

    // Перемещаем курсор на следующую пустую ячейку этого слова
    if (targetWord === this._selectedWord) {
      const nextEmpty = w.letters.findIndex((l, i) => i > targetPos && l === '');
      if (nextEmpty >= 0) {
        const nr = w.dir === 'H' ? w.row       : w.row + nextEmpty;
        const nc = w.dir === 'H' ? w.col + nextEmpty : w.col;
        this._selectedCell = { row: nr, col: nc };
        this._highlightCurrentCell();
      }
    }

    this._hintsLeft--;
    this._hintsUsed++;
    this._hintTxt.setText(`? (${this._hintsLeft})`);

    // Обновляем внешний вид кнопки подсказки
    const companion = COMPANIONS[this._companionId];
    this._redrawHintBtn(this._hintBg, 64, 26, companion, GAME_CONFIG.WIDTH / 2 - 90, 50);

    // Проверяем не заполнилось ли слово полностью
    if (!w.letters.includes('')) {
      this._checkWord(targetWord);
    }
  }

  // ─── Панель подсказок (список слов) ─────────────────────────────────────────

  _buildCluePanel(W, companion) {
    // Располагаем между сеткой и клавиатурой
    // Высота сетки: до ~CW.GRID_TOP + gridH, клавиатура начинается с CW.KBD_TOP
    // Панель подсказок — полоса над клавиатурой

    // Высота панели зависит от количества слов (минимум 4 строки)
    const lineH    = 22;
    const pad      = 8;
    const panelH   = pad * 2 + this._words.length * lineH;
    const panelTop = CW.KBD_TOP - panelH - 8;

    // Фон панели
    const panelBg = this.add.graphics().setDepth(4);
    panelBg.fillStyle(0x100A20, 0.85);
    panelBg.fillRoundedRect(pad, panelTop, W - pad * 2, panelH, 10);
    panelBg.lineStyle(1, companion.color, 0.12);
    panelBg.strokeRoundedRect(pad, panelTop, W - pad * 2, panelH, 10);

    this._cluePanelTop = panelTop;
    this._cluePanelH   = panelH;
    this._clueTexts     = [];
    this._clueContainer = this.add.container(0, 0).setDepth(5);

    this._words.forEach((w, i) => {
      const lineY = panelTop + pad + i * lineH;

      const numTxt = this.add.text(pad + 8, lineY, `${i + 1}.`, {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        fontStyle:  'bold',
        color:      '#8A7A9A',
      }).setDepth(6);

      const dirLabel = w.dir === 'H' ? '→' : '↓';
      const clueTxt = this.add.text(pad + 28, lineY, `${dirLabel} ${w.clue}`, {
        fontFamily: 'Georgia, serif',
        fontSize:   '11px',
        color:      '#BBA0CC',
        wordWrap:   { width: W - pad * 2 - 60 },
      }).setDepth(6);

      this._clueTexts.push({ numTxt, clueTxt, wordIdx: i });

      // Тап по подсказке — выбирает первую ячейку слова
      const zone = this.add.zone(W / 2, lineY + 10, W - pad * 2 - 20, 20)
        .setInteractive().setDepth(10);
      zone.on('pointerdown', () => {
        this._selectWord(i, w.row, w.col);
      });
    });
  }

  _updateCluePanel() {
    this._clueTexts.forEach(({ numTxt, clueTxt, wordIdx }) => {
      const w = this._words[wordIdx];
      if (w.solved) {
        numTxt.setColor('#3A8A5A');
        clueTxt.setColor('#3A8A5A');
      }
    });
  }

  _updateClueHighlight() {
    const companion = COMPANIONS[this._companionId];
    this._clueTexts.forEach(({ numTxt, clueTxt, wordIdx }) => {
      const w = this._words[wordIdx];
      if (w.solved) return; // уже зелёный — не трогаем
      if (wordIdx === this._selectedWord) {
        clueTxt.setColor('#' + companion.colorLight.toString(16).padStart(6, '0'));
        numTxt.setColor('#' + companion.color.toString(16).padStart(6, '0'));
      } else {
        clueTxt.setColor('#BBA0CC');
        numTxt.setColor('#8A7A9A');
      }
    });
  }

  // ─── Экранная клавиатура ─────────────────────────────────────────────────────

  _buildKeyboard(W, companion) {
    const KW = CW.KEY_W, KH = CW.KEY_H, KG = CW.KEY_GAP;
    const TOP = CW.KBD_TOP;

    KBD_ROWS.forEach((row, rowIdx) => {
      // Общая ширина ряда
      const rowW = row.length * (KW + KG) - KG;
      const startX = Math.floor((W - rowW) / 2);

      row.forEach((letter, colIdx) => {
        const x = startX + colIdx * (KW + KG);
        const y = TOP + rowIdx * (KH + KG);
        // Backspace чуть шире
        const w = letter === '←' ? KW + 12 : KW;
        this._makeKey(x, y, w, KH, letter, companion);
      });
    });
  }

  _makeKey(x, y, w, h, letter, companion) {
    const bg = this.add.graphics().setDepth(12);
    bg.fillStyle(0x1E1535, 1);
    bg.fillRoundedRect(x, y, w, h, 6);
    bg.lineStyle(1, 0x3A2A55, 1);
    bg.strokeRoundedRect(x, y, w, h, 6);

    const txt = this.add.text(x + w / 2, y + h / 2, letter, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      fontStyle:  letter === '←' ? 'normal' : 'bold',
      color:      '#CCC0E0',
    }).setOrigin(0.5).setDepth(13);

    const zone = this.add.zone(x + w / 2, y + h / 2, w, h)
      .setInteractive({ useHandCursor: true }).setDepth(14);

    zone.on('pointerdown', () => {
      // Анимация нажатия
      bg.clear();
      bg.fillStyle(companion.color, 0.4);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, companion.color, 0.8);
      bg.strokeRoundedRect(x, y, w, h, 6);
      txt.setScale(0.9);
    });

    zone.on('pointerup', () => {
      // Возврат к обычному виду
      this.time.delayedCall(ANIM.BTN_PRESS, () => {
        bg.clear();
        bg.fillStyle(0x1E1535, 1);
        bg.fillRoundedRect(x, y, w, h, 6);
        bg.lineStyle(1, 0x3A2A55, 1);
        bg.strokeRoundedRect(x, y, w, h, 6);
        txt.setScale(1);
      });
      this._onKeyPress(letter);
    });

    zone.on('pointerout', () => {
      // Сброс при уходе курсора
      bg.clear();
      bg.fillStyle(0x1E1535, 1);
      bg.fillRoundedRect(x, y, w, h, 6);
      bg.lineStyle(1, 0x3A2A55, 1);
      bg.strokeRoundedRect(x, y, w, h, 6);
      txt.setScale(1);
    });
  }

  // ─── Компаньон в HUD ────────────────────────────────────────────────────────

  _buildCompanion(W, companion) {
    const ORB_SIZE = 26;
    // Орб в нижнем правом углу HUD — ниже текста таймера (таймер y=24..48, орб y=65)
    const orbX = W - 18;
    const orbY = CW.HUD_H - 15;

    // Свечение
    this._orbGlow = this.add.ellipse(orbX, orbY + 10, 58, 22, companion.color, 0.15)
      .setBlendMode(Phaser.BlendModes.ADD).setDepth(4);

    // Спрайт (пробуем загруженный, иначе рисуем круг)
    try {
      this._orbSprite = this.add.image(orbX, orbY, `orb_${this._companionId}`)
        .setDisplaySize(ORB_SIZE, ORB_SIZE).setDepth(5);
    } catch (e) {
      // Fallback: нарисованный орб
      const fallback = this.add.graphics().setDepth(5);
      fallback.fillStyle(companion.color, 0.9);
      fallback.fillCircle(orbX, orbY, ORB_SIZE / 2);
      this._orbSprite = fallback;
    }

    // Парение
    this.tweens.add({
      targets:  this._orbSprite,
      y:        orbY - ANIM.FLOAT_AMPLITUDE / 2,
      duration: ANIM.FLOAT_DURATION,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Пульсация свечения
    this.tweens.add({
      targets:  this._orbGlow,
      alpha:    { from: 0.07, to: 0.22 },
      duration: 2000,
      yoyo:     true,
      repeat:   -1,
      ease:     'Sine.easeInOut',
    });

    // Текст реакции компаньона
    this._reactionTxt = this.add.text(W - ORB_SIZE - 10, orbY, '', {
      fontFamily: 'Georgia, serif',
      fontSize:   '10px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'right',
      wordWrap:   { width: W * 0.55 },
    }).setOrigin(1, 0.5).setAlpha(0).setDepth(6);
  }

  /** Короткая реплика компаньона (появляется и исчезает) */
  _showCompanionReaction(text) {
    if (!this._reactionTxt) return;
    this._reactionTxt.setText(text).setAlpha(1);
    this.tweens.add({
      targets:  this._reactionTxt,
      alpha:    0,
      duration: 1800,
      delay:    900,
      ease:     'Quad.easeOut',
    });
  }

  // ─── Сообщения ──────────────────────────────────────────────────────────────

  _showMessage(text) {
    const W = GAME_CONFIG.WIDTH;
    const companion = COMPANIONS[this._companionId];

    const msg = this.add.text(W / 2, CW.KBD_TOP - 140, text, {
      fontFamily: 'Georgia, serif',
      fontSize:   '13px',
      fontStyle:  'italic',
      color:      '#' + companion.colorLight.toString(16).padStart(6, '0'),
    }).setOrigin(0.5).setAlpha(1).setDepth(20);

    this.tweens.add({
      targets:  msg,
      alpha:    0,
      y:        msg.y - 20,
      duration: 1200,
      delay:    400,
      ease:     'Quad.easeOut',
      onComplete: () => msg.destroy(),
    });
  }

  // ─── Таймер ─────────────────────────────────────────────────────────────────

  _onTick() {
    if (this._gameOver) return;
    this._timeLeft--;
    this._timerTxt.setText(this._formatTime(this._timeLeft));

    if (this._timeLeft <= 30) {
      this._timerTxt.setColor('#FF4444');
    } else if (this._timeLeft <= 60) {
      this._timerTxt.setColor('#FF9B4E');
    }

    if (this._timeLeft <= 0) {
      this._endGame(false);
    }
  }

  _formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  // ─── Обновление HUD ─────────────────────────────────────────────────────────

  _updateHUD() {
    this._scoreTxt.setText(this._score.toString());
    this._progressTxt.setText(this._progressLabel());

    // Анимация счёта
    this.tweens.add({
      targets:  this._scoreTxt,
      scaleX:   1.2, scaleY: 1.2,
      duration: 80,
      yoyo:     true,
      ease:     'Quad.easeOut',
    });

    // Реплика компаньона
    const companion = COMPANIONS[this._companionId];
    this._showCompanionReaction(companion.reactions.win);
  }

  // ─── Конец игры ─────────────────────────────────────────────────────────────

  _endGame(completed) {
    if (this._gameOver) return;
    this._gameOver = true;
    if (this._timerEvent) this._timerEvent.remove();

    const solvedCount = this._words.filter(w => w.solved).length;
    const total       = this._words.length;

    // Звёзды:
    // 3★ — все слова без подсказок
    // 2★ — все слова
    // 1★ — ≥50% слов
    let stars = 0;
    if (solvedCount >= total && this._hintsUsed === 0) stars = 3;
    else if (solvedCount >= total)                      stars = 2;
    else if (solvedCount >= Math.ceil(total / 2))       stars = 1;

    this.time.delayedCall(300, () => {
      this._showResultOverlay(stars, completed, solvedCount, total);
    });
  }

  _showResultOverlay(stars, completed, solvedCount, total) {
    const W = GAME_CONFIG.WIDTH;
    const H = GAME_CONFIG.HEIGHT;
    const companion = COMPANIONS[this._companionId];

    // Затемнение
    const overlay = this.add.graphics().setDepth(30);
    overlay.fillStyle(0x000000, 0);
    overlay.fillRect(0, 0, W, H);
    this.tweens.add({ targets: overlay, alpha: 0.7, duration: ANIM.FADE_IN });

    // Карточка
    const cardW = 300, cardH = 290;
    const cardX = (W - cardW) / 2;
    const cardY = (H - cardH) / 2 - 30;

    const card = this.add.graphics().setDepth(31);
    card.fillStyle(0x100820, 0.97);
    card.fillRoundedRect(cardX, cardY, cardW, cardH, 20);
    card.lineStyle(1.5, companion.color, 0.55);
    card.strokeRoundedRect(cardX, cardY, cardW, cardH, 20);

    // Заголовок
    const title = completed ? 'Кроссворд разгадан!' : 'Время вышло';
    this.add.text(W / 2, cardY + 28, title, {
      fontFamily: 'Georgia, serif',
      fontSize:   '19px',
      fontStyle:  'bold',
      color:      completed ? '#' + COLORS.SVETLYA.toString(16) : '#9A7799',
    }).setOrigin(0.5, 0).setDepth(32);

    // Звёзды
    const starStr = '★'.repeat(stars) + '☆'.repeat(3 - stars);
    this.add.text(W / 2, cardY + 62, starStr, {
      fontFamily: 'Georgia, serif',
      fontSize:   '34px',
      color:      '#' + COLORS.STAR.toString(16),
    }).setOrigin(0.5, 0).setDepth(32);

    // Очки
    this.add.text(W / 2, cardY + 108, `Очки: ${this._score}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '17px',
      color:      '#FFF4E0',
    }).setOrigin(0.5, 0).setDepth(32);

    // Прогресс
    this.add.text(W / 2, cardY + 136, `Слов: ${solvedCount} / ${total}`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '14px',
      color:      '#9E8A7A',
    }).setOrigin(0.5, 0).setDepth(32);

    // Использованные подсказки
    if (this._hintsUsed > 0) {
      this.add.text(W / 2, cardY + 158, `Подсказок: ${this._hintsUsed}`, {
        fontFamily: 'Georgia, serif',
        fontSize:   '12px',
        color:      '#8A6A9A',
      }).setOrigin(0.5, 0).setDepth(32);
    }

    // Реплика компаньона
    const reactionKey = completed ? (stars === 3 ? 'win' : 'idle') : 'lose';
    const reaction = companion.reactions[reactionKey] || '';
    this.add.text(W / 2, cardY + 180, `«${reaction}»`, {
      fontFamily: 'Georgia, serif',
      fontSize:   '11px',
      fontStyle:  'italic',
      color:      '#' + companion.color.toString(16).padStart(6, '0'),
      align:      'center',
      wordWrap:   { width: 260 },
    }).setOrigin(0.5, 0).setDepth(32);

    // Кнопка «Продолжить»
    this._buildResultBtn(W / 2, cardY + 248, companion.color, stars, completed);

    // Частицы при победе
    if (stars >= 2) {
      this._spawnWinParticles(W, H, companion.color);
    }
  }

  _buildResultBtn(cx, cy, color, stars, completed) {
    const BW = 200, BH = 44;

    const bg = this.add.graphics().setDepth(33);
    bg.fillStyle(color, 0.28);
    bg.fillRoundedRect(cx - BW / 2, cy - BH / 2, BW, BH, 22);
    bg.lineStyle(1.5, color, 0.75);
    bg.strokeRoundedRect(cx - BW / 2, cy - BH / 2, BW, BH, 22);

    const txt = this.add.text(cx, cy, 'Продолжить', {
      fontFamily: 'Georgia, serif',
      fontSize:   '15px',
      color:      '#FFF4E0',
    }).setOrigin(0.5).setDepth(34);

    const container = this.add.container(0, 0, [bg, txt]).setDepth(33);

    const zone = this.add.zone(cx, cy, BW, BH)
      .setInteractive({ useHandCursor: true }).setDepth(35);

    zone.on('pointerdown', () => {
      this.tweens.add({ targets: container, scaleX: 0.97, scaleY: 0.97, duration: ANIM.BTN_PRESS });
    });
    zone.on('pointerup', () => {
      this.tweens.add({ targets: container, scaleX: 1, scaleY: 1, duration: ANIM.BTN_PRESS });
      this._finishGame(stars, completed);
    });
  }

  // ─── Частицы победы ─────────────────────────────────────────────────────────

  _spawnWinParticles(W, H, color) {
    const graphics = this.add.graphics().setDepth(29);
    const particles = [];
    for (let i = 0; i < 22; i++) {
      particles.push({
        x:    Phaser.Math.Between(40, W - 40),
        y:    Phaser.Math.Between(H * 0.15, H * 0.5),
        vy:   Phaser.Math.FloatBetween(-3.5, -1),
        vx:   Phaser.Math.FloatBetween(-1.5, 1.5),
        size: Phaser.Math.FloatBetween(3, 7),
      });
    }

    let elapsed = 0;
    const updateFn = (time, delta) => {
      elapsed += delta;
      if (elapsed > 2200) {
        graphics.destroy();
        this.events.off('update', updateFn);
        return;
      }
      graphics.clear();
      const life = Math.max(0, 1 - elapsed / 2200);
      for (const p of particles) {
        p.x  += p.vx;
        p.y  += p.vy;
        p.vy += 0.06;
        graphics.fillStyle(color, life * 0.85);
        graphics.fillCircle(p.x, p.y, p.size * life);
      }
    };
    this.events.on('update', updateFn);
  }

  // ─── Завершение и возврат ────────────────────────────────────────────────────

  /**
   * Финал мини-игры — сохраняем результат и переходим в ChapterScene.
   * @param {number} stars   — 1, 2 или 3 звезды
   * @param {boolean} completed — выполнено ли условие победы
   */
  _finishGame(stars, completed) {
    const timeMs = Date.now() - this._startTime;
    const result = {
      stars,
      score:     this._score,
      timeMs,
      completed,
    };

    // Сохраняем результат через GameState, если он доступен
    if (typeof GameState !== 'undefined' && GameState.saveMiniGameResult) {
      GameState.saveMiniGameResult(this._chapter, this._mgIndex, result);
    }

    this.cameras.main.fadeOut(ANIM.FADE_OUT, 10, 6, 30);
    this.time.delayedCall(ANIM.FADE_OUT + 50, () => {
      this.scene.start(GAME_CONFIG.SCENES.CHAPTER, {
        chapter:        this._chapter,
        miniGameIndex:  this._mgIndex,
        miniGameResult: result,
      });
    });
  }
}
