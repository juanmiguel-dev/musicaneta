import fs from 'node:fs';
import path from 'node:path';

// Script para indexar una carpeta local de música a public/uploads/ de forma instantánea
const sourceFolder = process.argv[2];
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

if (!sourceFolder) {
  console.log('📌 Uso: node scripts/index-local-folder.js "C:\\Ruta\\A\\Tu\\Carpeta\\De\\Musica"');
  console.log('O bien coloca tus archivos directamente dentro de public/uploads/ e indexaremos automáticamente.');
  
  // Indexar lo que ya esté en public/uploads/
  const existingFiles = getAllAudioFiles(uploadsDir);
  console.log(`\n🔍 Escaneando public/uploads/ (${existingFiles.length} archivos)...`);
  
  let added = 0;
  for (const filePath of existingFiles) {
    const fileName = path.basename(filePath);
    if (fileName === 'metadata.json') continue;

    const existsInMeta = metaList.some((item) => item.id === fileName || item.audioUrl.endsWith(fileName));
    if (!existsInMeta) {
      const title = fileName.replace(/\.[^/.]+$/, '');
      metaList.push({
        id: fileName,
        title,
        artist: 'Artista Local',
        album: 'Álbum Local',
        duration: 180,
        audioUrl: `/uploads/${fileName}`,
        coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
      });
      added++;
    }
  }

  fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2));
  console.log(`✅ ${added} canciones nuevas indexadas en metadata.json. Total en biblioteca local: ${metaList.length}`);
  process.exit(0);
}

console.log(`\n📂 Copiando e indexando archivos desde: ${sourceFolder}...`);
const files = getAllAudioFiles(sourceFolder);

if (files.length === 0) {
  console.log('⚠️ No se encontraron archivos de audio.');
  process.exit(0);
}

let copied = 0;
for (const filePath of files) {
  const relativePath = path.relative(sourceFolder, filePath);
  const fileName = path.basename(filePath);

  const parts = relativePath.split(path.sep);
  let artist = 'Artista Local';
  let album = 'Álbum Local';
  let title = fileName.replace(/\.[^/.]+$/, '');

  if (parts.length >= 3) {
    artist = parts[parts.length - 3];
    album = parts[parts.length - 2];
  } else if (parts.length === 2) {
    album = parts[0];
  }

  const cleanFileName = `${Date.now()}-${fileName.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
  const destPath = path.join(uploadsDir, cleanFileName);

  fs.copyFileSync(filePath, destPath);

  metaList.push({
    id: cleanFileName,
    title,
    artist,
    album,
    duration: 180,
    audioUrl: `/uploads/${cleanFileName}`,
    coverUrl: 'https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80',
  });
  copied++;
}

fs.writeFileSync(metaPath, JSON.stringify(metaList, null, 2));
console.log(`🎉 ¡Éxito! ${copied} canciones copiadas e indexadas en la biblioteca local.`);
