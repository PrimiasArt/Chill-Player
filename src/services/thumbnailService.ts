/**
 * Service to extract video metadata and generate instant canvas thumbnails
 */
export const thumbnailService = {
  extractVideoMeta(file: File | Blob): Promise<{ duration: number; thumbnail?: string }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;

      const url = URL.createObjectURL(file);
      video.src = url;

      let resolved = false;
      const cleanUpAndResolve = (duration = 0, thumbnail?: string) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        video.src = '';
        video.remove();
        resolve({ duration, thumbnail });
      };

      // 4s timeout fallback in case of unsupported codec
      const timer = setTimeout(() => {
        cleanUpAndResolve(video.duration || 0);
      }, 4000);

      video.onloadedmetadata = () => {
        const dur = video.duration || 0;
        if (!isFinite(dur) || dur <= 0) {
          cleanUpAndResolve(0);
          return;
        }
        // Seek to 1s or 10% for a representative frame
        video.currentTime = Math.min(2, Math.max(0.5, dur * 0.1));
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const aspect = (video.videoWidth && video.videoHeight) ? video.videoWidth / video.videoHeight : 16 / 9;
          canvas.width = 360;
          canvas.height = Math.round(360 / aspect);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const thumb = canvas.toDataURL('image/jpeg', 0.7);
            cleanUpAndResolve(video.duration || 0, thumb);
            return;
          }
        } catch (e) {
          console.warn('Thumbnail generation failed:', e);
        }
        cleanUpAndResolve(video.duration || 0);
      };

      video.onerror = () => {
        cleanUpAndResolve(0);
      };
    });
  }
};
