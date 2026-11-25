import { useState } from 'react';
import { getInitials } from '../utils/imageCompression';

interface AvatarProps {
  name: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg' | 'card';
  className?: string;
}

export function Avatar({ name, src, size = 'md', className = '' }: AvatarProps) {
  const [imgError, setImgError] = useState(false);
  const showImage = Boolean(src && !imgError);
  const initials = getInitials(name);

  if (size === 'card') {
    return (
      <div
        className={`relative w-full aspect-[3/4] overflow-hidden bg-gradient-to-br from-[#1D1822] via-[#151218] to-[#26141D] flex items-center justify-center ${className}`}
      >
        {showImage ? (
          <img
            src={src}
            alt={name}
            referrerPolicy="no-referrer"
            onError={() => setImgError(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 select-none px-6 text-center">
            <div className="w-24 h-24 rounded-full bg-rose-600/15 border border-rose-500/30 flex items-center justify-center text-3xl font-editorial font-semibold text-rose-200 tracking-wide">
              {initials}
            </div>
            <span className="text-xs text-zinc-400">Aucune photo ajoutée</span>
          </div>
        )}
      </div>
    );
  }

  const dims =
    size === 'sm'
      ? 'w-9 h-9 text-xs'
      : size === 'lg'
        ? 'w-20 h-20 text-2xl'
        : 'w-11 h-11 text-sm';

  return (
    <div
      className={`relative shrink-0 rounded-full overflow-hidden bg-gradient-to-br from-[#231924] to-[#17131A] border border-white/10 flex items-center justify-center font-medium text-rose-200 select-none ${dims} ${className}`}
    >
      {showImage ? (
        <img
          src={src}
          alt={name}
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
