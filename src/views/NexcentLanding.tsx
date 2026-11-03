import React, { useState } from 'react';
import {
  ArrowRight,
  Users,
  Building2,
  Smile,
  CreditCard,
  MousePointerClick,
  Sparkles,
  BookOpen,
  Check,
  ChevronRight,
  Mail,
  Send,
} from 'lucide-react';
import type { Book, SystemSettings, TransactionRecord } from '../types';

interface NexcentLandingProps {
  books: Book[];
  settings: SystemSettings;
  transactions: TransactionRecord[];
  onStartKiosk: () => void;
  onOpenBooks: () => void;
  onOpenDashboard: () => void;
}

export const NexcentLanding: React.FC<NexcentLandingProps> = ({
  books,
  settings,
  transactions,
  onStartKiosk,
  onOpenBooks,
  onOpenDashboard,
}) => {
  const [activeSlide, setActiveSlide] = useState(0);

  const availableCount = books.filter((b) => b.status === 'Available').length;
  const matchedCount = books.filter((b) => b.status === 'Matched').length;
  const totalBooksCount = books.length;

  return (
    <div className="w-full bg-white text-[#4D4D4D] font-sans">
      {/* 1. HERO SECTION (Split Left/Right on #F5F7FA canvas) */}
      <section className="bg-[#F5F7FA] py-16 sm:py-24 px-4 sm:px-8 border-b border-[#E8ECF2] relative">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Hero Content */}
          <div className="lg:col-span-7 space-y-6 text-left">
            <h1 className="text-4xl sm:text-6xl font-bold text-[#263238] tracking-tight leading-[1.15]">
              Lessons and insights <br />
              <span className="text-[#4CAF4F]">from 8 years</span>
            </h1>
            <p className="text-sm sm:text-base text-[#717171] max-w-xl leading-relaxed">
              Where to grow your business as a photographer: site or social media?
              ระบบแลกเปลี่ยนหนังสือแบบ Self Service เปลี่ยนเล่ม เปลี่ยนโลก
            </p>
            <div className="pt-2">
              <button
                onClick={onStartKiosk}
                className="px-8 py-3.5 bg-[#4CAF4F] hover:bg-[#388E3C] text-white font-medium text-sm rounded-md shadow-xs transition-all active:scale-98 cursor-pointer"
              >
                Register
              </button>
            </div>
          </div>

          {/* Right Hero SVG Illustration matching the Nexcent Monitor + Character Artwork */}
          <div className="lg:col-span-5 flex justify-center items-center">
            <div className="w-full max-w-md aspect-[4/3] relative flex items-center justify-center">
              <svg viewBox="0 0 450 320" className="w-full h-full drop-shadow-md">
                {/* Background Shadow & Gears */}
                <ellipse cx="230" cy="275" rx="140" ry="20" fill="#E8ECF2" />
                <path
                  d="M230 250 L240 240 L250 250 L260 245 L265 255 L255 265 L260 275 L250 280 L240 270 L230 275 L225 265 L235 255 Z"
                  fill="#E0E4EC"
                />

                {/* Standing Monitor / Screen */}
                <rect x="70" y="55" width="230" height="160" rx="8" fill="#37474F" />
                <rect x="76" y="61" width="218" height="148" rx="5" fill="#FFFFFF" />
                {/* Monitor Stand */}
                <path d="M170 215 L200 215 L210 250 L160 250 Z" fill="#263238" />
                <ellipse cx="185" cy="250" rx="45" ry="10" fill="#37474F" />

                {/* Screen Header / Tabs */}
                <rect x="76" y="61" width="218" height="18" fill="#ECEFF1" />
                <circle cx="86" cy="70" r="3" fill="#FF5252" />
                <circle cx="95" cy="70" r="3" fill="#FFB300" />
                <circle cx="104" cy="70" r="3" fill="#4CAF4F" />

                {/* Screen UI Elements (Green Flowchart Blocks) */}
                <rect x="90" y="90" width="40" height="20" rx="3" fill="#4CAF4F" />
                <rect x="140" y="90" width="45" height="20" rx="3" fill="#E8F5E9" stroke="#4CAF4F" strokeWidth="1" />
                <line x1="130" y1="100" x2="140" y2="100" stroke="#4CAF4F" strokeWidth="1.5" />

                <rect x="110" y="125" width="55" height="20" rx="3" fill="#E8F5E9" stroke="#4CAF4F" strokeWidth="1" />
                <line x1="110" y1="100" x2="110" y2="125" stroke="#4CAF4F" strokeWidth="1.5" />

                {/* Code Window on right of screen */}
                <rect x="195" y="88" width="90" height="110" rx="4" fill="#263238" />
                <rect x="205" y="100" width="50" height="4" rx="2" fill="#4CAF4F" />
                <rect x="205" y="110" width="70" height="4" rx="2" fill="#81C784" />
                <rect x="205" y="120" width="40" height="4" rx="2" fill="#ECEFF1" />
                <rect x="205" y="130" width="60" height="4" rx="2" fill="#81C784" />
                <rect x="205" y="140" width="45" height="4" rx="2" fill="#ECEFF1" />
                <rect x="205" y="150" width="55" height="4" rx="2" fill="#4CAF4F" />

                {/* Floating CSS and Tag Badges */}
                <rect x="45" y="100" width="30" height="18" rx="4" fill="#4CAF4F" />
                <text x="50" y="113" fill="#FFFFFF" fontSize="9" fontWeight="bold">CSS</text>

                <rect x="45" y="130" width="30" height="18" rx="4" fill="#263238" />
                <text x="50" y="143" fill="#FFFFFF" fontSize="9" fontWeight="bold">&lt;/&gt;</text>

                {/* Character standing on right holding laptop */}
                {/* Legs */}
                <rect x="330" y="190" width="12" height="70" rx="6" fill="#37474F" />
                <rect x="350" y="190" width="12" height="70" rx="6" fill="#37474F" />
                {/* Shoes */}
                <ellipse cx="336" cy="260" rx="10" ry="5" fill="#263238" />
                <ellipse cx="358" cy="260" rx="10" ry="5" fill="#263238" />

                {/* Torso & Green Polo */}
                <path d="M325 130 L365 130 L370 195 L320 195 Z" fill="#4CAF4F" />

                {/* Head & Hair */}
                <ellipse cx="345" cy="105" rx="13" ry="16" fill="#FFCCBC" />
                <path d="M332 105 Q345 85 358 105 Q355 90 338 90 Z" fill="#263238" />

                {/* Arms & Hands holding green laptop */}
                <path d="M322 140 L305 165 L320 170" stroke="#FFCCBC" strokeWidth="7" strokeLinecap="round" />
                <path d="M365 140 L345 165 L330 165" stroke="#FFCCBC" strokeWidth="7" strokeLinecap="round" />

                {/* Green Laptop in hands */}
                <rect x="290" y="155" width="45" height="28" rx="3" fill="#81C784" />
                <rect x="295" y="160" width="35" height="18" rx="2" fill="#E8F5E9" />
              </svg>
            </div>
          </div>
        </div>

        {/* Carousel Pagination Dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          <span
            onClick={() => setActiveSlide(0)}
            className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
              activeSlide === 0 ? 'bg-[#4CAF4F] w-6' : 'bg-[#4CAF4F]/30'
            }`}
          />
          <span
            onClick={() => setActiveSlide(1)}
            className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
              activeSlide === 1 ? 'bg-[#4CAF4F] w-6' : 'bg-[#4CAF4F]/30'
            }`}
          />
          <span
            onClick={() => setActiveSlide(2)}
            className={`w-2.5 h-2.5 rounded-full cursor-pointer transition-all ${
              activeSlide === 2 ? 'bg-[#4CAF4F] w-6' : 'bg-[#4CAF4F]/30'
            }`}
          />
        </div>
      </section>

      {/* 2. OUR CLIENTS / PARTNERS SECTION */}
      <section className="py-12 sm:py-16 px-4 sm:px-8 text-center max-w-7xl mx-auto">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#4D4D4D]">
          Our Clients
        </h2>
        <p className="text-xs sm:text-sm text-[#717171] mt-2 mb-10">
          We have been working with some Fortune 500+ clients & University Faculties
        </p>

        {/* Client Logos Row matching Nexcent layout */}
        <div className="flex flex-wrap items-center justify-center gap-8 sm:gap-14 opacity-75">
          {/* Logo 1 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-10 h-10 fill-[#263238]">
              <circle cx="15" cy="15" r="7" />
              <circle cx="25" cy="15" r="7" />
              <circle cx="15" cy="25" r="7" />
              <circle cx="25" cy="25" r="7" />
            </svg>
          </div>
          {/* Logo 2 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-10 h-10 fill-[#263238]">
              <ellipse cx="20" cy="20" rx="16" ry="10" />
              <circle cx="20" cy="20" r="5" fill="#FFFFFF" />
            </svg>
          </div>
          {/* Logo 3 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <span className="font-extrabold text-2xl tracking-tighter text-[#263238]">
              [0]
            </span>
          </div>
          {/* Logo 4 */}
          <div className="w-16 h-12 flex items-center justify-center">
            <span className="font-serif italic font-bold text-lg text-[#263238]">
              LOGO'SAM
            </span>
          </div>
          {/* Logo 5 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-10 h-10 fill-[#263238]">
              <rect x="5" y="10" width="30" height="20" rx="10" />
              <line x1="12" y1="10" x2="12" y2="30" stroke="#FFFFFF" strokeWidth="2" />
              <line x1="20" y1="10" x2="20" y2="30" stroke="#FFFFFF" strokeWidth="2" />
              <line x1="28" y1="10" x2="28" y2="30" stroke="#FFFFFF" strokeWidth="2" />
            </svg>
          </div>
          {/* Logo 6 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <svg viewBox="0 0 40 40" className="w-10 h-10 stroke-[#263238] fill-none stroke-[3]">
              <path d="M10 20 Q15 10 20 20 T30 20" />
              <path d="M10 20 Q15 30 20 20 T30 20" />
            </svg>
          </div>
          {/* Logo 7 */}
          <div className="w-12 h-12 flex items-center justify-center">
            <span className="font-mono font-bold text-xl text-[#263238]">
              01
            </span>
          </div>
        </div>
      </section>

      {/* 3. MANAGE YOUR ENTIRE COMMUNITY (3 Feature Cards) */}
      <section className="py-12 sm:py-16 px-4 sm:px-8 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#4D4D4D] leading-tight">
          Manage your entire community <br />
          in a single system
        </h2>
        <p className="text-xs sm:text-sm text-[#717171] mt-2 mb-12">
          Who is Nexcent suitable for?
        </p>

        {/* 3 Columns Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Card 1: Membership Organisations */}
          <div
            onClick={onStartKiosk}
            className="p-8 rounded-lg bg-white border border-[#E8ECF2] shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-tl-2xl rounded-br-2xl bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] mb-4 group-hover:scale-105 transition-transform">
              <Users className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#4D4D4D] mb-3 leading-snug">
              Membership <br />
              Organisations
            </h3>
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              Our membership management software provides full automation of membership renewals and payments.
            </p>
          </div>

          {/* Card 2: National Associations */}
          <div
            onClick={onOpenBooks}
            className="p-8 rounded-lg bg-white border border-[#E8ECF2] shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-tl-2xl rounded-br-2xl bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] mb-4 group-hover:scale-105 transition-transform">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#4D4D4D] mb-3 leading-snug">
              National <br />
              Associations
            </h3>
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              Our membership management software provides full automation of membership renewals and payments.
            </p>
          </div>

          {/* Card 3: Clubs And Groups */}
          <div
            onClick={onOpenDashboard}
            className="p-8 rounded-lg bg-white border border-[#E8ECF2] shadow-xs hover:shadow-md transition-all flex flex-col items-center text-center cursor-pointer group"
          >
            <div className="w-16 h-16 rounded-tl-2xl rounded-br-2xl bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] mb-4 group-hover:scale-105 transition-transform">
              <Smile className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-[#4D4D4D] mb-3 leading-snug">
              Clubs And <br />
              Groups
            </h3>
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              Our membership management software provides full automation of membership renewals and payments.
            </p>
          </div>
        </div>
      </section>

      {/* 4. FEATURE SPOTLIGHT 1: "The unseen of spending three years at Pixelgrade" */}
      <section className="py-12 sm:py-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Illustration */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm aspect-square bg-[#F5F7FA] rounded-2xl p-6 flex items-center justify-center border border-[#E8ECF2]">
              <svg viewBox="0 0 300 260" className="w-full h-full">
                <rect x="50" y="30" width="180" height="200" rx="8" fill="#FFFFFF" stroke="#E8ECF2" strokeWidth="2" />
                <rect x="50" y="30" width="180" height="35" rx="8" fill="#4CAF4F" />
                <circle cx="70" cy="48" r="4" fill="#FFFFFF" />
                <circle cx="85" cy="48" r="4" fill="#FFFFFF" />
                <rect x="70" y="85" width="140" height="8" rx="4" fill="#ECEFF1" />
                <rect x="70" y="105" width="100" height="8" rx="4" fill="#ECEFF1" />
                <rect x="70" y="125" width="120" height="8" rx="4" fill="#ECEFF1" />
                <rect x="70" y="150" width="40" height="20" rx="4" fill="#E8F5E9" />
                <rect x="120" y="150" width="40" height="20" rx="4" fill="#E8F5E9" />
                {/* Character */}
                <ellipse cx="230" cy="180" rx="14" ry="16" fill="#37474F" />
                <rect x="215" y="195" width="30" height="50" rx="4" fill="#4CAF4F" />
              </svg>
            </div>
          </div>

          {/* Right Text Content */}
          <div className="lg:col-span-7 space-y-4 text-left">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#4D4D4D] leading-tight">
              The unseen of spending three years at Pixelgrade
            </h2>
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed sit amet justo ipsum. Sed
              accumsan quam vitae est varius fringilla. Pellentesque placerat vestibulum lorem sed
              porta. Nullam mattis tristique iaculis. Nullam pulvinar sit amet risus pretium auctor.
              Etiam quis massa pulvinar, aliquam quam vitae, tempus sem.
            </p>
            <div className="pt-2">
              <button
                onClick={onStartKiosk}
                className="px-6 py-2.5 bg-[#4CAF4F] hover:bg-[#388E3C] text-white font-medium text-sm rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 5. STATS COUNTER STRIP: "Helping a local business reinvent itself" */}
      <section className="bg-[#F5F7FA] py-14 px-4 sm:px-8 border-y border-[#E8ECF2]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Left Title */}
          <div className="lg:col-span-5 text-left">
            <h2 className="text-2xl sm:text-3xl font-bold text-[#4D4D4D] leading-tight">
              Helping a local <br />
              <span className="text-[#4CAF4F]">business reinvent itself</span>
            </h2>
            <p className="text-xs sm:text-sm text-[#717171] mt-2">
              We reached here with our hard work and dedication
            </p>
          </div>

          {/* Right 2x2 Stats Grid */}
          <div className="lg:col-span-7 grid grid-cols-2 gap-6 sm:gap-8">
            {/* Stat 1: Members */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] shrink-0">
                <Users className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#4D4D4D] tabular-nums">
                  2,245,341
                </div>
                <div className="text-xs text-[#717171]">Members</div>
              </div>
            </div>

            {/* Stat 2: Clubs */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] shrink-0">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#4D4D4D] tabular-nums">
                  46,328
                </div>
                <div className="text-xs text-[#717171]">Clubs</div>
              </div>
            </div>

            {/* Stat 3: Event Bookings */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] shrink-0">
                <MousePointerClick className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#4D4D4D] tabular-nums">
                  828,867
                </div>
                <div className="text-xs text-[#717171]">Event Bookings</div>
              </div>
            </div>

            {/* Stat 4: Payments */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#E8F5E9] flex items-center justify-center text-[#4CAF4F] shrink-0">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <div className="text-xl sm:text-2xl font-bold text-[#4D4D4D] tabular-nums">
                  1,926,436
                </div>
                <div className="text-xs text-[#717171]">Payments</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 6. FEATURE SPOTLIGHT 2: "How to design your site footer like we did" */}
      <section className="py-12 sm:py-16 px-4 sm:px-8 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Illustration: Phone + Person */}
          <div className="lg:col-span-5 flex justify-center">
            <div className="w-full max-w-sm aspect-square bg-[#F5F7FA] rounded-2xl p-6 flex items-center justify-center border border-[#E8ECF2]">
              <svg viewBox="0 0 280 260" className="w-full h-full">
                {/* Smartphone */}
                <rect x="70" y="20" width="130" height="220" rx="20" fill="#263238" />
                <rect x="76" y="26" width="118" height="208" rx="16" fill="#FFFFFF" />
                <rect x="90" y="50" width="90" height="25" rx="4" fill="#E8F5E9" />
                <rect x="90" y="85" width="90" height="60" rx="4" fill="#F5F7FA" />
                <rect x="90" y="160" width="90" height="20" rx="4" fill="#4CAF4F" />
                {/* Person */}
                <ellipse cx="60" cy="140" rx="12" ry="14" fill="#37474F" />
                <rect x="50" y="155" width="20" height="50" rx="4" fill="#4CAF4F" />
              </svg>
            </div>
          </div>

          {/* Right Text */}
          <div className="lg:col-span-7 space-y-4 text-left">
            <h2 className="text-2xl sm:text-4xl font-bold text-[#4D4D4D] leading-tight">
              How to design your site footer like we did
            </h2>
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              Donec a eros justo. Fusce egestas tristique ultrices. Nam tempor, augue nec tincidunt
              molestie, massa nunc varius arcu, at scelerisque elit erat a magna. Donec quis erat at
              libero ultrices mollis. In hac habitasse platea dictumst. Vivamus vehicula leo dui, at
              porta nisi facilisis finibus.
            </p>
            <div className="pt-2">
              <button
                onClick={onStartKiosk}
                className="px-6 py-2.5 bg-[#4CAF4F] hover:bg-[#388E3C] text-white font-medium text-sm rounded-md shadow-xs transition-colors cursor-pointer"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 7. TESTIMONIAL SECTION (Tesla Logo + Customer Story) */}
      <section className="bg-[#F5F7FA] py-14 px-4 sm:px-8 border-y border-[#E8ECF2]">
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Dark Image Card (Tesla style logo) */}
          <div className="lg:col-span-4 flex justify-center">
            <div className="w-56 h-56 rounded-xl bg-[#0F172A] flex items-center justify-center shadow-md p-6">
              <svg viewBox="0 0 100 100" className="w-24 h-24 fill-white">
                {/* Tesla T logo silhouette */}
                <path d="M50 25 C40 25 25 28 15 35 L20 42 C28 36 38 34 50 34 C62 34 72 36 80 42 L85 35 C75 28 60 25 50 25 Z" />
                <path d="M47 40 L45 78 L55 78 L53 40 C60 40 70 42 75 45 L78 38 C70 34 58 33 47 33 C36 33 24 34 16 38 L19 45 C24 42 34 40 47 40 Z" />
              </svg>
            </div>
          </div>

          {/* Right Testimonial Text & Customer Logos */}
          <div className="lg:col-span-8 text-left space-y-4">
            <p className="text-xs sm:text-sm text-[#717171] leading-relaxed">
              "Maecenas dignissim justo eget nulla rutrum molestie. Maecenas lobortis sem dui, vel
              rutrum risus tincidunt a. Etiam sagittis faucibus metus, a scelerisque sem at
              pellentesque. Aliquam convallis ipsum eget fermentum pellentesque. Praesent vel
              pellentesque elit, id pulvinar turpis. Integer ac efficitur arcu."
            </p>
            <div>
              <div className="text-base font-bold text-[#4CAF4F]">Tim Smith</div>
              <div className="text-xs text-[#89939E]">
                British Dragon Boat Racing Association
              </div>
            </div>

            {/* Logos + Meet all customers link */}
            <div className="pt-3 flex flex-wrap items-center gap-6">
              <span className="font-bold text-[#4D4D4D] text-sm">[0]</span>
              <span className="font-serif italic font-bold text-sm text-[#4D4D4D]">LogoSam</span>
              <span className="font-mono text-sm text-[#4D4D4D]">01</span>
              <button
                onClick={onOpenDashboard}
                className="flex items-center gap-2 text-sm font-bold text-[#4CAF4F] hover:text-[#388E3C] transition-colors ml-auto cursor-pointer"
              >
                <span>Meet all customers</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 8. CARING IS THE NEW MARKETING (3 Blog Cards) */}
      <section className="py-16 sm:py-20 px-4 sm:px-8 max-w-7xl mx-auto text-center">
        <h2 className="text-2xl sm:text-3xl font-semibold text-[#4D4D4D]">
          Caring is the new marketing
        </h2>
        <p className="text-xs sm:text-sm text-[#717171] max-w-xl mx-auto mt-2 mb-14">
          The Nexcent blog is the best place to read about the latest membership insights,
          trends and more. See who's joining the community, read about how our community are increasing their membership income.
        </p>

        {/* 3 Blog Cards with overlapping bottom text box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Blog Card 1 */}
          <div className="relative pb-12 flex flex-col items-center">
            <div className="w-full h-56 rounded-lg overflow-hidden bg-slate-200">
              <img
                src="https://images.unsplash.com/photo-1522202176988-66273c2fd55f?w=600&auto=format&fit=crop&q=80"
                alt="Community work"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="w-full h-full bg-gradient-to-tr from-[#37474F] to-[#455A64] flex items-center justify-center text-white text-xs">
                Community Strategy
              </div>
            </div>
            {/* Overlapping white card */}
            <div className="w-11/12 -mt-14 bg-[#F5F7FA] p-5 rounded-lg shadow-md border border-[#E8ECF2] z-10 flex flex-col items-center">
              <h4 className="text-xs sm:text-sm font-semibold text-[#4D4D4D] mb-3 leading-snug">
                Creating Streamlined Safeguarding Processes with OneRen
              </h4>
              <button
                onClick={onStartKiosk}
                className="flex items-center gap-1.5 text-xs font-bold text-[#4CAF4F] hover:text-[#388E3C] cursor-pointer"
              >
                <span>Readmore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Blog Card 2 */}
          <div className="relative pb-12 flex flex-col items-center">
            <div className="w-full h-56 rounded-lg overflow-hidden bg-slate-200">
              <img
                src="https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=600&auto=format&fit=crop&q=80"
                alt="Laptop work"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="w-full h-full bg-gradient-to-tr from-[#2E7D32] to-[#4CAF4F] flex items-center justify-center text-white text-xs">
                Safeguarding Audit
              </div>
            </div>
            <div className="w-11/12 -mt-14 bg-[#F5F7FA] p-5 rounded-lg shadow-md border border-[#E8ECF2] z-10 flex flex-col items-center">
              <h4 className="text-xs sm:text-sm font-semibold text-[#4D4D4D] mb-3 leading-snug">
                What are your safeguarding responsibilities and how can you manage them?
              </h4>
              <button
                onClick={onStartKiosk}
                className="flex items-center gap-1.5 text-xs font-bold text-[#4CAF4F] hover:text-[#388E3C] cursor-pointer"
              >
                <span>Readmore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Blog Card 3 */}
          <div className="relative pb-12 flex flex-col items-center">
            <div className="w-full h-56 rounded-lg overflow-hidden bg-slate-200">
              <img
                src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=600&auto=format&fit=crop&q=80"
                alt="Desk work"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="w-full h-full bg-gradient-to-tr from-[#1E293B] to-[#334155] flex items-center justify-center text-white text-xs">
                Membership Renewal
              </div>
            </div>
            <div className="w-11/12 -mt-14 bg-[#F5F7FA] p-5 rounded-lg shadow-md border border-[#E8ECF2] z-10 flex flex-col items-center">
              <h4 className="text-xs sm:text-sm font-semibold text-[#4D4D4D] mb-3 leading-snug">
                Revamping the Membership Model with Triathlon Australia
              </h4>
              <button
                onClick={onStartKiosk}
                className="flex items-center gap-1.5 text-xs font-bold text-[#4CAF4F] hover:text-[#388E3C] cursor-pointer"
              >
                <span>Readmore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 9. BOTTOM CALL TO ACTION BANNER ("Pellentesque suscipit") */}
      <section className="bg-[#F5F7FA] py-16 px-4 sm:px-8 text-center border-t border-[#E8ECF2]">
        <div className="max-w-2xl mx-auto space-y-6">
          <h2 className="text-3xl sm:text-5xl font-bold text-[#263238] tracking-tight leading-tight">
            Pellentesque suscipit <br />
            fringilla libero eu.
          </h2>
          <div>
            <button
              onClick={onStartKiosk}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#4CAF4F] hover:bg-[#388E3C] text-white font-medium text-sm rounded-md shadow-sm transition-all active:scale-98 cursor-pointer"
            >
              <span>Get a Demo</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 10. FOOTER MATCHING DARK SLATE #263238 */}
      <footer className="bg-[#263238] text-white py-14 px-4 sm:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-10 text-left">
          {/* Brand + Copyright */}
          <div className="md:col-span-4 space-y-4">
            <div className="flex items-center gap-2.5">
              <svg viewBox="0 0 35 24" fill="none" className="w-8 h-6">
                <path d="M10.8 0L0 12L10.8 24L17.5 16.5L10.8 9L17.5 1.5L10.8 0Z" fill="#4CAF4F" />
                <path d="M24.2 0L17.5 7.5L24.2 15L17.5 22.5L24.2 24L35 12L24.2 0Z" fill="#FFFFFF" />
              </svg>
              <span className="text-2xl font-bold tracking-tight text-white">Nexcent</span>
            </div>
            <p className="text-xs text-[#89939E] leading-relaxed">
              Copyright © 2026 Nexcent Ltd. <br />
              All rights reserved. Book Exchange Library Self Service.
            </p>
          </div>

          {/* Links Column 1: Company */}
          <div className="md:col-span-2 space-y-3">
            <h5 className="text-sm font-semibold text-white">Company</h5>
            <ul className="space-y-2 text-xs text-[#89939E]">
              <li><a href="#about" onClick={onStartKiosk} className="hover:text-white">About us</a></li>
              <li><a href="#blog" onClick={onOpenBooks} className="hover:text-white">Blog</a></li>
              <li><a href="#contact" onClick={onOpenDashboard} className="hover:text-white">Contact us</a></li>
              <li><a href="#pricing" onClick={onStartKiosk} className="hover:text-white">Pricing</a></li>
            </ul>
          </div>

          {/* Links Column 2: Support */}
          <div className="md:col-span-3 space-y-3">
            <h5 className="text-sm font-semibold text-white">Support</h5>
            <ul className="space-y-2 text-xs text-[#89939E]">
              <li><a href="#help" onClick={onStartKiosk} className="hover:text-white">Help center</a></li>
              <li><a href="#terms" onClick={onStartKiosk} className="hover:text-white">Terms of service</a></li>
              <li><a href="#legal" onClick={onStartKiosk} className="hover:text-white">Legal</a></li>
              <li><a href="#privacy" onClick={onStartKiosk} className="hover:text-white">Privacy policy</a></li>
            </ul>
          </div>

          {/* Column 3: Stay up to date newsletter input */}
          <div className="md:col-span-3 space-y-3">
            <h5 className="text-sm font-semibold text-white">Stay up to date</h5>
            <div className="relative">
              <input
                type="email"
                placeholder="Your email address"
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#37474F] text-xs text-white placeholder-[#89939E] focus:outline-hidden focus:ring-1 focus:ring-[#4CAF4F]"
              />
              <button
                onClick={onStartKiosk}
                className="absolute right-2 top-2 p-1 text-[#89939E] hover:text-white"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
