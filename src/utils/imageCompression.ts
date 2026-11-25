export async function compressProfileImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Impossible de lire le fichier image.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Format d’image non reconnu.'));
      img.onload = () => {
        const maxSide = 400;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxSide) {
            height = Math.round((height * maxSide) / width);
            width = maxSide;
          }
        } else if (height > maxSide) {
          width = Math.round((width * maxSide) / height);
          height = maxSide;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Contexte graphique indisponible.'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        let quality = 0.82;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);
        while (dataUrl.length > 260_000 && quality > 0.35) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        if (dataUrl.length > 340_000) {
          reject(new Error('L’image reste trop volumineuse après compression.'));
          return;
        }

        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function getInitials(name?: string): string {
  const cleaned = (name ?? '').trim();
  if (!cleaned) return 'E';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}
