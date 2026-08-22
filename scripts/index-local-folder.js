import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

// Script inteligente para sincronizar e indexar carpetas de música
// Detecta temas nuevos, renombres y asigna portadas variadas

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

const RANDOM_COVERS = [
  '/covers/cover_podcast.jpg',
  '/covers/cover_cosmic.jpg',
  '/covers/cover_native.jpg',
  '/covers/cover_vinyl.jpg',
  '/covers/cover_cyber.jpg',
  'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1508700115892-45ecd05ae2ad?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1520523839898-5071282543e2?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1465847899084-d164df4dedc6?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?auto=format&fit=crop&w=600&q=80',
  'https://images.unsplash.com/photo-1446776811953-b23d57bd21aa?auto=format&fit=crop&w=600&q=80'
];

function getCoverForTrack(title, folder, id) {
  const lowerFolder = (folder || '').toLowerCase();
  const lowerTitle = (title || '').toLowerCase();
  if (lowerFolder.includes('podcast') || lowerTitle.includes('podcast')) {
    if (lowerTitle.includes('espejismo') || lowerTitle.includes('conciencia') || lowerTitle.includes('kozyrev') || lowerTitle.includes('universo') || lowerTitle.includes('reino')) {
      return '/covers/cover_cosmic.jpg';
    }
    return '/covers/cover_podcast.jpg';
  }
  if (lowerFolder.includes('native') || lowerTitle.includes('lakota') || lowerTitle.includes('spirit') || lowerTitle.includes('ancestor') || lowerTitle.includes('drum')) {
    return '/covers/cover_native.jpg';
  }
  let hash = 0;
  const str = id || title || 'musicaneta';
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) & 0xffffffff;
  }
  const index = Math.abs(hash) % RANDOM_COVERS.length;
  return RANDOM_COVERS[index];
}

function cleanTitleString(raw) {
  return raw
    .replace(/^podcast_/i, '')
    .replace(/__/g, ' – ')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function getAllAudioFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'covers') {
        arrayOfFiles = getAllAudioFiles(fullPath, arrayOfFiles);
      }
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
    execSync('git add -A public/uploads metadata.json public/covers', { stdio: 'inherit' });
    const commitMsg = `sync: actualizar biblioteca de música con portadas variadas`;
    execSync(`git commit -m "${commitMsg}"`, { stdio: 'inherit' });
    console.log('⬆️ Enviando cambios a GitHub (git push origin main)...');
    execSync('git push origin main', { stdio: 'inherit' });
    console.log('✅ ¡Sincronización y despliegue completado!');
  } catch (err) {
    if (err.message && err.message.includes('nothing to commit')) {
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
  let rawTitle = fileName.replace(/\.[^/.]+$/, '');
  let title = cleanTitleString(rawTitle);

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

  if (filePath.startsWith(uploadsDir)) {
    const relToUploads = path.relative(uploadsDir, filePath);
    const webPath = relToUploads.split(path.sep).join('/');
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

  const coverUrl = getCoverForTrack(title, folderPath, trackId);

  const trackObj = {
    id: trackId,
    title,
    artist,
    album,
    folder: folderPath,
    duration: 180,
    audioUrl: finalAudioUrl,
    coverUrl,
  };

  if (existingIdx !== -1) {
    metaList[existingIdx] = { ...metaList[existingIdx], ...trackObj };
  } else {
    metaList.unshift(trackObj);
    addedOrUpdated++;
    console.log(`  🎵 Nueva pista: "${title}" -> Lista: "${folderPath}"`);
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
console.log(`\n🎉 ¡Éxito! Biblioteca actualizada con títulos limpios y portadas variadas. Total pistas: ${metaList.length}`);

if (shouldPush) {
  pushToGit();
}
