import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Script inteligente para sincronizar e indexar carpetas de música
// Detecta temas nuevos, renombres y eliminaciones sin duplicar subidas en Git

const args = process.argv.slice(2);
const shouldPush = args.includes('--push') || args.includes('-p');
const filteredArgs = args.filter((a) => a !== '--push' && a !== '-p');
const targetArg = filteredArgs[0];

const projectRoot = process.cwd();
const uploadsDir = path.join(projectRoot, 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const metaPath = path.join(uploadsDir, 'metadata.json');
let metaList = [];
if (fs.existsSync(metaPath)) {
  try {
    metaList = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  } catch (e) {}
}

function getAllAudioFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllAudioFiles(fullPath, arrayOfFiles);
    } else {
      const ext = path.extname(file).toLowerCase();
      if (['.wav', '.mp3', '.m4a', '.flac', '.ogg', '.aac'].includes(ext)) {
        arrayOfFiles.push(fullPath);
      }
    }
  });

  return arrayOfFiles;
}

function pushToGit() {
  console.log('\n🚀 Ejecutando Git add, commit y push inteligente...');
  try {
    execSync('git add -A public/uploads metadata.json', { stdio: 'inherit' });
    const commitMsg = `sync: actualizar biblioteca de música (agregar/renombrar/organizar listas)`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
    console.log('⬆️ Enviando únicamente los cambios a GitHub (git push origin main)...');
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('✅ ¡Sincronización en Git y despliegue en la nube completado!');
  } catch (err) {
    if (err.message.includes('nothing to commit')) {
      console.log('ℹ️ No hay cambios pendientes para subir.');
    } else {
      console.error('❌ Error al ejecutar Git:', err.message);
    }
  }
}

// Determinar el directorio a escanear
let sourceFolder = targetArg ? path.resolve(targetArg) : uploadsDir;
const isDirectUploads = sourceFolder === uploadsDir;

console.log(`\n📂 Escaneando e indexando archivos desde: ${sourceFolder}...`);
const files = getAllAudioFiles(sourceFolder);

let addedOrUpdated = 0;
const validAudioUrls = new Set();

for (const filePath of files) {
  const fileName = path.basename(filePath);
  if (fileName === 'metadata.json') continue;

  const relativePath = path.relative(sourceFolder, filePath);
  const parts = relativePath.split(path.sep);

  let folderPath = 'General';
  let artist = 'Artista Local';
  let album = 'Colección';
  let title = fileName.replace(/\.[^/.]+$/, '');

  if (parts.length > 1) {
    const folderParts = parts.slice(0, parts.length - 1);
    folderPath = folderParts.join(' / ');

    album = folderParts[folderParts.length - 1];
    if (folderParts.length >= 2) {
      artist = folderParts[folderParts.length - 2];
    } else {
      artist = folderParts[0];
    }
  }

  let finalAudioUrl = '';
  let trackId = '';

  if (isDirectUploads) {
    const webPath = relativePath.split(path.sep).join('/');
    finalAudioUrl = `/uploads/${webPath}`;
    trackId = webPath;
  } else {
    const safeBaseName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const cleanFileName = `${Date.now()}-${safeBaseName}`;
    const destPath = path.join(uploadsDir, cleanFileName);
    fs.copyFileSync(filePath, destPath);
    finalAudioUrl = `/uploads/${cleanFileName}`;
    trackId = cleanFileName;
  }

  validAudioUrls.add(finalAudioUrl);

  const existingIdx = metaList.findIndex((item) => item.id === trackId || item.audioUrl === finalAudioUrl);

  const trackObj = {
    id: trackId,
    title,
    artist,
    album,
    folder: folderPath,
    duration: 180,
    audioUrl: finalAudioUrl,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
  };

  if (existingIdx !== -1) {
    metaList[existingIdx] = { ...metaList[existingIdx], ...trackObj };
  } else {
    metaList.push(trackObj);
    addedOrUpdated++;
    console.log(`  🎵 Nueva pista o renombrada: "${title}" -> Lista: "${folderPath}"`);
  }
}

// Limpiar entradas huérfanas en metadata.json si algún archivo fue renombrado o borrado
const initialCount = metaList.length;
metaList = metaList.filter((item) => {
  const localRelative = item.audioUrl.replace(/^\/uploads\//, '');
  const fullDiskPath = path.join(uploadsDir, ...localRelative.split('/'));
  return fs.existsSync(fullDiskPath);
});

if (metaList.length < initialCount) {
  console.log(`🧹 Se limpiaron ${initialCount - metaList.length} entradas antiguas/renombradas de metadata.json.`);
}

fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2), 'utf-8');
console.log(`\n🎉 ¡Éxito! Biblioteca actualizada. Total de canciones activas: ${metaList.length}`);

if (shouldPush) {
  pushToGit();
} else {
  console.log('\n💡 Para hacer commit y git push automáticamente, incluye la bandera --push:');
  console.log('   npm run push-music');
}
