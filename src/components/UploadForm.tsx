import React, { useState } from 'react';

export default function UploadForm() {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [album, setAlbum] = useState('');
  const [status, setStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [progress, setProgress] = useState(0);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      setFile(selected);
      if (!title) {
        // Asignar título automáticamente limpiando la extensión del nombre de archivo
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrorMessage('Por favor selecciona un archivo de audio MP3.');
      return;
    }

    try {
      setStatus('uploading');
      setProgress(10);

      // 1. Obtener Presigned URL o Endpoint de subida desde /api/upload
      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || 'audio/mpeg',
          title,
          artist,
          album,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al solicitar la presigned URL de subida a R2');
      }

      const { uploadUrl, isDirectUpload } = await res.json();
      setProgress(40);

      // 2. Subir directamente el binario a Cloudflare R2 vía Presigned URL (o directamente al Worker)
      if (isDirectUpload) {
        // En caso de que el backend reciba directamente por R2 binding
        const formData = new FormData();
        formData.append('file', file);
        formData.append('title', title);
        formData.append('artist', artist);
        formData.append('album', album);

        const uploadRes = await fetch('/api/upload', {
          method: 'PUT',
          body: formData,
        });

        if (!uploadRes.ok) throw new Error('Error durante la subida directa a R2');
      } else {
        // Subida directa al Bucket vía S3 Presigned URL
        const uploadRes = await fetch(uploadUrl, {
          method: 'PUT',
          headers: {
            'Content-Type': file.type || 'audio/mpeg',
          },
          body: file,
        });

        if (!uploadRes.ok) throw new Error('Falló la subida binaria hacia Cloudflare R2.');
      }

      setProgress(100);
      setStatus('success');
      setFile(null);
      setTitle('');
      setArtist('');
      setAlbum('');
    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMessage(err.message || 'Ocurrió un error inesperado durante la carga.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-xl mx-auto bg-zinc-900 p-8 rounded-2xl border border-zinc-800 shadow-2xl">
      <h2 className="text-xl font-bold text-white mb-4">Subir nueva pista a Cloudflare R2</h2>

      {status === 'success' && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm">
          ¡Canción subida con éxito a Cloudflare R2! Ya está disponible en la biblioteca.
        </div>
      )}

      {status === 'error' && (
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {errorMessage}
        </div>
      )}

      {/* Selector de Archivos Drag & Drop */}
      <div className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 rounded-xl p-6 text-center transition-colors">
        <input
          type="file"
          accept="audio/mp3,audio/mpeg,audio/wav"
          onChange={handleFileChange}
          className="hidden"
          id="audio-file-input"
        />
        <label htmlFor="audio-file-input" className="cursor-pointer block">
          <div className="w-12 h-12 rounded-full bg-zinc-800 text-emerald-400 flex items-center justify-center mx-auto mb-3">
            <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
              <path d="M9 16h6v-6h4l-7-7-7 7h4v6zm-4 2h14v2H5v-2z" />
            </svg>
          </div>
          <span className="text-sm font-medium text-zinc-200 block">
            {file ? file.name : 'Haz clic o arrastra un archivo MP3 aquí'}
          </span>
          <span className="text-xs text-zinc-500 mt-1 block">Soporta MP3, WAV (máx. 50MB)</span>
        </label>
      </div>

      {/* Metadatos */}
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Título de la canción
          </label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ej. Midnight City"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Artista
          </label>
          <input
            type="text"
            required
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
            placeholder="ej. M83"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">
            Álbum (Opcional)
          </label>
          <input
            type="text"
            value={album}
            onChange={(e) => setAlbum(e.target.value)}
            placeholder="ej. Hurry Up, We're Dreaming"
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:border-emerald-500 transition-colors"
          />
        </div>
      </div>

      {/* Barra de progreso */}
      {status === 'uploading' && (
        <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden">
          <div
            className="bg-emerald-500 h-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Botón de Enviar */}
      <button
        type="submit"
        disabled={status === 'uploading'}
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 disabled:bg-zinc-800 text-black font-bold rounded-xl transition-colors shadow-lg shadow-emerald-500/20"
      >
        {status === 'uploading' ? 'Subiendo a Cloudflare R2...' : 'Subir Canción'}
      </button>
    </form>
  );
}
