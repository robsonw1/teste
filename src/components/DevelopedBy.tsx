import React from 'react';

const DevelopedBy: React.FC<{ className?: string }> = ({ className }) => {
  return (
    <div className={`mt-6 text-center text-xs text-muted-foreground ${className || ''}`}>
      <a
        href="https://smartmenu.aezap.site/"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 text-[13px] text-white-900 hover:text-blue-700 transition-colors duration-200"
        aria-label="Desenvolvido por ÆZap - abre em nova aba"
      >
        <span className="opacity-80">Desenvolvido por</span>
        <span
          className="font-semibold tracking-wide ml-1 transform transition-transform duration-500 hover:translate-y-[-2px]"
          style={{ letterSpacing: '-0.5px' }}
        >
          <span className="text-[13px] md:text-sm font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">ÆZap</span>
        </span>
        <svg className="w-3 h-3 ml-1 opacity-60" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3h7v7m0 0L10 14M21 10L10 21" />
        </svg>
      </a>
    </div>
  );
};

export default DevelopedBy;
