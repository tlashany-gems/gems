
import React from 'react';

interface Props {
  name: string;
  avatar: string;
  points?: number;
  isHost?: boolean;
}

export const PlayerAvatar: React.FC<Props> = ({ name, avatar, points, isHost }) => {
  return (
    <div className="flex flex-col items-center group w-full">
      <div className={`
        relative w-10 h-10 rounded-lg transition-all duration-200 
        group-hover:scale-105 active:scale-90
        ${isHost ? 'border-[1.5px] border-yellow-400 shadow-[0_0_5px_rgba(251,191,36,0.4)]' : 'border border-white/10'}
        bg-slate-800 p-0.5
      `}>
        <img 
          src={avatar} 
          alt={name}
          className="w-full h-full object-cover rounded-md"
        />
        {isHost && (
          <div className="absolute -top-1 -right-1 bg-yellow-500 text-[6px] w-3 h-3 rounded-full flex items-center justify-center shadow-lg">
            👑
          </div>
        )}
      </div>
      <p className="mt-0.5 text-[7px] font-black text-white truncate w-full text-center bg-black/60 px-0.5 rounded leading-none">
        {name}
      </p>
    </div>
  );
};
