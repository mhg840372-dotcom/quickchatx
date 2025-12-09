#!/usr/bin/env node
/**
 * 🔎 find-upload-limits.js
 *
 * Recorre el proyecto y busca patrones típicos que limitan
 * el tamaño de subida (10MB, 10485760, maxFileSize, maxBodyLength, etc.).
 *
 * Uso:
 *   node scripts/find-upload-limits.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

// Directorios que NO queremos recorrer
const IGNORE_DIRS = new Set([
  "node_modules",
  ".git",
  "android",
  "ios",
  "assets",
  "build",
  "dist",
  ".expo",
  ".expo-shared",
]);

// Extensiones que sí vamos a escanear (archivos de texto típicos)
const TEXT_FILE_REGEX = /\.(js|jsx|ts|tsx|json|mjs|cjs|md|yml|yaml|html|css|gradle|plist|xml|conf|env|sh|tsconfig|eslintrc|babelrc)$/i;

// Patrones a buscar
const PATTERNS = [
  {
    name: "literal 10MB",
    regex: /\b10\s*MB\b/i,
  },
  {
    name: "literal 10M",
    regex: /\b10M\b/i,
  },
  {
    name: "10 * 1024 * 1024",
    regex: /10\s*\*\s*1024\s*\*\s*1024/,
  },
  {
    name: "10485760 (10MB en bytes)",
    regex: /\b10485760\b/,
  },
  {
    name: "palabras clave de límite de tamaño",
    regex:
      /\b(maxFileSize|max_file_size|max_size|maxSize|fileSize|file_limit|uploadLimit|upload_limit|maxBodyLength|maxContentLength|client_max_body_size|bodyParser\.json|express\.json|limits\s*:)/i,
  },
  {
    name: "subida de archivos (multer / uploadAsync)",
    regex: /\bmulter\b|uploadAsync\s*\(/i,
  },
];

// Colores bonitos para la terminal (opcional)
const colors = {
  reset: "\x1b[0m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
  bold: "\x1b[1m",
};

function isTextFile(filePath) {
  return TEXT_FILE_REGEX.test(filePath);
}

function walkDir(dir, results) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      walkDir(fullPath, results);
    } else if (entry.isFile()) {
      if (!isTextFile(fullPath)) continue;
      scanFile(fullPath, results);
    }
  }
}

function scanFile(filePath, results) {
  let content;
  try {
    content = fs.readFileSync(filePath, "utf8");
  } catch (e) {
    // Archivo binario o sin permisos, ignoramos
    return;
  }

  const lines = content.split(/\r?\n/);

  lines.forEach((line, index) => {
    PATTERNS.forEach((pattern) => {
      if (pattern.regex.test(line)) {
        results.push({
          file: filePath,
          lineNumber: index + 1,
          line,
          pattern: pattern.name,
        });
      }
    });
  });
}

function main() {
  console.log(
    `${colors.cyan}${colors.bold}🔎 Buscando posibles límites de subida de archivos (10MB, maxFileSize, etc.) en:${colors.reset} ${ROOT}\n`
  );

  const results = [];
  walkDir(ROOT, results);

  if (results.length === 0) {
    console.log(
      `${colors.green || ""}✅ No se encontraron coincidencias evidentes de límites de 10MB en este proyecto.${colors.reset}`
    );
    console.log(
      `${colors.gray}👉 Revisa también el backend (quickchatx-backend, Nginx, etc.).${colors.reset}`
    );
    return;
  }

  // Agrupar por archivo
  const byFile = new Map();
  for (const r of results) {
    if (!byFile.has(r.file)) byFile.set(r.file, []);
    byFile.get(r.file).push(r);
  }

  for (const [file, items] of byFile.entries()) {
    console.log(
      `\n${colors.magenta}${colors.bold}📄 Archivo:${colors.reset} ${file}`
    );
    for (const item of items) {
      const trimmed = item.line.trim();
      const preview =
        trimmed.length > 140 ? trimmed.slice(0, 137) + "..." : trimmed;

      console.log(
        `${colors.yellow}  • [${item.lineNumber}] (${item.pattern})${colors.reset}`
      );
      console.log(`    ${colors.gray}${preview}${colors.reset}`);
    }
  }

  console.log(
    `\n${colors.bold}Total coincidencias:${colors.reset} ${results.length}`
  );
  console.log(
    `${colors.gray}👉 Revisa especialmente donde veas 10MB, 10485760, maxBodyLength, maxContentLength, maxFileSize, client_max_body_size, etc.${colors.reset}\n`
  );
}

main();
