// scripts/flattenTokens.js

const fs = require('fs');
const path = require('path');

/**
 * Функция для глубокого объединения объектов.
 * При конфликте ключей значения из source перекрывают значения из target.
 * @param {Object} target - Целевой объект.
 * @param {Object} source - Источник.
 * @returns {Object} - Объединенный объект.
 */
function deepMerge(target, source) {
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      if (
        typeof source[key] === 'object' &&
        source[key] !== null &&
        !Array.isArray(source[key])
      ) {
        if (!target[key]) {
          target[key] = {};
        }
        target[key] = deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }
  return target;
}

/**
 * Функция для удаления оберток и перемещения содержимого на верхний уровень.
 * @param {Object} tokens - Объект токенов.
 * @param {Array} wrappers - Массив названий оберток для удаления.
 * @returns {Object} - Обновленный объект токенов без оберток.
 */
function removeWrappers(tokens, wrappers) {
  wrappers.forEach(wrapper => {
    if (tokens.hasOwnProperty(wrapper)) {
      const wrapperContent = tokens[wrapper];
      tokens = deepMerge(tokens, wrapperContent);
      delete tokens[wrapper];
      console.log(`Удалена обертка: ${wrapper}`);
    }
  });
  return tokens;
}

/**
 * Функция для обновления ссылок внутри токенов.
 * Удаляет префиксы оберток из ссылок.
 * @param {Object} tokens - Объект токенов.
 * @param {Array} wrappers - Массив названий оберток.
 */
function updateReferences(tokens, wrappers) {
  const traverse = (obj) => {
    for (const key in obj) {
      if (!obj.hasOwnProperty(key)) continue;
      const value = obj[key];
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        traverse(value);
      } else if (typeof value === 'string') {
        // Регулярное выражение для поиска ссылок в формате {path.to.token}
        obj[key] = value.replace(/\{([^}]+)\}/g, (match, p1) => {
          // Проверяем, начинается ли путь с одной из оберток
          const matchedWrapper = wrappers.find(wrapper => p1.startsWith(`${wrapper}.`));
          if (matchedWrapper) {
            // Удаляем префикс обертки из ссылки
            const newPath = p1.replace(`${matchedWrapper}.`, '');
            return `{${newPath}}`;
          }
          return match; // Оставляем без изменений, если префикс не найден
        });
      }
    }
  };

  traverse(tokens);
}

/**
 * Основная функция скрипта.
 */
function main() {
  const tokensFilePath = path.resolve(__dirname, './tokens/tokens.json'); // Путь к исходному файлу токенов
  const outputDir = path.resolve(__dirname, './tokens/prepared'); // Папка для сохранения обновленных токенов
  const outputFilePath = path.join(outputDir, 'tokens.json'); // Путь для сохранения обновленного файла

  // Проверяем наличие файла токенов
  if (!fs.existsSync(tokensFilePath)) {
    console.error(`Файл токенов не найден по пути: ${tokensFilePath}`);
    process.exit(1);
  }

  // Создаем папку для обновленных токенов, если она не существует
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
    console.log(`Создана папка: ${outputDir}`);
  }

  // Загружаем токены
  let tokens = JSON.parse(fs.readFileSync(tokensFilePath, 'utf-8'));

  // Получаем список оберток из метаданных
  const tokenSetOrder = tokens["$metadata"] && tokens["$metadata"].tokenSetOrder;
  if (!Array.isArray(tokenSetOrder)) {
    console.error(`Не удалось найти "tokenSetOrder" в метаданных.`);
    process.exit(1);
  }

  // Удаляем обертки и перемещаем содержимое на верхний уровень
  tokens = removeWrappers(tokens, tokenSetOrder);

  // Обновляем ссылки внутри токенов
  updateReferences(tokens, tokenSetOrder);

  // Удаляем метаданные, так как структура токенов изменилась
  delete tokens["$metadata"];

  // Сохраняем обновленные токены
  fs.writeFileSync(outputFilePath, JSON.stringify(tokens, null, 2), 'utf-8');
  console.log(`Обновленные токены сохранены в: ${outputFilePath}`);
}

main();
