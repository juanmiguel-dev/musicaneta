import os
import subprocess
import json
import sys
import imageio_ffmpeg

sys.stdout.reconfigure(encoding='utf-8')

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
uploads_dir = os.path.join(os.getcwd(), 'public', 'uploads')
meta_path = os.path.join(uploads_dir, 'metadata.json')

if not os.path.exists(uploads_dir):
    print("No uploads directory found.")
    exit(0)

with open(meta_path, 'r', encoding='utf-8') as f:
    meta_list = json.load(f)

replacements = {}

for fname in os.listdir(uploads_dir):
    fpath = os.path.join(uploads_dir, fname)
    if not os.path.isfile(fpath) or fname == 'metadata.json':
        continue

    size_mb = os.path.getsize(fpath) / (1024 * 1024)
    if size_mb > 24.0:
        print(f"Optimizando archivo de {size_mb:.2f} MB: {fname}...")
        
        base_name, _ = os.path.splitext(fname)
        new_fname = f"{base_name}.mp3"
        new_fpath = os.path.join(uploads_dir, new_fname)
        
        temp_fpath = os.path.join(uploads_dir, f"opt_{base_name}.mp3")

        cmd = [
            ffmpeg_exe,
            '-y',
            '-i', fpath,
            '-codec:a', 'libmp3lame',
            '-b:a', '256k',
            temp_fpath
        ]
        
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
        if res.returncode == 0:
            new_size_mb = os.path.getsize(temp_fpath) / (1024 * 1024)
            print(f"  -> Reducido a {new_size_mb:.2f} MB")
            
            if os.path.exists(fpath):
                os.remove(fpath)
            
            if os.path.exists(new_fpath) and new_fpath != temp_fpath:
                os.remove(new_fpath)

            os.rename(temp_fpath, new_fpath)
            replacements[fname] = new_fname
        else:
            print(f"  -> Error al procesar {fname}: {res.stderr.decode('utf-8', errors='ignore')}")

if replacements:
    for item in meta_list:
        old_id = item.get('id', '')
        old_url = item.get('audioUrl', '')
        
        for old_fname, new_fname in replacements.items():
            if old_id == old_fname:
                item['id'] = new_fname
            if old_url.endswith(old_fname):
                item['audioUrl'] = item['audioUrl'].replace(old_fname, new_fname)
                
    with open(meta_path, 'w', encoding='utf-8') as f:
        json.dump(meta_list, f, indent=2, ensure_ascii=False)
        
    print(f"\nProceso finalizado: Se optimizaron {len(replacements)} archivos grandes.")
else:
    print("\nTodos los archivos ya están por debajo del límite de 24 MB.")
