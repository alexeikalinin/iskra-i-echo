/**
 * dialogues.js — Диалоги и реплики персонажей «Искра и Эхо»
 *
 * Источник: Story_Scene_Breakdown.md.docx + Character_Bible_Iskra_i_Eho.md.docx
 *
 * Структура:
 *   DIALOGUES.chapters[N].intro          — вступление главы (до мини-игр)
 *   DIALOGUES.chapters[N].afterMiniGame[idx].win  — реакция на победу в мини-игре
 *   DIALOGUES.chapters[N].afterMiniGame[idx].lose — реакция на поражение
 *   DIALOGUES.chapters[N].complete       — финал главы (все мини-игры пройдены)
 *
 * Ключи эмоций: 'joy' | 'sad' | 'surprise' | 'calm' | 'delight'
 * speakerId:    'svetlya' | 'duh' | 'ten'
 */

const DIALOGUES = {

  chapters: {

    // ─── Глава 1: «Первая искра» ─────────────────────────────────────────────
    1: {
      title:    'Первая искра',
      location: 'Заброшенная поляна в сумерках',

      intro: [
        { speakerId: 'svetlya', emotion: 'sad',
          text: '…Ты меня слышишь?' },
        { speakerId: 'svetlya', emotion: 'sad',
          text: 'Я так давно была одна… Так темно здесь.' },
        { speakerId: 'svetlya', emotion: 'calm',
          text: 'Помоги мне — и я снова засвечусь.' },
      ],

      afterMiniGame: {
        // После match3 (индекс 0)
        0: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Ты помог мне! Я… чуть ярче стала!' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Ничего… попробуем ещё раз. Я верю в нас.' }],
        },
        // После hidden_object (индекс 1)
        1: {
          win:  [{ speakerId: 'svetlya', emotion: 'surprise',
                   text: 'Эти предметы… они чьи-то. Чьи-то воспоминания здесь…' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Подожди, я плохо вижу в темноте. Давай ещё раз.' }],
        },
        // После memory_pairs (индекс 2)
        2: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Пары! Всё встало на место. Как красиво — свет и свет!' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Память капризная штука… Давай ещё раз?' }],
        },
        // После второго match3 (индекс 3)
        3: {
          win:  [{ speakerId: 'svetlya', emotion: 'delight',
                   text: 'Я горю! Настоящим огнём! Спасибо, друг!' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Почти… Ещё чуть-чуть!' }],
        },
      },

      complete: [
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Подожди… Я что-то вспомнила.' },
        { speakerId: 'svetlya', emotion: 'calm',
          text: 'Там кто-то был рядом. Давно-давно. Его звали…' },
        { speakerId: 'svetlya', emotion: 'surprise',
          text: '…Дух.' },
      ],
    },

    // ─── Глава 2: «Шёпот в тумане» ──────────────────────────────────────────
    2: {
      title:    'Шёпот в тумане',
      location: 'Старый густой лес',

      intro: [
        { speakerId: 'svetlya', emotion: 'calm',
          text: 'Здесь такой густой туман… Но мне кажется, я слышу что-то.' },
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Это голос! Далеко-далеко… Ты слышишь?' },
      ],

      afterMiniGame: {
        0: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Путь найден! Туман немного рассеялся.' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Заблудились… но это ничего. Попробуем ещё раз.' }],
        },
        1: {
          win:  [{ speakerId: 'svetlya', emotion: 'surprise',
                   text: 'Стоп! Тут что-то изменилось. Я чувствую чужое присутствие…' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Внимание подводит меня в темноте. Ещё раз?' }],
        },
        2: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Свет! Мы нашли его след.' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Ничего страшного. Попробуем снова.' }],
        },
        3: {
          win:  [{ speakerId: 'svetlya', emotion: 'surprise',
                   text: 'Это слова… Слова из прошлого! Они складываются в имя.' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Буквы разбегаются… Давай ещё раз.' }],
        },
      },

      complete: [
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Я слышу кого-то… Далеко-далеко!' },
        { speakerId: 'svetlya', emotion: 'joy',
          text: 'Дух! Это ты?! Отзовись!' },
      ],
    },

    // ─── Глава 3: «Руины памяти» ─────────────────────────────────────────────
    3: {
      title:    'Руины памяти',
      location: 'Разрушенный древний храм',

      intro: [
        { speakerId: 'svetlya', emotion: 'calm',
          text: 'Здесь что-то случилось давным-давно… Руины хранят воспоминания.' },
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Смотри! Там артефакт. Он светится так же, как Дух!' },
      ],

      afterMiniGame: {
        0: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Фрагменты воспоминаний собраны! Я чувствую его присутствие.' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Воспоминания разлетелись… Соберём их заново.' }],
        },
        1: {
          win:  [{ speakerId: 'svetlya', emotion: 'surprise',
                   text: 'Слова! Они описывают его. «Память». «Мудрость». «Эхо».' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Загадка не поддаётся… Подумаем ещё раз.' }],
        },
        2: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Картинка сложилась! Это его дом. Был его дом.' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Осколки не слушаются… Попробуем снова.' }],
        },
        3: {
          win:  [{ speakerId: 'svetlya', emotion: 'delight',
                   text: 'Огонь снова ярче! Дух пробуждается — я чувствую!' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Ещё немного… Мы почти у цели!' }],
        },
      },

      complete: [
        { speakerId: 'svetlya', emotion: 'joy',
          text: 'Артефакт засветился! Дух просыпается!' },
        { speakerId: 'duh',     emotion: 'surprise',
          text: '…Ты нашла меня.' },
        { speakerId: 'svetlya', emotion: 'delight',
          text: 'ДУХ! Это правда ты! Ты такой маленький… и такой настоящий!' },
      ],
    },

    // ─── Глава 4: «Эхо в ночи» ──────────────────────────────────────────────
    4: {
      title:    'Эхо в ночи',
      location: 'Тёмная пещера',

      intro: [
        { speakerId: 'svetlya', emotion: 'calm',
          text: 'Дух всё ещё такой слабый… Ему нужна наша помощь.' },
        { speakerId: 'duh',     emotion: 'calm',
          text: 'Я чувствую… здесь было что-то важное. Давно.' },
      ],

      afterMiniGame: {
        0: {
          win:  [{ speakerId: 'duh', emotion: 'joy',
                   text: 'Свет. Я помню этот свет. Спасибо.' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: '…Ничего. Попробуем ещё.' }],
        },
        1: {
          win:  [{ speakerId: 'duh', emotion: 'surprise',
                   text: 'Что-то изменилось здесь… Очень давно. Я начинаю вспоминать.' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Воспоминания ускользают… Ещё раз.' }],
        },
        2: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Вы дошли! Ты хорошо ориентируешься в темноте, Дух!' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Темнота обманывает… Попробуем снова.' }],
        },
        3: {
          win:  [{ speakerId: 'duh', emotion: 'joy',
                   text: 'Я вспомнил. Нас было… трое.' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Воспоминание почти ухватил… Ещё раз.' }],
        },
      },

      complete: [
        { speakerId: 'duh',     emotion: 'calm',
          text: 'Ты… не одна. Я здесь.' },
        { speakerId: 'svetlya', emotion: 'delight',
          text: 'Его голос! Настоящий! ДУХ!' },
        { speakerId: 'duh',     emotion: 'surprise',
          text: 'Я помню тебя, Светля. И… нас было трое.' },
      ],
    },

    // ─── Глава 5: «Первая встреча» (конец Акта 1) ───────────────────────────
    5: {
      title:    'Первая встреча',
      location: 'Вершина холма на рассвете',

      intro: [
        { speakerId: 'svetlya', emotion: 'joy',
          text: 'Рассвет! Дух, смотри — небо розовое!' },
        { speakerId: 'duh',     emotion: 'calm',
          text: 'Я помню этот рассвет. Мы встречали его вместе. Все трое.' },
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Все трое?! Кто третий?!' },
      ],

      afterMiniGame: {
        0: {
          win:  [{ speakerId: 'svetlya', emotion: 'joy',
                   text: 'Вместе мы сильнее! Чувствуешь, Дух?' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Ничего. Попробуем вместе ещё раз.' }],
        },
        1: {
          win:  [{ speakerId: 'duh', emotion: 'surprise',
                   text: 'Я вижу его след. Третий был здесь.' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Следы размыты временем… Ищем дальше.' }],
        },
        2: {
          win:  [{ speakerId: 'svetlya', emotion: 'delight',
                   text: 'Слова складываются! «Тень», «Защита», «Забота»…' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Буквы разбежались… Ещё раз?' }],
        },
        3: {
          win:  [{ speakerId: 'duh', emotion: 'joy',
                   text: 'Хорошо. Воспоминание стало чётче.' }],
          lose: [{ speakerId: 'duh', emotion: 'calm',
                   text: 'Почти… Ещё одна попытка.' }],
        },
        4: {
          win:  [{ speakerId: 'svetlya', emotion: 'delight',
                   text: 'Пары найдены! Всё соединяется, как пазл!' }],
          lose: [{ speakerId: 'svetlya', emotion: 'calm',
                   text: 'Потеряли нить… Найдём заново.' }],
        },
      },

      complete: [
        { speakerId: 'duh',     emotion: 'calm',
          text: 'Нас было трое. Светля. Дух. И…' },
        { speakerId: 'svetlya', emotion: 'surprise',
          text: 'Тень. Его зовут Тень.' },
        { speakerId: 'duh',     emotion: 'surprise',
          text: 'Он где-то там. В темноте. Ждёт.' },
        { speakerId: 'svetlya', emotion: 'delight',
          text: 'Тогда мы найдём его! Мы найдём всех!' },
      ],
    },

  }, // end chapters

}; // end DIALOGUES
