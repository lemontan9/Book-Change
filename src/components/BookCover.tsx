import React, { useState } from 'react';
import { BookCardEcoArtwork, getEcoCardTheme } from './EcoIllustrations';

interface BookCoverProps {
  title: string;
  category: string;
  code: string;
  coverImage?: string;
  price?: number;
  className?: string;
  aspectRatio?: 'portrait' | 'square';
}

export const MOCK_COVER_PALETTE = ['#DCE7C4', '#EFE2CA', '#F4EDE0', '#D8E4C7'] as const;

export const getMockCoverTheme = (seedStr: string) => {
  const eco = getEcoCardTheme(seedStr);
  return {
    bg: eco.bg,
    variant: eco.variant,
    textColor: '#3E2723',
    subColor: '#6D5C50',
    accentColor: '#4B5E26',
    borderCol: 'rgba(125, 80, 46, 0.12)',
  };
};

export const BookCover: React.FC<BookCoverProps> = ({
  title,
  category,
  code,
  coverImage,
  price,
  className = '',
  aspectRatio = 'portrait',
}) => {
  const [imageFailed, setImageFailed] = useState(false);
  const theme = getMockCoverTheme(code || title || 'cmu');
  const isLCode = code.startsWith('L');

  return (
    <div
      className={`relative group overflow-hidden rounded-2xl shadow-xs border border-[#EAE0D2] transition-all duration-200 select-none bg-white ${
        aspectRatio === 'portrait' ? 'aspect-[3/4]' : 'aspect-square'
      } ${className}`}
    >
      {coverImage && !imageFailed ? (
        <img
          src={coverImage}
          alt={title}
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          style={{ backgroundColor: theme.bg }}
          className="w-full h-full p-3 flex flex-col items-center justify-between relative overflow-hidden"
        >
          {/* Top Code Pill */}
          <div className="w-full flex items-center justify-between gap-1 z-10">
            <span
              className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-full shadow-2xs ${
                isLCode ? 'bg-[#7D502E] text-white' : 'bg-[#4B5E26] text-white'
              }`}
            >
              {code}
            </span>
            {price !== undefined && price > 0 && (
              <span className="text-[10px] font-mono font-semibold text-[#5C3A21] tabular-nums">
                ฿{price}
              </span>
            )}
          </div>

          {/* Eco Vector Artwork */}
          <div className="my-auto flex flex-col items-center justify-center z-10">
            <BookCardEcoArtwork variant={theme.variant} className="w-16 h-12 sm:w-20 sm:h-14" />
            <h4
              className="font-bold text-xs leading-snug line-clamp-2 break-words text-center text-[#3E2723] mt-1.5 px-1"
              title={title}
            >
              {title || 'หนังสือไม่มีชื่อ'}
            </h4>
          </div>

          {/* Bottom Category Text */}
          <div className="text-[10px] text-[#6D5C50] truncate max-w-full font-medium z-10">
            {category}
          </div>
        </div>
      )}

      {/* Floating Code Badge for photo covers */}
      {coverImage && !imageFailed && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shadow-md ${
              isLCode ? 'bg-[#7D502E] text-white' : 'bg-[#4B5E26] text-white'
            }`}
          >
            {code}
          </span>
        </div>
      )}
    </div>
  );
};

export interface MockBookCoverProps {
  title: string;
  category?: string;
  code?: string;
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const MockBookCover: React.FC<MockBookCoverProps> = ({
  title,
  code,
  seed,
  size = 'md',
  className = '',
}) => {
  const theme = getMockCoverTheme(seed || code || title || 'cmu');

  return (
    <div
      style={{ backgroundColor: theme.bg }}
      className={`w-full h-full relative overflow-hidden flex flex-col items-center justify-center p-2.5 sm:p-3 select-none ${className}`}
    >
      <BookCardEcoArtwork
        variant={theme.variant}
        className={
          size === 'sm'
            ? 'w-14 h-11 mb-1'
            : size === 'lg'
            ? 'w-24 h-18 mb-2'
            : 'w-20 h-14 mb-1.5'
        }
      />

      <h4
        className={`font-bold leading-snug line-clamp-2 break-words text-center text-[#3E2723] px-1 ${
          size === 'sm' ? 'text-[11px]' : size === 'lg' ? 'text-sm sm:text-base' : 'text-[13px]'
        }`}
        title={title}
      >
        {title || 'หนังสือไม่มีชื่อ'}
      </h4>
    </div>
  );
};
