import React, { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  title: string;
  category: string;
  code: string;
  coverImage?: string;
  price?: number;
  className?: string;
  aspectRatio?: 'portrait' | 'square';
}

const CATEGORY_GRADIENTS: Record<string, { bg: string; text: string }> = {
  'นวนิยาย': {
    bg: 'from-[#7A4B30] to-[#4A2510]',
    text: 'text-white',
  },
  'นวนิยาย/วรรณกรรม': {
    bg: 'from-[#7A4B30] to-[#4A2510]',
    text: 'text-white',
  },
  'หนังสือทั่วไป': {
    bg: 'from-[#2A3B4C] to-[#16222D]',
    text: 'text-white',
  },
  'หนังสือเรียน': {
    bg: 'from-[#3D5A5B] to-[#25393A]',
    text: 'text-white',
  },
  'หนังสือเยาวชน': {
    bg: 'from-[#9C6644] to-[#7F4F24]',
    text: 'text-white',
  },
  'การ์ตูน': {
    bg: 'from-[#8C5E58] to-[#593D3B]',
    text: 'text-white',
  },
  'เรื่องสั้น': {
    bg: 'from-[#586F6B] to-[#344340]',
    text: 'text-white',
  },
  'พัฒนาตนเอง/จิตวิทยา': {
    bg: 'from-[#6B5B95] to-[#483D68]',
    text: 'text-white',
  },
};

const DEFAULT_THEME = {
  bg: 'from-[#7A4B30] to-[#2A3B4C]',
  text: 'text-white',
};

export const MOCK_COVER_PALETTE = ['#f8f6f2', '#d9d4cc', '#aeb9ae', '#6b6b6b'] as const;

export const getMockCoverTheme = (seedStr: string) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const colorIndex = Math.abs(hash) % MOCK_COVER_PALETTE.length;
  const bg = MOCK_COVER_PALETTE[colorIndex];
  const isDark = bg === '#6b6b6b';

  return {
    bg,
    textColor: isDark ? '#FFFFFF' : '#263238',
    subColor: isDark ? 'rgba(255, 255, 255, 0.8)' : '#6B5E55',
    accentColor: isDark ? '#FAF5EE' : '#7A4B30',
    spineShadow: isDark
      ? 'linear-gradient(to right, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.08) 80%, rgba(255,255,255,0.1) 100%)'
      : 'linear-gradient(to right, rgba(0,0,0,0.14) 0%, rgba(0,0,0,0.04) 80%, rgba(255,255,255,0.35) 100%)',
    borderCol: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.08)',
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
      className={`relative group overflow-hidden rounded-2xl shadow-xs border border-[#E8ECF2] transition-all duration-200 active:scale-95 select-none bg-white ${
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
        /* Styled Mock Book Cover using #f8f6f2, #d9d4cc, #aeb9ae, #6b6b6b with title as cover text */
        <div
          style={{ backgroundColor: theme.bg }}
          className="w-full h-full p-3 sm:p-4 flex flex-col justify-between relative overflow-hidden"
        >
          {/* Subtle book spine shadow on the left */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2.5 pointer-events-none z-10"
            style={{ background: theme.spineShadow }}
          />
          <div
            className="absolute left-2.5 top-0 bottom-0 w-[1px] pointer-events-none z-10"
            style={{ backgroundColor: theme.borderCol }}
          />

          {/* Top header on book */}
          <div className="flex items-start justify-between gap-1.5 z-10 pl-2">
            <span
              className={`text-[10px] font-mono font-bold tracking-wider px-2 py-0.5 rounded-md shadow-xs ${
                isLCode
                  ? 'bg-white text-[#7A4B30]'
                  : 'bg-[#2A3B4C] text-white border border-white/20'
              }`}
            >
              {code}
            </span>
            <span
              style={{ color: theme.subColor }}
              className="text-[10px] font-medium truncate max-w-[80px]"
            >
              {category}
            </span>
          </div>

          {/* Center Title - prominent cover text */}
          <div className="my-auto z-10 pl-2 pr-1 text-center flex flex-col items-center justify-center">
            <h4
              style={{ color: theme.textColor }}
              className="font-bold text-xs sm:text-sm leading-snug line-clamp-3 break-words text-center drop-shadow-xs"
              title={title}
            >
              {title || 'หนังสือไม่มีชื่อ'}
            </h4>
          </div>

          {/* Bottom Footer on book */}
          <div
            style={{ borderColor: theme.borderCol }}
            className="flex items-center justify-between text-[10px] z-10 pl-2 pt-1.5 border-t"
          >
            <span style={{ color: theme.subColor }}>
              {isLCode ? 'ส่วนกลาง' : 'ผู้แลก'}
            </span>
            {price !== undefined && price > 0 && (
              <span
                style={{ color: theme.textColor }}
                className="font-mono font-medium tabular-nums"
              >
                ฿{price}
              </span>
            )}
          </div>

          {/* Soft paper texture sheen overlay */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-white/10 pointer-events-none" />
        </div>
      )}

      {/* Floating Code Badge for instant identification on photo covers */}
      {coverImage && !imageFailed && (
        <div className="absolute top-2 left-2 z-10">
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-md ${
              isLCode
                ? 'bg-[#7A4B30] text-white'
                : 'bg-[#2A3B4C] text-white'
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
  category,
  code,
  seed,
  size = 'md',
  className = '',
}) => {
  const theme = getMockCoverTheme(seed || code || title || 'cmu');

  return (
    <div
      style={{ backgroundColor: theme.bg }}
      className={`w-full h-full relative overflow-hidden flex flex-col justify-between p-2.5 sm:p-3 select-none ${className}`}
    >
      {/* Book Spine Simulation Effect */}
      <div
        className="absolute left-0 top-0 bottom-0 w-2.5 pointer-events-none z-10"
        style={{ background: theme.spineShadow }}
      />
      <div
        className="absolute left-2.5 top-0 bottom-0 w-[1px] pointer-events-none z-10"
        style={{ backgroundColor: theme.borderCol }}
      />

      {/* Top Header: Tag */}
      <div className="w-full pl-2 pr-1 flex items-center justify-end z-10">
        {category && (
          <span
            style={{ color: theme.subColor }}
            className="text-[9px] font-medium truncate max-w-[80px] opacity-80"
          >
            {category.replace('หนังสือ', '')}
          </span>
        )}
      </div>

      {/* Center: Book Title (Taking title as cover text as requested) */}
      <div className="w-full pl-2.5 pr-1.5 my-auto flex flex-col items-center justify-center text-center z-10">
        <h4
          style={{ color: theme.textColor }}
          className={`font-bold leading-snug line-clamp-4 break-words text-center px-0.5 ${
            size === 'sm'
              ? 'text-[11px]'
              : size === 'lg'
              ? 'text-sm sm:text-base'
              : 'text-xs sm:text-[14px]'
          }`}
          title={title}
        >
          {title || 'หนังสือไม่มีชื่อ'}
        </h4>
      </div>

      {/* Bottom spacer for optical balance */}
      <div className="w-full h-2 z-10" />

      {/* Soft gradient sheen */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/5 via-transparent to-white/10 pointer-events-none" />
    </div>
  );
};

