import { useEffect, useState } from 'react';

export default function PageLoader({ text = 'Loading...', fullScreen = false }) {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      className={`${
        fullScreen 
          ? 'fixed inset-0 z-[100] bg-[#FAF7F2]' 
          // If not full screen, use absolute inset-0 to center inside the parent,
          // OR fixed inset-0 to just take over the screen.
          : 'fixed inset-0 z-50 bg-[#FAF7F2]' 
      } flex flex-col items-center justify-center overflow-hidden`}
      // Note: Using fixed inset-0 ensures it always centers on the screen, ignoring parent container heights.
    >
      {/* Ambient background glow */}
      <div
        className="absolute pointer-events-none w-[500px] h-[500px] rounded-full opacity-60"
        style={{
          background:
            'radial-gradient(circle, rgba(242,106,27,0.12) 0%, rgba(242,106,27,0) 70%)',
        }}
      />

      <div className="relative flex flex-col items-center gap-6">
        {/* Pulsing Logo */}
        <div className="relative">
          <div className="absolute inset-0 rounded-3xl bg-primary/20 animate-ping" />
          <div className="absolute -inset-4 rounded-[2rem] bg-primary/10 animate-pulse" />

          <div className="relative w-16 h-16 md:w-20 md:h-20 rounded-2xl md:rounded-3xl bg-white flex items-center justify-center shadow-xl shadow-primary/20 ring-1 ring-black/5 overflow-hidden p-3">
            <img
              src="/MB.png"
              alt="Media Box"
              className="w-full h-full object-contain animate-[pulse_2s_ease-in-out_infinite]"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.parentElement.innerHTML =
                  '<span class="font-bold text-primary text-xl md:text-2xl">MB</span>';
              }}
            />
          </div>
        </div>

        {/* Text & Dots */}
        <div className="flex flex-col items-center gap-1.5 mt-2">
          <h2 className="text-xs md:text-sm font-bold tracking-[0.2em] text-textDark uppercase">
            Media Box
          </h2>
          <p className="text-[10px] md:text-[11px] font-medium text-textLight tracking-wide flex items-center">
            {text.replace('...', '')}
            {dots}
          </p>
        </div>

        {/* Sliding Progress Bar */}
        <div className="w-40 md:w-48 h-1.5 bg-border/50 rounded-full overflow-hidden mt-2">
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