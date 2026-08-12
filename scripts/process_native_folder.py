import os
import shutil
import json
import subprocess
import sys
import imageio_ffmpeg
import re

sys.stdout.reconfigure(encoding='utf-8')

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
project_root = os.getcwd()
uploads_dir = os.path.join(project_root, 'public', 'uploads')
native_dir = os.path.join(uploads_dir, 'native')

if not os.path.exists(native_dir):
    print("No se encontró la carpeta public/uploads/native.")
    exit(1)

print("Procesando carpeta curada 'native'...")

native_files = [f for f in os.listdir(native_dir) if os.path.isfile(os.path.join(native_dir, f))]

# Limpiar public/uploads/
for item in os.listdir(uploads_dir):
    if item == 'native':
        continue
    item_path = os.path.join(uploads_dir, item)
    if os.path.isdir(item_path):
        shutil.rmtree(item_path)
    else:
        os.remove(item_path)

meta_list = []
processed_count = 0

for fname in native_files:
    src_path = os.path.join(native_dir, fname)
    size_bytes = os.path.getsize(src_path)

    # Omitir archivos vacíos o corruptos (< 10 KB)
    if size_bytes < 10240:
        print(f"  - Omitiendo archivo vacío/corrupto ({size_bytes} bytes): {fname}")
        continue

    # Nombre de archivo seguro para URL y SO
    safe_filename = fname.replace(' ', '_').replace('🎶', '').replace('&', 'and')
    safe_filename = re.sub(r'[^a-zA-Z0-9._-]', '', safe_filename)
    if not safe_filename.lower().endswith('.mp3') and not safe_filename.lower().endswith('.wav'):
        safe_filename += '.mp3'

    dest_path = os.path.join(uploads_dir, safe_filename)
    shutil.copy2(src_path, dest_path)

    size_mb = os.path.getsize(dest_path) / (1024 * 1024)

    # Si algún archivo supera los 24 MB (límite de Cloudflare Pages es 25MB), comprimirlo
    if size_mb > 24.0:
        print(f"  Comprimiendo archivo grande ({size_mb:.1f} MB): {safe_filename}...")
        temp_path = os.path.join(uploads_dir, f"temp_{safe_filename}")
        cmd = [
            ffmpeg_exe,
            '-y',
            '-i', dest_path,
            '-codec:a', 'libmp3lame',
            '-b:a', '56k',
            temp_path
        ]
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0:
            os.remove(dest_path)
            os.rename(temp_path, dest_path)
            new_size_mb = os.path.getsize(dest_path) / (1024 * 1024)
            print(f"    -> Reducido a {new_size_mb:.1f} MB")
        else:
            print(f"    -> Error en compresión: {res.stderr.decode('utf-8', errors='ignore')}")

    title = os.path.splitext(fname)[0]

    meta_list.append({
        "id": safe_filename,
        "title": title,
        "artist": "Native",
        "album": "Colección Curada",
        "duration": 180,
        "audioUrl": f"/uploads/{safe_filename}",
        "coverUrl": "https://images.unsplash.com/photo-1614613535308-eb5fbd3d2c17?auto=format&fit=crop&w=400&q=80"
    })
    processed_count += 1
    print(f"  - Indexado: {title}")

# Eliminar carpeta native vacía
shutil.rmtree(native_dir)

# Guardar metadata.json
meta_path = os.path.join(uploads_dir, 'metadata.json')
with open(meta_path, 'w', encoding='utf-8') as f:
    json.dump(meta_list, f, indent=2, ensure_ascii=False)

print(f"\nProceso finalizado: {processed_count} canciones curadas indexadas en public/uploads/.")
