#!/usr/bin/env node
/**
 * 🔍 debug-android-config.js
 * QuickChatX — inspección rápida de:
 *  - android/app/src/main/AndroidManifest.xml
 *  - android/app/build.gradle
 *  - app.json (permisos android / plugins)
 *
 * Uso:
 *   cd /home/dev/quickchatx
 *   node scripts/debug-android-config.js
 */

const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();

function readIfExists(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function section(title) {
  console.log("\n" + "═".repeat(60));
  console.log(" " + title);
  console.log("═".repeat(60) + "\n");
}

function checkAndroidManifest() {
  const manifestPath = "android/app/src/main/AndroidManifest.xml";
  const content = readIfExists(manifestPath);

  section(`📁 AndroidManifest: ${manifestPath}`);

  if (!content) {
    console.log("⚠️ No se encontró AndroidManifest.xml en android/app/src/main/");
    return;
  }

  const lines = content.split("\n");

  console.log("🔎 uses-permission encontrados:\n");
  lines.forEach((line, idx) => {
    if (line.includes("<uses-permission")) {
      console.log(
        `  [${idx + 1}] ${line.trim().replace(/\s+/g, " ")}`
      );
    }
  });

  const permsToCheck = [
    "android.permission.INTERNET",
    "android.permission.CAMERA",
    "android.permission.RECORD_AUDIO",
    "android.permission.READ_EXTERNAL_STORAGE",
    "android.permission.WRITE_EXTERNAL_STORAGE",
    "android.permission.READ_MEDIA_VIDEO",
    "android.permission.READ_MEDIA_IMAGES",
  ];

  console.log("\n✅ Chequeo básico de permisos importantes:\n");

  const has = (p) => content.includes(p);

  permsToCheck.forEach((perm) => {
    const ok = has(perm);
    console.log(
      `${ok ? "  ✔" : "  ⚠"} ${perm} ${
        ok ? "" : "→ no aparece en el manifest"
      }`
    );
  });

  const hasNetworkConfig = content.includes("android:networkSecurityConfig");
  if (hasNetworkConfig) {
    console.log(
      "\nℹ️ Se encontró android:networkSecurityConfig → revisa que no bloquee tráfico hacia tu API."
    );
  }

  const hasCleartextFlag = content.includes(
    "android:usesCleartextTraffic"
  );
  if (hasCleartextFlag) {
    console.log(
      "ℹ️ android:usesCleartextTraffic está declarado (bien si usas HTTP en dev)."
    );
  }

  console.log("\n(Recuerda: aquí NO hay ningún límite de tamaño de subida, solo permisos.)");
}

function checkGradle() {
  const gradlePath = "android/app/build.gradle";
  const content = readIfExists(gradlePath);

  section(`⚙️ Gradle: ${gradlePath}`);

  if (!content) {
    console.log("⚠️ No se encontró android/app/build.gradle");
    return;
  }

  const interestingPatterns = [
    /maxRequestSize/i,
    /maxFileSize/i,
    /multipart/i,
    /okhttp/i,
    /retrofit/i,
  ];

  const lines = content.split("\n");
  let foundAny = false;

  lines.forEach((line, idx) => {
    if (interestingPatterns.some((re) => re.test(line))) {
      if (!foundAny) {
        console.log("🔎 Posibles configuraciones relacionadas con red/subidas:\n");
        foundAny = true;
      }
      console.log(`  [${idx + 1}] ${line.trim()}`);
    }
  });

  if (!foundAny) {
    console.log("✅ No se encontraron configs raras de tamaño en build.gradle (normal).");
  }
}

function checkAppJson() {
  const appJsonPath = "app.json";
  const content = readIfExists(appJsonPath);

  section(`📄 app.json: permisos android / plugins`);

  if (!content) {
    console.log("⚠️ No se encontró app.json en la raíz del proyecto.");
    return;
  }

  let json;
  try {
    json = JSON.parse(content);
  } catch (e) {
    console.log("❌ Error parseando app.json:", e.message);
    return;
  }

  const expo = json.expo || json;

  console.log("🔹 Nombre:", expo.name);
  console.log("🔹 Slug:", expo.slug);
  if (expo.android) {
    console.log("🔹 android.package:", expo.android.package);
  }

  // Permisos android
  const androidPerms = expo?.android?.permissions;
  if (androidPerms === null) {
    console.log("\n📋 android.permissions = null → se usan permisos por defecto de Expo.");
  } else if (Array.isArray(androidPerms)) {
    console.log("\n📋 android.permissions definidos explícitamente:\n");
    androidPerms.forEach((p) => console.log("  - " + p));
  } else {
    console.log("\n📋 android.permissions no definido → Expo usa permisos por defecto.");
  }

  // Plugins relevantes (image-picker, video, etc.)
  const plugins = expo.plugins || [];
  if (plugins.length) {
    console.log("\n🔌 Plugins declarados en app.json:\n");
    plugins.forEach((p) => {
      if (Array.isArray(p)) {
        console.log("  -", JSON.stringify(p[0]));
      } else {
        console.log("  -", JSON.stringify(p));
      }
    });
  } else {
    console.log("\nℹ️ No hay plugins declarados en expo.plugins (también puede ser normal).");
  }

  console.log(
    "\n(Importante: aquí tampoco se define límite de tamaño de subida; solo permisos y config de Expo.)"
  );
}

function main() {
  console.log("🔍 QuickChatX — Debug configuración Android / app.json\n");
  checkAndroidManifest();
  checkGradle();
  checkAppJson();
  console.log("\n✅ Fin de análisis (Android). Si todo se ve normal, el 413 sigue apuntando al backend.");
}

main();
