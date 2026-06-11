import { useState, useEffect } from "react";

interface GifViewerProps {
  frameImages: Record<string, string>;
}

export default function GifViewer({ frameImages }: GifViewerProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const keys = Object.keys(frameImages).sort();
  const total = keys.length;

  useEffect(() => {
    if (total < 2) return;
    const iv = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % total);
    }, 700);
    return () => clearInterval(iv);
  }, [total]);

  const currentSrc = frameImages[keys[activeIndex]];

  return (
    <div className="relative w-full rounded-2xl overflow-hidden border border-slate-200">
      <img
        src={currentSrc}
        alt={`Frame ${activeIndex + 1}`}
        className="w-full object-cover"
      />
      {total > 1 && (
        <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5">
          {keys.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`w-2 h-2 rounded-full transition-all cursor-pointer ${
                activeIndex === i
                  ? 'bg-white scale-125 shadow'
                  : 'bg-white/50 hover:bg-white/80'
              }`}
            />
          ))}
        </div>
      )}
      <div className="absolute top-2 right-2 bg-black/50 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
        GIF · F{activeIndex + 1}/{total}
      </div>
    </div>
  );
}
