
import React from 'react';

interface Props {
  name: string;
  avatar: string;
  points?: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerAvatar: React.FC<Props> = ({ name, avatar, points, isHost, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-10 h-10' : size === 'lg' ? 'w-16 h-16' : 'w-12 h-12';
  
  return (
    <div className="flex flex-col items-center group">
      <div className={`
        relative ${sizeClass} rounded-xl transition-all duration-200 
        group-hover:scale-110 active:scale-90
        ${isHost ? 'border-[1.5px] border-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.5)]' : 'border border-white/10'}
        bg-slate-800 p-0.5
      `}>
        <img 
          src={avatar} 
          alt={name}
          className="w-full h-full object-cover rounded-lg"
        />
        {isHost && (
          <div className="absolute -top-1.5 -right-1.5 bg-yellow-500 text-[8px] w-4 h-4 rounded-full flex items-center justify-center shadow-lg">
            👑
          </div>
        )}
      </div>
      <p className="mt-1 text-[8px] font-black text-white truncate w-full text-center bg-black/40 px-1 py-0.5 rounded">
        {name}
      </p>
      {points !== undefined && (
        <span className="text-[7px] text-yellow-500 font-bold">{points} XP</span>
      )}
    </div>
  );
};
