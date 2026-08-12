import os
import shutil
import json
import re
import sys

sys.stdout.reconfigure(encoding='utf-8')

project_root = os.getcwd()
uploads_dir = os.path.join(project_root, 'public', 'uploads')
podcasts_dir = os.path.join(uploads_dir, 'podcasts')

if not os.path.exists(podcasts_dir):
    print("No se encontró la carpeta public/uploads/podcasts.")
    exit(1)

meta_path = os.path.join(uploads_dir, 'metadata.json')
meta_list = []
if os.path.exists(meta_path):
    with open(meta_path, 'r', encoding='utf-8') as f:
        try:
            meta_list = json.load(f)
        except Exception:
            meta_list = []

podcast_files = [f for f in os.listdir(podcasts_dir) if os.path.isfile(os.path.join(podcasts_dir, f))]

print(f"📂 Procesando {len(podcast_files)} episodios de Podcast...")

added_count = 0
for fname in podcast_files:
    src_path = os.path.join(podcasts_dir, fname)
    size_bytes = os.path.getsize(src_path)

    if size_bytes < 1024:
        print(f"  - Omitiendo archivo vacío: {fname}")
        continue

    # Crear nombre de archivo seguro
    clean_base = fname.replace(' ', '_').replace('&', 'and')
    safe_filename = "Podcast_" + re.sub(r'[^a-zA-Z0-9._-]', '', clean_base)
    if not safe_filename.lower().endswith('.mp3'):
        safe_filename += '.mp3'

    dest_path = os.path.join(uploads_dir, safe_filename)
    shutil.copy2(src_path, dest_path)

    # Título amigable
    title = os.path.splitext(fname)[0].replace('_', ' ').replace('  ', ' ').strip()

    meta_list.append({
        "id": safe_filename,
        "title": title,
        "artist": "Podcasts",
        "album": "Podcasts",
        "duration": 180,
        "audioUrl": f"/uploads/{safe_filename}",
        "coverUrl": "https://images.unsplash.com/photo-1590602847861-f357a9332bbc?auto=format&fit=crop&w=400&q=80"
    })
    added_count += 1
    print(f"  ✔ Indexado: {title}")

# Eliminar carpeta podcasts vacía
shutil.rmtree(podcasts_dir)

with open(meta_path, 'w', encoding='utf-8') as f:
    json.dump(meta_list, f, indent=2, ensure_ascii=False)

print(f"\n🎉 ¡Proceso finalizado! {added_count} episodios de podcast indexados en la categoría 'Podcasts'. Total en biblioteca: {len(meta_list)}.")
