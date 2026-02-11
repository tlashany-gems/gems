
import React from 'react';

interface Props {
  name: string;
  avatar: string;
  points?: number;
  isHost?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const PlayerAvatar: React.FC<Props> = ({ name, avatar, points, isHost, size = 'md' }) => {
  const sizeClass = size === 'sm' ? 'w-12 h-12' : size === 'lg' ? 'w-24 h-24' : 'w-16 h-16';
  const frameClass = isHost ? 'border-[3px] border-[#fbbf24] shadow-[0_0_15px_rgba(251,191,36,0.5)]' : 'border-2 border-white/20 shadow-lg';
  
  return (
    <div className="flex flex-col items-center group cursor-pointer transition-transform duration-200 active:scale-90 hover:scale-105">
      <div className={`relative ${sizeClass} rounded-2xl ${frameClass} overflow-hidden bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center p-0.5`}>
        <img 
          src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
          alt={name}
          className="w-full h-full object-cover rounded-[0.8rem]"
        />
        {isHost && (
          <div className="absolute -top-1 -right-1 bg-gradient-to-r from-yellow-300 to-yellow-600 w-6 h-6 rounded-full flex items-center justify-center shadow-md animate-bounce">
            <span className="text-[12px]">👑</span>
          </div>
        )}
      </div>
      <div className="mt-2 bg-black/40 px-3 py-0.5 rounded-full border border-white/5 backdrop-blur-sm">
        <span className="text-[10px] font-black text-white truncate max-w-[70px] block">{name}</span>
      </div>
      {points !== undefined && (
        <div className="flex items-center gap-1 mt-1">
           <span className="text-[10px] font-black text-yellow-400 drop-shadow-sm">{points}</span>
           <span className="text-[8px] font-bold text-slate-400 uppercase">Pts</span>
        </div>
      )}
    </div>
  );
};
