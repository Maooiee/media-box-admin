import { useEffect, useState } from 'react';

export default function LoadingScreen() {
  const [dots, setDots] = useState('');

  // Animated dots for the text
  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-[#FAF7F2] overflow-hidden">
      
      {/* Ambient background glow */}
      <div
        className="absolute pointer-events-none w-[600px] h-[600px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.12) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      {/* Logo & Loader Container */}
      <div className="relative flex flex-col items-center gap-6">
        
        {/* Pulsing Logo */}
        <div className="relative">
          {/* Outer pulse rings */}
          <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping" />
          <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 animate-pulse" />
          
          {/* Logo Tile */}
          <div className="relative w-20 h-20 rounded-3xl bg-white flex items-center justify-center shadow-xl shadow-primary/20 ring-1 ring-black/5 overflow-hidden p-3">
            <img 
              src="/MB.png" 
              alt="Media Box" 
              className="w-full h-full object-contain animate-[pulse_2s_ease-in-out_infinite]"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML = '<span class="font-bold text-primary text-2xl">MB</span>';
              }}
            />
          </div>
        </div>

        {/* Text & Dots */}
        <div className="flex flex-col items-center gap-1.5 mt-2">
          <h2 className="text-sm font-bold tracking-[0.2em] text-textDark uppercase">
            Media Box
          </h2>
          <p className="text-[11px] font-medium text-textLight tracking-wide flex items-center">
            Loading{dots}
          </p>
        </div>

        {/* Sliding Progress Bar */}
        <div className="w-48 h-1.5 bg-border/50 rounded-full overflow-hidden mt-2">
          <div className="h-full bg-gradient-to-r from-primary to-primary-dark rounded-full w-1/2 animate-[slideRight_1.5s_ease-in-out_infinite]" />
        </div>

      </div>

      {/* Inline Keyframes for the sliding bar */}
      <style>
        {`
          @keyframes slideRight {
            0% { transform: translateX(-100%); }
            100% { transform: translateX(200%); }
          }
        `}
      </style>
    </div>
  );
}