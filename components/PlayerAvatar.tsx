
import React from 'react';

interface Props {
  name: string;
  avatar: string;
  points?: number;
  isHost?: boolean;
}

export const PlayerAvatar: React.FC<Props> = ({ name, avatar, points, isHost }) => {
  return (
    <div className="flex flex-col items-center w-full animate-in fade-in zoom-in duration-300">
      <div className={`
        relative w-9 h-9 rounded-lg border transition-all
        ${isHost ? 'border-yellow-400 shadow-[0_0_8px_rgba(251,191,36,0.3)] scale-110' : 'border-white/10'}
        bg-slate-800/80 backdrop-blur-sm p-0.5
      `}>
        <img 
          src={avatar} 
          alt={name}
          className="w-full h-full object-cover rounded-md"
        />
        {isHost && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 text-[6px] w-3 h-3 rounded-full flex items-center justify-center border border-slate-900">
            👑
          </div>
        )}
      </div>
      <p className="mt-0.5 text-[7px] font-bold text-white/90 truncate w-full text-center bg-black/40 px-0.5 rounded-sm">
        {name.split(' ')[0]}
      </p>
    </div>
  );
};
