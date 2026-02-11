
import React from 'react';

interface Props {
  name: string;
  avatar: string;
  points?: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerAvatar: React.FC<Props> = ({ name, avatar, points, isHost, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-20 h-20' : 'w-14 h-14';
  
  return (
    <div className="flex flex-col items-center group cursor-pointer">
      <div className={`
        relative ${sizeClass} rounded-2xl overflow-visible transition-all duration-300 
        group-hover:scale-110 group-active:scale-95
        ${isHost ? 'border-2 border-yellow-400 animate-gold shadow-[0_0_10px_rgba(251,191,36,0.4)]' : 'border border-white/20'}
        bg-slate-800 p-0.5
      `}>
        <img 
          src={avatar} 
          alt={name}
          className="w-full h-full object-cover rounded-xl"
        />
        {isHost && (
          <div className="absolute -top-2 -right-2 bg-yellow-500 text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-lg border border-yellow-200">
            👑
          </div>
        )}
      </div>
      <div className="mt-1.5 max-w-[60px]">
        <p className="text-[9px] font-black text-white truncate text-center bg-black/30 px-2 py-0.5 rounded-full">
          {name}
        </p>
      </div>
    </div>
  );
};
