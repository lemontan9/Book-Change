import React from 'react';

/**
 * Left Hero Illustration: Stacked hardcover books ("READ", "SHARE", "RENEW")
 * nestled on soft green foliage with golden sparkles.
 */
export const HeroBookStackIllustration: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 180 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft Foliage Base */}
    <path
      d="M22 114C16 102 24 88 38 92C44 76 62 72 74 84C90 76 112 80 120 96C134 92 146 102 142 114H22Z"
      fill="#C4D992"
    />
    <path
      d="M32 114C28 106 36 96 46 98C52 88 66 86 76 94C90 88 106 94 114 106C124 102 134 108 132 114H32Z"
      fill="#A8C66C"
    />

    {/* Bottom Book: RENEW (Forest Green) */}
    <g transform="translate(26, 76) rotate(-3)">
      <rect x="0" y="0" width="112" height="28" rx="7" fill="#5D8736" />
      <rect x="4" y="4" width="104" height="20" rx="5" fill="#FFF8EB" />
      <path d="M0 7C0 3.134 3.134 0 7 0H26V28H7C3.134 28 0 24.866 0 21V7Z" fill="#4B6E2A" />
      <rect x="24" y="3" width="84" height="22" rx="4" fill="#6F9A44" />
      <rect x="28" y="6" width="76" height="16" rx="3" fill="#7CA84F" />
      <text
        x="66"
        y="18"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="700"
        letterSpacing="1.2"
        fontFamily="Prompt, sans-serif"
      >
        RENEW
      </text>
      {/* Cream Pages Edge */}
      <rect x="6" y="7" width="16" height="14" rx="2" fill="#F9F1DF" />
      <line x1="8" y1="11" x2="20" y2="11" stroke="#DFD2BC" strokeWidth="1.2" />
      <line x1="8" y1="15" x2="20" y2="15" stroke="#DFD2BC" strokeWidth="1.2" />
    </g>

    {/* Middle Book: SHARE (Golden Amber) */}
    <g transform="translate(30, 48) rotate(3)">
      <rect x="0" y="0" width="108" height="26" rx="7" fill="#D48B29" />
      <path d="M84 0H101C104.866 0 108 3.134 108 7V19C108 22.866 104.866 26 101 26H84V0Z" fill="#C47B1D" />
      <rect x="3" y="3" width="84" height="20" rx="4" fill="#E6A13C" />
      <rect x="7" y="6" width="76" height="14" rx="3" fill="#F1B24A" />
      <text
        x="45"
        y="17"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="700"
        letterSpacing="1.2"
        fontFamily="Prompt, sans-serif"
      >
        SHARE
      </text>
      {/* Cream Pages Edge */}
      <rect x="88" y="6" width="15" height="14" rx="2" fill="#F9F1DF" />
      <line x1="90" y1="10" x2="101" y2="10" stroke="#DFD2BC" strokeWidth="1.2" />
      <line x1="90" y1="14" x2="101" y2="14" stroke="#DFD2BC" strokeWidth="1.2" />
    </g>

    {/* Top Book: READ (Fresh Olive Green) */}
    <g transform="translate(32, 22) rotate(-2)">
      <rect x="0" y="0" width="104" height="26" rx="7" fill="#5B8734" />
      <path d="M0 7C0 3.134 3.134 0 7 0H22V26H7C3.134 26 0 22.866 0 19V7Z" fill="#496D29" />
      <rect x="20" y="3" width="81" height="20" rx="4" fill="#70A144" />
      <rect x="24" y="6" width="73" height="14" rx="3" fill="#7FB250" />
      <text
        x="60"
        y="17"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="700"
        letterSpacing="1.5"
        fontFamily="Prompt, sans-serif"
      >
        READ
      </text>
      {/* Cream Pages Edge */}
      <rect x="5" y="6" width="14" height="14" rx="2" fill="#F9F1DF" />
      <line x1="7" y1="10" x2="17" y2="10" stroke="#DFD2BC" strokeWidth="1.2" />
      <line x1="7" y1="14" x2="17" y2="14" stroke="#DFD2BC" strokeWidth="1.2" />
    </g>

    {/* Golden Sparkle Rays (Top Right) */}
    <path d="M144 20L151 8" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M153 26L165 19" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M154 34L165 36" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />

    {/* Little Accent Leaves */}
    <path d="M22 65C14 62 12 53 20 50C26 53 27 61 22 65Z" fill="#7FA644" />
  </svg>
);

/**
 * Right Hero Illustration: Cute Happy Green Book Mascot
 * with heart speech bubble, mini amber book, leaves, and golden rays.
 */
export const HeroBookMascotIllustration: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 210 140"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Background Foliage Mound */}
    <path
      d="M12 124C14 106 32 94 48 100C58 84 82 82 94 96C112 88 134 92 142 104C154 96 174 100 178 114C190 112 198 118 196 124H12Z"
      fill="#C2D88E"
    />
    <path
      d="M28 124C30 112 44 104 56 108C68 96 86 96 96 106C110 100 128 104 136 114C146 108 164 112 168 124H28Z"
      fill="#9EBF60"
    />

    {/* Cute Leaf Sprigs */}
    <path d="M168 110C165 98 175 88 186 92C186 102 178 111 168 110Z" fill="#7EA646" />
    <path d="M174 116C177 107 188 104 195 110C191 118 181 120 174 116Z" fill="#8FB852" />

    {/* Main Green Book Mascot Body */}
    <g transform="translate(80, 26) rotate(8)">
      {/* Back Cover & Spine */}
      <rect x="6" y="4" width="76" height="92" rx="10" fill="#638E39" />
      {/* Cream Pages Block */}
      <rect x="10" y="6" width="74" height="86" rx="8" fill="#F9F1DF" />
      <line x1="76" y1="14" x2="76" y2="84" stroke="#E2D5BE" strokeWidth="1.5" />
      {/* Front Green Cover */}
      <rect x="0" y="6" width="74" height="88" rx="9" fill="#8AB856" />
      {/* Spine Shading */}
      <path d="M0 15C0 10.029 4.029 6 9 6H15V94H9C4.029 94 0 89.971 0 85V15Z" fill="#6E9A3F" />
      {/* Inner Cover Highlight */}
      <rect x="18" y="13" width="50" height="74" rx="6" fill="#9BC866" />

      {/* Cute Face */}
      <circle cx="34" cy="43" r="3.4" fill="#362721" />
      <circle cx="54" cy="43" r="3.4" fill="#362721" />
      {/* Eye sparkles */}
      <circle cx="33" cy="41.8" r="1" fill="#FFFFFF" />
      <circle cx="53" cy="41.8" r="1" fill="#FFFFFF" />
      {/* Rosy Cheeks */}
      <ellipse cx="27.5" cy="49" rx="4.2" ry="2.6" fill="#F49A8E" opacity="0.85" />
      <ellipse cx="60.5" cy="49" rx="4.2" ry="2.6" fill="#F49A8E" opacity="0.85" />
      {/* Happy Smile */}
      <path
        d="M39 48.5C41 52.5 47 52.5 49 48.5"
        stroke="#362721"
        strokeWidth="2.4"
        strokeLinecap="round"
      />

      {/* Little Arms */}
      <path d="M2 54C-8 56 -11 65 -5 70" stroke="#76A347" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M74 52C83 50 87 42 82 36" stroke="#76A347" strokeWidth="4.5" strokeLinecap="round" />
    </g>

    {/* Mini Golden-Tan Companion Book Leaning on Left */}
    <g transform="translate(46, 66) rotate(-14)">
      <rect x="2" y="2" width="38" height="48" rx="6" fill="#C97E28" />
      <rect x="5" y="4" width="35" height="43" rx="5" fill="#F8EEDB" />
      <rect x="0" y="4" width="35" height="45" rx="5" fill="#EBB454" />
      <path d="M0 9C0 6.239 2.239 4 5 4H9V49H5C2.239 49 0 46.761 0 44V9Z" fill="#D19432" />
      <rect x="13" y="13" width="16" height="4" rx="2" fill="#FBE09C" />
    </g>

    {/* Heart Speech Bubble (Top Left) */}
    <g transform="translate(36, 12)">
      <circle cx="20" cy="20" r="18" fill="#FFFFFF" stroke="#F0E2CC" strokeWidth="2" />
      <path d="M31 33L38 40L36 28Z" fill="#FFFFFF" />
      <path
        d="M20 27.5C20 27.5 11.5 22 11.5 16.5C11.5 13.7 13.7 11.5 16.3 11.5C18 11.5 19.3 12.4 20 13.7C20.7 12.4 22 11.5 23.7 11.5C26.3 11.5 28.5 13.7 28.5 16.5C28.5 22 20 27.5 20 27.5Z"
        fill="#EB7B59"
      />
    </g>

    {/* Golden Sparkle Rays (Top Right) */}
    <path d="M168 30L176 18" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M177 37L189 31" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M178 46L189 48" stroke="#F5A623" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export type EcoCardVariant = 'open-bookmark' | 'stacked-books' | 'open-sprout' | 'eco-globe';

export const getEcoCardTheme = (seedStr: string) => {
  let hash = 0;
  for (let i = 0; i < seedStr.length; i++) {
    hash = (hash << 5) - hash + seedStr.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash) % 4;
  const variants: Array<{ bg: string; variant: EcoCardVariant }> = [
    { bg: '#DCE7C4', variant: 'open-bookmark' },
    { bg: '#EFE2CA', variant: 'stacked-books' },
    { bg: '#F4EDE0', variant: 'open-sprout' },
    { bg: '#D8E4C7', variant: 'eco-globe' },
  ];
  return variants[idx];
};

/**
 * Crisp pastel-card vector artwork matching the 4 book cards in the user's mockup.
 */
export const BookCardEcoArtwork: React.FC<{
  variant: EcoCardVariant;
  className?: string;
}> = ({ variant, className = 'w-20 h-16' }) => {
  if (variant === 'open-bookmark') {
    return (
      <svg viewBox="0 0 100 72" fill="none" className={className} aria-hidden="true">
        {/* Sparkles */}
        <path d="M74 16L79 8" stroke="#F5A623" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M80 21L88 17" stroke="#F5A623" strokeWidth="2.8" strokeLinecap="round" />
        <path d="M81 28L88 29" stroke="#F5A623" strokeWidth="2.8" strokeLinecap="round" />
        {/* Open Book Back */}
        <path d="M14 25C14 22 17 20 20 20H48V59H20C17 59 14 57 14 54V25Z" fill="#D8A76E" />
        <path d="M86 25C86 22 83 20 80 20H52V59H80C83 59 86 57 86 54V25Z" fill="#C49158" />
        {/* Cream Pages */}
        <path d="M18 22C29 19 42 21 50 27V56C41 51 29 50 18 52V22Z" fill="#FFFDF7" />
        <path d="M82 22C71 19 58 21 50 27V56C59 51 71 50 82 52V22Z" fill="#F8F1E1" />
        {/* Page lines */}
        <line x1="25" y1="30" x2="43" y2="32" stroke="#E5DAC3" strokeWidth="2" strokeLinecap="round" />
        <line x1="25" y1="37" x2="43" y2="39" stroke="#E5DAC3" strokeWidth="2" strokeLinecap="round" />
        <line x1="57" y1="32" x2="75" y2="30" stroke="#E5DAC3" strokeWidth="2" strokeLinecap="round" />
        <line x1="57" y1="39" x2="75" y2="37" stroke="#E5DAC3" strokeWidth="2" strokeLinecap="round" />
        {/* Green Ribbon Bookmark */}
        <path d="M56 17H66V41L61 36L56 41V17Z" fill="#63963F" />
      </svg>
    );
  }

  if (variant === 'stacked-books') {
    return (
      <svg viewBox="0 0 100 72" fill="none" className={className} aria-hidden="true">
        {/* Shadow */}
        <ellipse cx="50" cy="60" rx="34" ry="5" fill="#DFCEA9" />
        {/* Bottom Amber/Brown Book */}
        <g transform="translate(18, 36)">
          <rect x="0" y="0" width="64" height="20" rx="5" fill="#9E5E2E" />
          <rect x="4" y="4" width="56" height="12" rx="3" fill="#FAF2E2" />
          <path d="M46 0H59C61.76 0 64 2.24 64 5V15C64 17.76 61.76 20 59 20H46V0Z" fill="#874D23" />
          <rect x="4" y="4" width="44" height="12" rx="2.5" fill="#B56E39" />
        </g>
        {/* Top Green Book */}
        <g transform="translate(22, 16) rotate(-4)">
          <rect x="0" y="0" width="60" height="19" rx="5" fill="#5D8A38" />
          <rect x="4" y="4" width="52" height="11" rx="2.5" fill="#FAF2E2" />
          <path d="M0 5C0 2.24 2.24 0 5 0H15V19H5C2.24 19 0 16.76 0 14V5Z" fill="#4B722C" />
          <rect x="14" y="3" width="42" height="13" rx="3" fill="#77A64B" />
        </g>
      </svg>
    );
  }

  if (variant === 'open-sprout') {
    return (
      <svg viewBox="0 0 100 72" fill="none" className={className} aria-hidden="true">
        {/* Open Book Base */}
        <path d="M13 36L49 45L87 36L87 50L50 61L13 50V36Z" fill="#D4AA72" />
        <path d="M15 34C27 29 41 31 50 38V57C40 51 27 49 15 52V34Z" fill="#FFFDF8" />
        <path d="M85 34C73 29 59 31 50 38V57C60 51 73 49 85 52V34Z" fill="#F6EEDD" />
        {/* Stem */}
        <path d="M50 42V22" stroke="#5F8D37" strokeWidth="3.2" strokeLinecap="round" />
        {/* Left Leaf */}
        <path d="M50 28C41 28 33 21 35 12C43 12 50 18 50 28Z" fill="#78AB49" />
        {/* Right Leaf */}
        <path d="M50 26C59 26 67 19 65 10C57 10 50 16 50 26Z" fill="#639537" />
      </svg>
    );
  }

  // 'eco-globe'
  return (
    <svg viewBox="0 0 100 72" fill="none" className={className} aria-hidden="true">
      {/* Wooden Base */}
      <rect x="37" y="59" width="26" height="5" rx="2.5" fill="#7C4E2B" />
      <rect x="47" y="51" width="6" height="9" fill="#684022" />
      {/* Meridian Ring */}
      <path
        d="M50 12C63 12 72 22 72 34C72 46 63 53 50 53"
        stroke="#7C4E2B"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      {/* Ocean Sphere */}
      <circle cx="49" cy="33" r="18" fill="#8CC5A3" />
      {/* Continents */}
      <path
        d="M36 25C40 21 48 21 51 26C54 31 46 33 44 38C42 42 36 42 34 36C32 32 33 28 36 25Z"
        fill="#5D8C3B"
      />
      <path
        d="M55 28C60 26 65 30 64 36C63 42 56 44 53 39C51 35 52 30 55 28Z"
        fill="#6B9E44"
      />
      {/* Specular Gloss */}
      <circle cx="42" cy="24" r="3" fill="#FFFFFF" opacity="0.35" />
    </svg>
  );
};

/**
 * Small delicate green leaf sprig used beside the section title pill banner.
 */
export const EcoLeafSprig: React.FC<{ className?: string; flip?: boolean }> = ({
  className = '',
  flip = false,
}) => (
  <svg
    viewBox="0 0 48 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={`${className} ${flip ? '-scale-x-100' : ''}`}
    aria-hidden="true"
  >
    <path
      d="M42 22C31 20 20 19 8 24"
      stroke="#6B9B3E"
      strokeWidth="2.2"
      strokeLinecap="round"
    />
    <path
      d="M27 20C27 11 19 5 11 8C12 16 19 21 27 20Z"
      fill="#8DC054"
    />
    <path
      d="M19 22C13 17 5 18 2 24C8 28 15 27 19 22Z"
      fill="#76AA42"
    />
    <path
      d="M35 21C35 14 29 10 24 12C25 18 30 22 35 21Z"
      fill="#A1CF68"
    />
  </svg>
);

/**
 * Open book with warm golden-brown cover, cream pages, and sparkle rays
 * peeking on the left side of the Terms title banner.
 */
export const TermsTitleOpenBookIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 110 82"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Golden sparkle rays */}
    <path d="M81 17L86 7" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M89 22L99 16" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M90 31L100 32" stroke="#F59E0B" strokeWidth="3.2" strokeLinecap="round" />

    <g transform="translate(8, 12) rotate(-7)">
      {/* Soft shadow */}
      <ellipse cx="44" cy="59" rx="34" ry="5" fill="#C7B698" opacity="0.45" />
      {/* Hardcover back */}
      <path d="M6 19C6 16 9 14 12 14H42V55H12C9 55 6 53 6 50V19Z" fill="#D59A54" />
      <path d="M82 19C82 16 79 14 76 14H46V55H76C79 55 82 53 82 50V19Z" fill="#BE8440" />
      {/* Spine notch */}
      <rect x="40" y="16" width="8" height="39" rx="3" fill="#B17634" />
      {/* Left cream page */}
      <path d="M10 16C22 12 36 14 44 21V52C35 46 22 45 10 48V16Z" fill="#FFFDF8" />
      {/* Right cream page */}
      <path d="M78 16C66 12 52 14 44 21V52C53 46 66 45 78 48V16Z" fill="#F8EFE0" />
      {/* Subtle page lines */}
      <line x1="17" y1="24" x2="36" y2="26" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="31" x2="36" y2="33" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="17" y1="38" x2="33" y2="40" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="26" x2="71" y2="24" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="33" x2="71" y2="31" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="40" x2="68" y2="38" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
    </g>
  </svg>
);

/**
 * Cute happy green book mascot holding a wooden checklist clipboard
 * with two green checkmarks and golden rays on top right (Terms card artwork).
 */
export const TermsChecklistMascotIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 220 180"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft ground shadow */}
    <ellipse cx="118" cy="156" rx="74" ry="10" fill="#E6DEC9" opacity="0.65" />

    {/* Leaf sprigs peeking on left & bottom right */}
    <path d="M44 126C35 121 31 110 38 103C46 107 49 118 44 126Z" fill="#8CC054" />
    <path d="M38 134C29 134 23 126 27 118C35 119 41 126 38 134Z" fill="#73A83F" />
    <path d="M180 144C185 133 196 130 202 137C197 146 187 149 180 144Z" fill="#8CC054" />

    {/* Main Cute Green Book Mascot (Right) */}
    <g transform="translate(88, 34) rotate(7)">
      {/* Back cover & spine */}
      <rect x="8" y="4" width="90" height="112" rx="13" fill="#638E39" />
      {/* Cream pages block */}
      <rect x="13" y="7" width="88" height="104" rx="10" fill="#F9F1DF" />
      <line x1="92" y1="18" x2="92" y2="100" stroke="#E2D5BE" strokeWidth="1.8" />
      {/* Front green cover */}
      <rect x="0" y="7" width="88" height="106" rx="12" fill="#8AB856" />
      {/* Spine shading */}
      <path d="M0 19C0 12.373 5.373 7 12 7H19V113H12C5.373 113 0 107.627 0 101V19Z" fill="#6E9A3F" />
      {/* Inner cover frame */}
      <rect x="22" y="16" width="59" height="88" rx="8" fill="#9BC866" />

      {/* Cute Face */}
      <circle cx="40" cy="52" r="4.2" fill="#362721" />
      <circle cx="64" cy="52" r="4.2" fill="#362721" />
      <circle cx="38.6" cy="50.4" r="1.3" fill="#FFFFFF" />
      <circle cx="62.6" cy="50.4" r="1.3" fill="#FFFFFF" />
      {/* Rosy Cheeks */}
      <ellipse cx="32" cy="59" rx="5.2" ry="3.2" fill="#F49A8E" opacity="0.88" />
      <ellipse cx="72" cy="59" rx="5.2" ry="3.2" fill="#F49A8E" opacity="0.88" />
      {/* Happy Smile */}
      <path
        d="M46 58.5C49 63.5 55 63.5 58 58.5"
        stroke="#362721"
        strokeWidth="2.8"
        strokeLinecap="round"
      />

      {/* Little Arms */}
      <path d="M3 69C-9 72 -13 82 -6 87" stroke="#76A347" strokeWidth="5.5" strokeLinecap="round" />
      <path d="M88 64C98 62 103 52 97 45" stroke="#76A347" strokeWidth="5.5" strokeLinecap="round" />
    </g>

    {/* Tan Checklist Clipboard (Left, tilted slightly) */}
    <g transform="translate(34, 54) rotate(-8)">
      {/* Wooden board */}
      <rect x="0" y="6" width="60" height="78" rx="10" fill="#E3B982" stroke="#C89558" strokeWidth="2" />
      {/* Top metal/gold clip */}
      <rect x="19" y="0" width="22" height="11" rx="4" fill="#D59546" />
      <circle cx="30" cy="5.5" r="2.2" fill="#FFF8EB" />
      {/* Cream checklist sheet */}
      <rect x="7" y="13" width="46" height="64" rx="6" fill="#FFFDF7" />

      {/* Check row 1 */}
      <rect x="12" y="21" width="12" height="12" rx="3" fill="#E5F1D4" stroke="#A6CA78" strokeWidth="1.2" />
      <path d="M14.5 27L17.2 29.8L22 24" stroke="#5D8F34" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="28" y1="25" x2="47" y2="25" stroke="#D5C8B3" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="30" x2="42" y2="30" stroke="#E4DAC8" strokeWidth="2.2" strokeLinecap="round" />

      {/* Check row 2 */}
      <rect x="12" y="40" width="12" height="12" rx="3" fill="#E5F1D4" stroke="#A6CA78" strokeWidth="1.2" />
      <path d="M14.5 46L17.2 48.8L22 43" stroke="#5D8F34" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="28" y1="44" x2="47" y2="44" stroke="#D5C8B3" strokeWidth="2.5" strokeLinecap="round" />
      <line x1="28" y1="49" x2="43" y2="49" stroke="#E4DAC8" strokeWidth="2.2" strokeLinecap="round" />

      {/* Line 3 */}
      <rect x="12" y="59" width="12" height="10" rx="3" fill="#F4EDE0" />
      <line x1="28" y1="64" x2="45" y2="64" stroke="#E4DAC8" strokeWidth="2.4" strokeLinecap="round" />
    </g>

    {/* Three Golden Sparkle Rays (Top Right) */}
    <path d="M168 25L174 10" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M180 31L192 20" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M185 41L199 39" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

/**
 * Tilted wooden checklist clipboard illustration overlapping the left side
 * of the Step 2 section title banner.
 */
export const ParticipantClipboardBadgeIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 88 86"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    <g transform="translate(14, 6) rotate(-10)">
      {/* Shadow */}
      <ellipse cx="30" cy="72" rx="22" ry="4" fill="#C7B698" opacity="0.45" />
      {/* Board */}
      <rect x="4" y="8" width="52" height="64" rx="9" fill="#E3B57A" stroke="#C89252" strokeWidth="2" />
      {/* Clip */}
      <rect x="20" y="2" width="20" height="10" rx="4" fill="#D48D3B" />
      <circle cx="30" cy="7" r="2" fill="#FFF8EB" />
      {/* Paper */}
      <rect x="10" y="14" width="40" height="52" rx="5" fill="#FFFDF7" />
      {/* Check 1 */}
      <rect x="14" y="20" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#9FC570" strokeWidth="1.2" />
      <path d="M16.2 25L18.4 27.3L22.2 22.8" stroke="#5A8D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="27" y1="23.5" x2="44" y2="23.5" stroke="#D5C8B3" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="27" y1="28" x2="40" y2="28" stroke="#E5DAC8" strokeWidth="2" strokeLinecap="round" />
      {/* Check 2 */}
      <rect x="14" y="35" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#9FC570" strokeWidth="1.2" />
      <path d="M16.2 40L18.4 42.3L22.2 37.8" stroke="#5A8D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="27" y1="38.5" x2="44" y2="38.5" stroke="#D5C8B3" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="27" y1="43" x2="41" y2="43" stroke="#E5DAC8" strokeWidth="2" strokeLinecap="round" />
      {/* Check 3 */}
      <rect x="14" y="50" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#9FC570" strokeWidth="1.2" />
      <path d="M16.2 55L18.4 57.3L22.2 52.8" stroke="#5A8D32" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="27" y1="53.5" x2="44" y2="53.5" stroke="#D5C8B3" strokeWidth="2.3" strokeLinecap="round" />
    </g>
  </svg>
);

/**
 * Cute happy green book mascot holding a pencil and checklist clipboard
 * with golden sparkle rays (Step 2 right-side illustration).
 */
export const ParticipantBookMascotIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 210 185"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Ground shadow */}
    <ellipse cx="108" cy="162" rx="68" ry="10" fill="#E6DEC9" opacity="0.65" />

    {/* Pencil held in left hand */}
    <g transform="translate(22, 42) rotate(-25)">
      <rect x="0" y="10" width="11" height="44" rx="2.5" fill="#F5B041" />
      <rect x="0" y="6" width="11" height="7" rx="2" fill="#E87A70" />
      <rect x="0" y="12" width="11" height="4" fill="#D5D8DC" />
      <path d="M0 54L5.5 64L11 54H0Z" fill="#FAD7A0" />
      <path d="M4 61L5.5 64L7 61H4Z" fill="#4E342E" />
    </g>

    {/* Cute Green Book Mascot */}
    <g transform="translate(68, 32) rotate(7)">
      {/* Back cover & spine */}
      <rect x="8" y="4" width="90" height="114" rx="13" fill="#638E39" />
      {/* Cream pages */}
      <rect x="13" y="7" width="88" height="106" rx="10" fill="#F9F1DF" />
      <line x1="92" y1="18" x2="92" y2="100" stroke="#E2D5BE" strokeWidth="1.8" />
      {/* Front green cover */}
      <rect x="0" y="7" width="88" height="108" rx="12" fill="#8AB856" />
      <path d="M0 19C0 12.373 5.373 7 12 7H19V115H12C5.373 115 0 109.627 0 103V19Z" fill="#6E9A3F" />
      <rect x="22" y="16" width="59" height="90" rx="8" fill="#9BC866" />

      {/* Face */}
      <circle cx="40" cy="52" r="4.2" fill="#362721" />
      <circle cx="64" cy="52" r="4.2" fill="#362721" />
      <circle cx="38.6" cy="50.4" r="1.3" fill="#FFFFFF" />
      <circle cx="62.6" cy="50.4" r="1.3" fill="#FFFFFF" />
      <ellipse cx="32" cy="59" rx="5.2" ry="3.2" fill="#F49A8E" opacity="0.88" />
      <ellipse cx="72" cy="59" rx="5.2" ry="3.2" fill="#F49A8E" opacity="0.88" />
      <path d="M46 58.5C49 63.5 55 63.5 58 58.5" stroke="#362721" strokeWidth="2.8" strokeLinecap="round" />

      {/* Raised left arm holding pencil */}
      <path d="M2 56C-11 50 -16 40 -14 33" stroke="#76A347" strokeWidth="5.5" strokeLinecap="round" />
      {/* Lower arm */}
      <path d="M88 68C97 65 101 56 96 49" stroke="#76A347" strokeWidth="5.5" strokeLinecap="round" />
    </g>

    {/* Mini Clipboard leaning bottom-left */}
    <g transform="translate(26, 86) rotate(-8)">
      <rect x="0" y="6" width="54" height="68" rx="9" fill="#E3B982" stroke="#C89558" strokeWidth="2" />
      <rect x="17" y="0" width="20" height="10" rx="4" fill="#D59546" />
      <circle cx="27" cy="5" r="2" fill="#FFF8EB" />
      <rect x="6" y="12" width="42" height="56" rx="5" fill="#FFFDF7" />
      <rect x="10" y="19" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#A6CA78" strokeWidth="1.2" />
      <path d="M12.2 24L14.4 26.3L18.2 21.8" stroke="#5D8F34" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="23" y1="22.5" x2="41" y2="22.5" stroke="#D5C8B3" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="23" y1="27" x2="37" y2="27" stroke="#E4DAC8" strokeWidth="2" strokeLinecap="round" />

      <rect x="10" y="34" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#A6CA78" strokeWidth="1.2" />
      <path d="M12.2 39L14.4 41.3L18.2 36.8" stroke="#5D8F34" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="23" y1="37.5" x2="41" y2="37.5" stroke="#D5C8B3" strokeWidth="2.3" strokeLinecap="round" />
      <line x1="23" y1="42" x2="38" y2="42" stroke="#E4DAC8" strokeWidth="2" strokeLinecap="round" />

      <rect x="10" y="49" width="10" height="10" rx="2.5" fill="#E5F1D4" stroke="#A6CA78" strokeWidth="1.2" />
      <path d="M12.2 54L14.4 56.3L18.2 51.8" stroke="#5D8F34" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <line x1="23" y1="53.5" x2="41" y2="53.5" stroke="#E4DAC8" strokeWidth="2.2" strokeLinecap="round" />
    </g>

    {/* Golden Sparkles Top Right */}
    <path d="M158 24L164 9" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M170 30L182 19" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M175 40L189 38" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
  </svg>
);

export type ParticipantIconKind =
  | 'users-badge'
  | 'calendar-rays'
  | 'book-trio'
  | 'book-sprout'
  | 'student-cap'
  | 'staff-briefcase'
  | 'alumni-building'
  | 'public-people';

/**
 * Flat eco vector icons for Step 2 section headings and option pills.
 */
export const ParticipantOptionIcon: React.FC<{
  kind: ParticipantIconKind;
  className?: string;
}> = ({ kind, className = 'w-6 h-6 shrink-0' }) => {
  switch (kind) {
    case 'users-badge':
      return (
        <svg viewBox="0 0 28 24" fill="none" className={className} aria-hidden="true">
          <circle cx="8" cy="9" r="3" fill="#90B866" />
          <path d="M3 19C3 16 5.2 14 8 14C10.8 14 13 16 13 19H3Z" fill="#77A34C" />
          <circle cx="20" cy="9" r="3" fill="#90B866" />
          <path d="M15 19C15 16 17.2 14 20 14C22.8 14 25 16 25 19H15Z" fill="#77A34C" />
          <circle cx="14" cy="7.5" r="3.6" fill="#B5D88B" />
          <path d="M8 20C8 16.2 10.6 13.5 14 13.5C17.4 13.5 20 16.2 20 20H8Z" fill="#5D8C39" />
        </svg>
      );
    case 'calendar-rays':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <rect x="2" y="4" width="19" height="17" rx="3.5" fill="#FFFDF7" stroke="#8C6239" strokeWidth="1.8" />
          <path d="M2 7.5C2 5.567 3.567 4 5.5 4H17.5C19.433 4 21 5.567 21 7.5V9.5H2V7.5Z" fill="#8C6239" />
          <rect x="5.5" y="2" width="2.2" height="4" rx="1" fill="#6B4423" />
          <rect x="15.3" y="2" width="2.2" height="4" rx="1" fill="#6B4423" />
          <circle cx="7" cy="13.5" r="1.2" fill="#8C6239" />
          <circle cx="11.5" cy="13.5" r="1.2" fill="#8C6239" />
          <circle cx="16" cy="13.5" r="1.2" fill="#8C6239" />
          <circle cx="7" cy="17.5" r="1.2" fill="#8C6239" />
          <circle cx="11.5" cy="17.5" r="1.2" fill="#8C6239" />
          <path d="M23 12L26 9" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
          <path d="M23.5 16L27 16" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
    case 'book-trio':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <rect x="3" y="4" width="6.5" height="18" rx="1.8" fill="#77A34C" />
          <rect x="4.5" y="7" width="3.5" height="2" rx="0.8" fill="#DCECC0" />
          <rect x="10.5" y="3" width="7" height="19" rx="1.8" fill="#E6A13C" />
          <rect x="12" y="6.5" width="4" height="2.2" rx="0.8" fill="#FFF3D6" />
          <rect x="18.5" y="5" width="6.5" height="17" rx="1.8" fill="#D46A4E" />
          <rect x="20" y="8.5" width="3.5" height="2" rx="0.8" fill="#FADBD2" />
        </svg>
      );
    case 'book-sprout':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          {/* Sprout */}
          <path d="M14 14V6" stroke="#5B8A35" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 9C10 9 7 6.5 8 3C11.5 3 14 5.5 14 9Z" fill="#82B64F" />
          <path d="M14 8.5C18 8.5 21 6 20 2.5C16.5 2.5 14 5 14 8.5Z" fill="#689B3B" />
          {/* Closed book base */}
          <rect x="4" y="13.5" width="20" height="8" rx="2.5" fill="#77A34C" />
          <rect x="6" y="15.5" width="16" height="4" rx="1.5" fill="#FFFDF7" />
        </svg>
      );
    case 'student-cap':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <path d="M14 4L26 10L14 16L2 10L14 4Z" fill="#8C6239" />
          <path d="M7 13V18.5C7 20.5 10.2 22 14 22C17.8 22 21 20.5 21 18.5V13L14 16.5L7 13Z" fill="#A6794E" />
          <path d="M23.5 11.2V17" stroke="#E6A13C" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="23.5" cy="18" r="1.6" fill="#E6A13C" />
        </svg>
      );
    case 'staff-briefcase':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <path d="M10 7V5.5C10 4.67 10.67 4 11.5 4H16.5C17.33 4 18 4.67 18 5.5V7" stroke="#7A4F2B" strokeWidth="2" strokeLinecap="round" />
          <rect x="3" y="7" width="22" height="15" rx="3.5" fill="#C68642" />
          <path d="M3 10.5C3 8.567 4.567 7 6.5 7H21.5C23.433 7 25 8.567 25 10.5V13H3V10.5Z" fill="#D89A56" />
          <rect x="12" y="11.5" width="4" height="3" rx="1" fill="#FFF3D6" />
        </svg>
      );
    case 'alumni-building':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <path d="M14 3L24 8.5H4L14 3Z" fill="#B58450" />
          <rect x="5" y="8.5" width="18" height="13" rx="1.5" fill="#EFE0C6" stroke="#C59D6C" strokeWidth="1.2" />
          <rect x="8" y="11.5" width="2.5" height="6.5" rx="0.8" fill="#A67B4C" />
          <rect x="12.75" y="11.5" width="2.5" height="6.5" rx="0.8" fill="#A67B4C" />
          <rect x="17.5" y="11.5" width="2.5" height="6.5" rx="0.8" fill="#A67B4C" />
          <rect x="3.5" y="21" width="21" height="2.2" rx="1" fill="#8C6239" />
        </svg>
      );
    case 'public-people':
      return (
        <svg viewBox="0 0 28 26" fill="none" className={className} aria-hidden="true">
          <circle cx="10.5" cy="9" r="3.4" fill="#C69C6D" />
          <path d="M4.5 21C4.5 17 7.1 14.5 10.5 14.5C13.9 14.5 16.5 17 16.5 21H4.5Z" fill="#8C6239" />
          <circle cx="18.5" cy="10" r="2.9" fill="#D9B382" />
          <path d="M14 21C14 17.6 16 15.5 18.8 15.5C21.6 15.5 23.5 17.6 23.5 21H14Z" fill="#A67B4C" />
        </svg>
      );
  }
};

/**
 * Left banner illustration for Step 3: Green & golden-amber stacked books
 * resting on soft foliage with leaves and sparkle rays.
 */
export const Step3LeftBookStackIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 135 84"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Foliage Shadow & Leaf */}
    <ellipse cx="78" cy="72" rx="44" ry="8" fill="#DCE9BC" />
    <path d="M44 65C32 62 21 53 16 42C28 42 39 50 44 65Z" fill="#8EC054" />
    <path d="M40 69C27 72 14 68 8 60C19 55 32 58 40 69Z" fill="#A2CF69" />

    {/* Bottom Amber Book */}
    <g transform="translate(38, 36) rotate(4)">
      <rect x="0" y="0" width="84" height="30" rx="7" fill="#D9902E" />
      <rect x="4" y="4" width="76" height="22" rx="5" fill="#F9F0DD" />
      <path d="M62 0H77C80.866 0 84 3.134 84 7V23C84 26.866 80.866 30 77 30H62V0Z" fill="#C47C20" />
      <rect x="4" y="4" width="60" height="22" rx="4" fill="#EDA63F" />
      <rect x="8" y="8" width="52" height="14" rx="3" fill="#F5B856" />
      <rect x="65" y="7" width="14" height="16" rx="2.5" fill="#FAF2DF" />
      <line x1="67" y1="12" x2="77" y2="12" stroke="#DFD2BC" strokeWidth="1.4" />
      <line x1="67" y1="16" x2="77" y2="16" stroke="#DFD2BC" strokeWidth="1.4" />
    </g>

    {/* Top Green Book */}
    <g transform="translate(46, 13) rotate(-4)">
      <rect x="0" y="0" width="72" height="25" rx="6" fill="#5D8A38" />
      <rect x="4" y="3.5" width="64" height="18" rx="4" fill="#FFF8EB" />
      <path d="M0 6C0 2.686 2.686 0 6 0H18V25H6C2.686 25 0 22.314 0 19V6Z" fill="#4B722C" />
      <rect x="16" y="3" width="52" height="19" rx="3.5" fill="#77A64B" />
      <rect x="20" y="6" width="44" height="13" rx="2.5" fill="#88B959" />
      <rect x="5" y="5.5" width="10" height="14" rx="2" fill="#F9F1DF" />
    </g>

    {/* Golden Sparkles Top Right */}
    <path d="M116 14L121 5" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M122 20L131 15" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M123 27L131 28" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * Right banner illustration for Step 3: Open book with green ribbon bookmark
 * resting on foliage with leaves and sparkle rays.
 */
export const Step3RightOpenBookIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 135 84"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Foliage & Leaves */}
    <ellipse cx="60" cy="70" rx="40" ry="8" fill="#DCE9BC" />
    <path d="M12 22C4 16 3 6 10 2C17 7 18 16 12 22Z" fill="#7FB348" />
    <path d="M92 60C102 52 114 48 122 54C116 64 103 67 92 60Z" fill="#8DC054" />
    <path d="M96 67C107 69 116 64 120 58C111 55 101 59 96 67Z" fill="#A1CF68" />

    {/* Open Book */}
    <g transform="translate(18, 16) rotate(4)">
      <path d="M4 22C4 18 7 16 11 16H43V56H11C7 56 4 54 4 50V22Z" fill="#D59A54" />
      <path d="M84 22C84 18 81 16 77 16H45V56H77C81 56 84 54 84 50V22Z" fill="#BE8440" />
      <path d="M8 18C20 14 35 16 44 23V53C34 47 21 46 8 49V18Z" fill="#FFFDF8" />
      <path d="M80 18C68 14 53 16 44 23V53C54 47 67 46 80 49V18Z" fill="#F8EFE0" />
      <line x1="15" y1="26" x2="36" y2="28" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="15" y1="33" x2="36" y2="35" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="28" x2="73" y2="26" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      <line x1="52" y1="35" x2="73" y2="33" stroke="#E7DCC7" strokeWidth="2" strokeLinecap="round" />
      {/* Green Bookmark Ribbon */}
      <path d="M51 12H61V37L56 32L51 37V12Z" fill="#5D8C39" />
    </g>

    {/* Golden Sparkles Top Right */}
    <path d="M98 18L104 8" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M106 23L116 17" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
    <path d="M108 31L117 31" stroke="#F59E0B" strokeWidth="3" strokeLinecap="round" />
  </svg>
);

/**
 * Cute mini tilted book icon for Step 3 book card headers (alternates green / amber).
 */
export const Step3CardMiniBookIllustration: React.FC<{
  variant: 'green' | 'amber';
  className?: string;
}> = ({ variant, className = 'w-9 h-9 shrink-0' }) => {
  const c =
    variant === 'green'
      ? {
          back: '#4E752D',
          front: '#7AA94E',
          spine: '#5D8A38',
          highlight: '#8EBC61',
          line: '#CFE4B4',
        }
      : {
          back: '#C17A22',
          front: '#EEA942',
          spine: '#D1892A',
          highlight: '#F6BA5B',
          line: '#FDE4AF',
        };
  return (
    <svg viewBox="0 0 40 40" fill="none" className={className} aria-hidden="true">
      <g transform="translate(5, 3) rotate(-8)">
        <rect x="3" y="2" width="24" height="31" rx="4.5" fill={c.back} />
        <rect x="4" y="4" width="23" height="27" rx="3.5" fill="#FBF3E2" />
        <rect x="0" y="3" width="24" height="29" rx="4" fill={c.front} />
        <path d="M0 7C0 4.79 1.79 3 4 3H7V32H4C1.79 32 0 30.21 0 28V7Z" fill={c.spine} />
        <rect x="9" y="6" width="12" height="23" rx="2.5" fill={c.highlight} />
        <rect x="11.5" y="10" width="7" height="2.4" rx="1.2" fill={c.line} />
        <rect x="11.5" y="15" width="5.5" height="2" rx="1" fill={c.line} opacity="0.8" />
      </g>
    </svg>
  );
};

/**
 * Centerpiece eco illustration for Step 4: Standing green "BOOK SWAP" book with top-right
 * sticker badge, flanked by stacked books on the left and a circular sticker roll on the right.
 */
export const Step4StickerBookSceneIllustration: React.FC<{
  stickerCode: string;
  className?: string;
}> = ({ stickerCode, className = '' }) => (
  <svg
    viewBox="0 0 420 215"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft Oval Ground Base */}
    <ellipse cx="210" cy="186" rx="168" ry="20" fill="#EFE4CE" />

    {/* Left Foliage Sprig */}
    <g transform="translate(88, 66)">
      <path d="M24 54C20 38 22 22 28 8" stroke="#689B3E" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M25 22C16 17 12 8 18 2C24 6 27 14 25 22Z" fill="#88BC50" />
      <path d="M24 34C32 28 40 28 42 36C36 41 28 40 24 34Z" fill="#73A83F" />
      <path d="M22 40C12 37 5 30 9 22C17 24 23 32 22 40Z" fill="#9ECA62" />
    </g>

    {/* Right Foliage Sprig */}
    <g transform="translate(274, 68)">
      <path d="M20 56C22 40 22 24 18 10" stroke="#689B3E" strokeWidth="2.4" strokeLinecap="round" />
      <path d="M20 24C29 18 33 10 27 4C21 8 18 16 20 24Z" fill="#88BC50" />
      <path d="M21 36C13 30 5 30 3 38C9 43 17 42 21 36Z" fill="#73A83F" />
      <path d="M22 42C31 39 38 32 34 24C27 26 21 34 22 42Z" fill="#9ECA62" />
    </g>

    {/* Left Mini Book Stack */}
    <g transform="translate(48, 118)">
      <ellipse cx="44" cy="60" rx="40" ry="7" fill="#DFD2BC" opacity="0.65" />
      {/* Bottom Green Book */}
      <g transform="translate(4, 28) rotate(2)">
        <rect x="0" y="0" width="82" height="26" rx="6" fill="#5D8A38" />
        <rect x="4" y="4" width="74" height="18" rx="4" fill="#FFF8EB" />
        <path d="M62 0H76C79.3 0 82 2.7 82 6V20C82 23.3 79.3 26 76 26H62V0Z" fill="#4B722C" />
        <rect x="4" y="4" width="60" height="18" rx="3.5" fill="#78A74C" />
        <rect x="65" y="7" width="12" height="12" rx="2" fill="#F9F1DF" />
      </g>
      {/* Top Amber Book */}
      <g transform="translate(6, 5) rotate(-4)">
        <rect x="0" y="0" width="76" height="24" rx="6" fill="#D58E2B" />
        <rect x="4" y="3.5" width="68" height="17" rx="4" fill="#FFF8EB" />
        <path d="M0 6C0 2.7 2.7 0 6 0H18V24H6C2.7 24 0 21.3 0 18V6Z" fill="#BF7B1E" />
        <rect x="16" y="3" width="56" height="18" rx="3.5" fill="#F0B148" />
        <rect x="20" y="6" width="48" height="12" rx="2.5" fill="#F7C266" />
        <rect x="5" y="5.5" width="10" height="13" rx="2" fill="#F9F1DF" />
      </g>
    </g>

    {/* Left Golden Sparkles */}
    <path d="M52 104L45 92" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M44 112L33 106" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M42 122L32 122" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />

    {/* Center Standing Green "BOOK SWAP" Book */}
    <g transform="translate(136, 18) rotate(-4)">
      {/* Shadow */}
      <ellipse cx="70" cy="166" rx="64" ry="8" fill="#D9CBAF" opacity="0.6" />
      {/* Back Cover & Cream Pages */}
      <rect x="10" y="6" width="122" height="154" rx="14" fill="#50762D" />
      <rect x="14" y="10" width="118" height="146" rx="11" fill="#F9F1DF" />
      <line x1="126" y1="20" x2="126" y2="146" stroke="#E2D5BE" strokeWidth="1.8" />
      {/* Front Green Cover */}
      <rect x="0" y="8" width="122" height="150" rx="13" fill="#70A143" />
      {/* Spine Shading */}
      <path d="M0 21C0 13.82 5.82 8 13 8H22V158H13C5.82 158 0 152.18 0 145V21Z" fill="#54802E" />
      {/* Inner Cover Subtle Frame */}
      <rect x="27" y="18" width="84" height="130" rx="8" fill="#79AB4A" />

      {/* Title Text */}
      <text
        x="69"
        y="60"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="14.5"
        fontWeight="700"
        letterSpacing="1.6"
        fontFamily="Prompt, sans-serif"
      >
        BOOK SWAP
      </text>
      {/* Cute Star */}
      <path
        d="M69 72L71.2 76.7L76.4 77.4L72.6 81L73.5 86.2L69 83.7L64.5 86.2L65.4 81L61.6 77.4L66.8 76.7L69 72Z"
        fill="#FFF8EB"
      />

      {/* Circular Sticker Badge on Top Right */}
      <g transform="translate(88, 12)">
        <circle cx="22" cy="22" r="22" fill="#DFC394" opacity="0.45" />
        <circle cx="21" cy="20" r="20" fill="#F9E8C4" stroke="#D5A664" strokeWidth="2.2" />
        <text
          x="21"
          y="25"
          textAnchor="middle"
          fill="#4E342E"
          fontSize="13.5"
          fontWeight="800"
          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace"
        >
          {stickerCode}
        </text>
      </g>
    </g>

    {/* Top Right Sparkle Rays Above Book Sticker */}
    <path d="M274 22L282 9" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M284 31L297 22" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />
    <path d="M286 42L299 42" stroke="#F59E0B" strokeWidth="4" strokeLinecap="round" />

    {/* Right Circular Sticker Roll */}
    <g transform="translate(284, 122)">
      <ellipse cx="44" cy="56" rx="40" ry="7" fill="#DFD2BC" opacity="0.65" />
      {/* Outer Cylinder */}
      <path d="M4 22C4 12 22 4 44 4C66 4 84 12 84 22V44C84 54 66 62 44 62C22 62 4 54 4 44V22Z" fill="#EFE4CE" stroke="#DFCDAE" strokeWidth="1.5" />
      {/* Top Rim & Hollow Cardboard Core */}
      <ellipse cx="44" cy="22" rx="40" ry="15" fill="#FBF5E8" stroke="#DFCDAE" strokeWidth="1.5" />
      <ellipse cx="44" cy="22" rx="22" ry="8.5" fill="#E3CEAA" />
      <ellipse cx="44" cy="24" rx="18" ry="6.5" fill="#C9AD82" />
      {/* Round Stickers along roll band */}
      <ellipse cx="20" cy="42" rx="8" ry="10" fill="#F5D79D" stroke="#DFB46B" strokeWidth="1.2" />
      <ellipse cx="44" cy="46" rx="9" ry="10" fill="#F5D79D" stroke="#DFB46B" strokeWidth="1.2" />
      <ellipse cx="68" cy="42" rx="8" ry="10" fill="#F5D79D" stroke="#DFB46B" strokeWidth="1.2" />
    </g>

    {/* Right Golden Sparkles Above Sticker Roll */}
    <path d="M366 112L373 100" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M375 120L386 113" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M377 129L387 129" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

/**
 * Cute mini tilted open book with coral-pink ribbon bookmark for Step 4 book rows.
 */
export const Step4MiniOpenBookIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg viewBox="0 0 88 68" fill="none" className={className} aria-hidden="true">
    <g transform="translate(8, 10) rotate(-10)">
      <ellipse cx="36" cy="48" rx="28" ry="4.5" fill="#D5C4A6" opacity="0.45" />
      <path d="M4 16C4 13 7 11 10 11H35V45H10C7 45 4 43 4 40V16Z" fill="#D49A56" />
      <path d="M68 16C68 13 65 11 62 11H37V45H62C65 45 68 43 68 40V16Z" fill="#BE8442" />
      <path d="M7 13C17 9 29 11 36 17V42C28 37 17 36 7 39V13Z" fill="#FFFDF8" />
      <path d="M65 13C55 9 43 11 36 17V42C44 37 55 36 65 39V13Z" fill="#F8EFE0" />
      <line x1="13" y1="20" x2="29" y2="21.5" stroke="#E7DCC7" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="13" y1="26" x2="29" y2="27.5" stroke="#E7DCC7" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="43" y1="21.5" x2="59" y2="20" stroke="#E7DCC7" strokeWidth="1.6" strokeLinecap="round" />
      <line x1="43" y1="27.5" x2="59" y2="26" stroke="#E7DCC7" strokeWidth="1.6" strokeLinecap="round" />
      {/* Coral-pink ribbon bookmark */}
      <path d="M42 7H50V27L46 23L42 27V7Z" fill="#EA7B89" />
    </g>
  </svg>
);

/**
 * Cute happy green book mascot holding a magnifying glass with foliage and golden rays
 * for Step 5 ("จับคู่การแลกเปลี่ยน").
 */
export const Step5BookSearchMascotIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 185 130"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Foliage Mound Base */}
    <ellipse cx="98" cy="112" rx="64" ry="10" fill="#DCE9BC" />
    <path d="M46 105C36 96 29 86 35 76C45 80 51 92 46 105Z" fill="#8DC054" />
    <path d="M138 104C144 92 156 86 164 93C159 103 147 108 138 104Z" fill="#8DC054" />
    <path d="M142 110C151 108 160 112 162 118C153 121 144 117 142 110Z" fill="#A1CF68" />

    {/* Main Green Book Mascot */}
    <g transform="translate(62, 22) rotate(7)">
      <rect x="6" y="4" width="72" height="86" rx="10" fill="#638E39" />
      <rect x="10" y="6" width="70" height="80" rx="8" fill="#F9F1DF" />
      <line x1="72" y1="14" x2="72" y2="78" stroke="#E2D5BE" strokeWidth="1.5" />
      <rect x="0" y="6" width="70" height="82" rx="9" fill="#8AB856" />
      <path d="M0 15C0 10.029 4.029 6 9 6H15V88H9C4.029 88 0 83.971 0 79V15Z" fill="#6E9A3F" />
      <rect x="17" y="13" width="47" height="68" rx="6" fill="#9BC866" />

      {/* Cute Face */}
      <circle cx="32" cy="40" r="3.3" fill="#362721" />
      <circle cx="51" cy="40" r="3.3" fill="#362721" />
      <circle cx="31" cy="38.8" r="1" fill="#FFFFFF" />
      <circle cx="50" cy="38.8" r="1" fill="#FFFFFF" />
      <ellipse cx="26" cy="45.5" rx="4" ry="2.5" fill="#F49A8E" opacity="0.88" />
      <ellipse cx="57" cy="45.5" rx="4" ry="2.5" fill="#F49A8E" opacity="0.88" />
      <path d="M36.5 45.5C38.5 49.5 44.5 49.5 46.5 45.5" stroke="#362721" strokeWidth="2.3" strokeLinecap="round" />

      {/* Arms */}
      <path d="M2 52C-9 55 -13 62 -10 67" stroke="#76A347" strokeWidth="4.5" strokeLinecap="round" />
      <path d="M70 50C78 48 82 40 77 34" stroke="#76A347" strokeWidth="4.5" strokeLinecap="round" />
    </g>

    {/* Magnifying Glass held on Left */}
    <g transform="translate(22, 34) rotate(-8)">
      <rect x="14" y="34" width="6.5" height="24" rx="3.2" fill="#B87333" />
      <circle cx="17.2" cy="20" r="15" fill="#E3F2FD" fillOpacity="0.72" stroke="#D9902E" strokeWidth="4" />
      <path d="M10 14C12 10.5 16 9 20 9.5" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
    </g>

    {/* Golden Sparkle Rays Top Right */}
    <path d="M142 26L149 14" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M151 33L162 25" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M153 42L165 42" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export const Step6LeftBookPlantIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 185 165"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft Ground Shadow */}
    <ellipse cx="90" cy="148" rx="68" ry="9" fill="#E8DFCE" />

    {/* Bottom Golden-Amber Book */}
    <g transform="translate(18, 102) rotate(3)">
      <path d="M4 12C4 6 9 2 15 2H118C123 2 127 6 127 11V34C127 39 123 43 118 43H15C9 43 4 39 4 33V12Z" fill="#ECA236" />
      <path d="M8 14H120C122 14 124 16 124 18V32C124 35 122 37 119 37H14C10 37 8 34 8 31V14Z" fill="#F8EED8" />
      <line x1="16" y1="22" x2="116" y2="22" stroke="#E5D5B8" strokeWidth="1.4" />
      <line x1="16" y1="29" x2="114" y2="29" stroke="#E5D5B8" strokeWidth="1.4" />
      <path d="M4 10C4 5 8 2 14 2H122C125 2 127 4 127 7C127 10 125 12 122 12H15C9 12 4 15 4 20V10Z" fill="#F8BE52" />
      {/* Bookmark Ribbon */}
      <path d="M98 30V51L104 46L110 51V30H98Z" fill="#F6B948" stroke="#DE8C20" strokeWidth="1.2" />
    </g>

    {/* Top Green Book */}
    <g transform="translate(50, 74) rotate(-5)">
      <path d="M4 11C4 6 8 2 13 2H92C96 2 100 6 100 10V29C100 33 96 36 92 36H13C8 36 4 32 4 27V11Z" fill="#6F9A3D" />
      <path d="M8 12H94C96 12 97 14 97 16V26C97 29 95 31 92 31H13C10 31 8 29 8 26V12Z" fill="#F7F0DC" />
      <line x1="14" y1="19" x2="90" y2="19" stroke="#E2D4BA" strokeWidth="1.3" />
      <path d="M4 9C4 5 8 2 13 2H94C97 2 100 4 100 7C100 10 97 12 94 12H13C8 12 4 14 4 18V9Z" fill="#89B94E" />
    </g>

    {/* Cream Plant Pot with Heart */}
    <g transform="translate(34, 62)">
      <path d="M8 18H50L45 48C44.5 52 41 55 37 55H21C17 55 13.5 52 13 48L8 18Z" fill="#FBF5E8" stroke="#DFD0B7" strokeWidth="1.8" />
      <rect x="6" y="12" width="46" height="8" rx="4" fill="#FFFDF8" stroke="#DFD0B7" strokeWidth="1.6" />
      {/* Cute Brown Heart on Pot */}
      <path
        d="M29 41C29 41 21 35.8 21 30.8C21 28.2 23.1 26.2 25.6 26.2C27.2 26.2 28.4 27 29 28.2C29.6 27 30.8 26.2 32.4 26.2C34.9 26.2 37 28.2 37 30.8C37 35.8 29 41 29 41Z"
        fill="#7E4C29"
      />
    </g>

    {/* Green Sprout Leaves Growing from Pot */}
    <path d="M63 74C63 58 63 40 63 26" stroke="#5D8C32" strokeWidth="3.2" strokeLinecap="round" />
    <path d="M63 54C52 46 42 40 30 39C35 51 48 58 63 54Z" fill="#7FB542" />
    <path d="M63 54C52 48 42 44 35 42" stroke="#5D8C32" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M63 46C73 36 86 30 98 31C92 43 78 50 63 46Z" fill="#92C755" />
    <path d="M63 46C74 40 84 36 92 34" stroke="#629336" strokeWidth="1.4" strokeLinecap="round" />
    <path d="M63 32C58 20 60 11 66 5C72 13 71 24 63 32Z" fill="#82BA46" />

    {/* 3 Golden Sparkle Rays */}
    <path d="M124 44L129 31" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M134 50L144 40" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M137 60L149 58" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);

export const Step6RightHeartMascotIllustration: React.FC<{ className?: string }> = ({
  className = '',
}) => (
  <svg
    viewBox="0 0 185 160"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Soft Ground Shadow */}
    <ellipse cx="95" cy="144" rx="58" ry="8.5" fill="#E8DFCE" />

    {/* Heart Sign Held on Left */}
    <g transform="translate(8, 36) rotate(-10)">
      <rect x="24" y="42" width="5.5" height="36" rx="2.75" fill="#C97D3A" />
      <path
        d="M27 46C27 46 4 31 4 16.5C4 9.2 9.8 3.5 16.8 3.5C21.2 3.5 24.9 5.8 27 9.4C29.1 5.8 32.8 3.5 37.2 3.5C44.2 3.5 50 9.2 50 16.5C50 31 27 46 27 46Z"
        fill="#F08A4B"
        stroke="#DC6E31"
        strokeWidth="2"
      />
      {/* White Inner Heart Cutout */}
      <path
        d="M27 33C27 33 15 24.5 15 17C15 13.4 17.9 10.6 21.3 10.6C23.5 10.6 25.6 11.8 27 13.7C28.4 11.8 30.5 10.6 32.7 10.6C36.1 10.6 39 13.4 39 17C39 24.5 27 33 27 33Z"
        fill="#FFFDF8"
      />
    </g>

    {/* Cute Smiling Green Book Mascot */}
    <g transform="translate(56, 40) rotate(8)">
      {/* Book Back & Pages */}
      <rect x="8" y="4" width="84" height="96" rx="12" fill="#638E39" />
      <rect x="13" y="6" width="82" height="88" rx="9" fill="#FAF2DF" />
      <line x1="86" y1="15" x2="86" y2="85" stroke="#E2D5BE" strokeWidth="1.6" />
      {/* Front Green Cover */}
      <rect x="0" y="6" width="80" height="92" rx="11" fill="#8AB856" />
      <path d="M0 17C0 10.925 4.925 6 11 6H18V98H11C4.925 98 0 93.075 0 87V17Z" fill="#6E9A3F" />
      <rect x="20" y="15" width="53" height="74" rx="7" fill="#9BC866" />

      {/* Cute Face */}
      <circle cx="36" cy="45" r="3.8" fill="#362721" />
      <circle cx="58" cy="45" r="3.8" fill="#362721" />
      <circle cx="34.8" cy="43.5" r="1.2" fill="#FFFFFF" />
      <circle cx="56.8" cy="43.5" r="1.2" fill="#FFFFFF" />
      <ellipse cx="29" cy="51.5" rx="4.6" ry="2.8" fill="#F49A8E" opacity="0.88" />
      <ellipse cx="64" cy="51.5" rx="4.6" ry="2.8" fill="#F49A8E" opacity="0.88" />
      <path d="M41.5 52C44 56.5 50 56.5 52.5 52" stroke="#362721" strokeWidth="2.6" strokeLinecap="round" />

      {/* Arms */}
      <path d="M3 60C-10 62 -15 58 -18 52" stroke="#78A647" strokeWidth="5.5" strokeLinecap="round" />
      <circle cx="-18" cy="51" r="4" fill="#8AB856" />
      <path d="M77 62C82 69 78 76 68 77" stroke="#78A647" strokeWidth="5.5" strokeLinecap="round" />
    </g>

    {/* 3 Golden Sparkle Rays Top Right */}
    <path d="M138 28L142 14" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M148 33L158 22" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
    <path d="M153 43L166 39" stroke="#F59E0B" strokeWidth="3.5" strokeLinecap="round" />
  </svg>
);






