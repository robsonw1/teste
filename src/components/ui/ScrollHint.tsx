import * as React from 'react';

interface ScrollHintProps {
  show?: boolean;
  className?: string;
}

const ScrollHint: React.FC<ScrollHintProps> = ({ show = true, className = '' }) => {
  if (!show) return null;
  return (
    <div className={`pointer-events-none fixed left-1/2 transform -translate-x-1/2 bottom-24 z-50 flex flex-col items-center space-y-1 animate-fade-in ${className}`}>
      <div className="text-sm bg-black/70 text-white px-3 py-1 rounded">Mais opções abaixo</div>
      <div className="w-8 h-8 flex items-center justify-center">
        <svg className="animate-bounce text-white" width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 5v14M5 12l7 7 7-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}

export default ScrollHint;
