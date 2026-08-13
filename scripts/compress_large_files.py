import os
import sys
import subprocess
import imageio_ffmpeg

sys.stdout.reconfigure(encoding='utf-8')

ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
uploads_dir = os.path.join(os.getcwd(), 'public', 'uploads')

print(f"Buscando archivos mayores a 22MB en: {uploads_dir}...")

compressed_count = 0
for root, dirs, files in os.walk(uploads_dir):
    for f in files:
        if f.endswith('.json'):
            continue
        filepath = os.path.join(root, f)
        size_mb = os.path.getsize(filepath) / (1024 * 1024)
        if size_mb > 22.0:
            print(f"⚡ Comprimiendo {f} ({size_mb:.2f} MB)...")
            temp_path = os.path.join(root, f"temp_{f}")
            cmd = [
                ffmpeg_exe, '-y',
                '-i', filepath,
                '-codec:a', 'libmp3lame',
                '-b:a', '64k',
                temp_path
            ]
            res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            if res.returncode == 0:
                os.remove(filepath)
                os.rename(temp_path, filepath)
                new_size = os.path.getsize(filepath) / (1024 * 1024)
                print(f"  ✅ Reducido exitosamente a {new_size:.2f} MB")
                compressed_count += 1
            else:
                print(f"  ❌ Error en ffmpeg: {res.stderr.decode('utf-8', errors='ignore')}")

print(f"\nFinalizado. {compressed_count} archivos comprimidos.")
