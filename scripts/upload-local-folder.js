import fs from 'node:fs';
import path from 'node:path';

// Script para subir carpetas locales directamente a Cloudflare R2 a través de la API
const TARGET_FOLDER = process.argv[2] || 'C:\\Users\\Usuario\\Desktop\\C O D E X\\Sounddraw';
const API_URL = process.env.API_URL || 'http://localhost:4321/api/upload';

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

async function uploadFolder() {
  console.log(`\n🎵 Escaneando carpeta local: ${TARGET_FOLDER}...`);
  const audioFiles = getAllAudioFiles(TARGET_FOLDER);

  if (audioFiles.length === 0) {
    console.log('⚠️ No se encontraron archivos de audio en la ruta especificada.');
    return;
  }

  console.log(`✅ ${audioFiles.length} archivos de audio encontrados. Iniciando subida...\n`);

  for (let i = 0; i < audioFiles.length; i++) {
    const filePath = audioFiles[i];
    const relativePath = path.relative(TARGET_FOLDER, filePath);
    const fileName = path.basename(filePath);

    // Extraer artista/álbum si existe subcarpeta
    const parts = relativePath.split(path.sep);
    let artist = 'Soundraw';
    let album = 'Soundraw Pack';
    let title = fileName.replace(/\.[^/.]+$/, '');

    if (parts.length >= 3) {
      artist = parts[parts.length - 3];
      album = parts[parts.length - 2];
    } else if (parts.length === 2) {
      album = parts[0];
    }

    console.log(`[${i + 1}/${audioFiles.length}] Subiendo: ${title} (${artist} - ${album})...`);

    try {
      const fileBuffer = fs.readFileSync(filePath);
      const ext = path.extname(fileName).toLowerCase();
      const contentType = ext === '.wav' ? 'audio/wav' : 'audio/mpeg';

      // 1. Obtener URL de carga
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: fileName,
          contentType,
          title,
          artist,
          album,
        }),
      });

      if (!res.ok) {
        console.error(`❌ Error en respuesta API para ${fileName}: ${res.statusText}`);
        continue;
      }

      const { uploadUrl, isDirectUpload } = await res.json();

      if (isDirectUpload) {
        const upRes = await fetch(API_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': contentType,
            'x-filename': encodeURIComponent(fileName),
            'x-title': encodeURIComponent(title),
            'x-artist': encodeURIComponent(artist),
            'x-album': encodeURIComponent(album),
          },
          body: fileBuffer,
        });
        if (!upRes.ok) console.error(`   ❌ Error R2 al subir ${fileName}`);
        else console.log(`   ✔ Exitoso`);
      } else {
        const upRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: fileBuffer,
        });
        if (!upRes.ok) console.error(`   ❌ Error S3 Presigned URL al subir ${fileName}`);
        else console.log(`   ✔ Exitoso`);
      }
    } catch (err) {
      console.error(`   ❌ Omitiendo ${fileName} por error:`, err);
    }
  }

  console.log('\n🎉 ¡Proceso de subida finalizado con éxito!');
}

uploadFolder();
