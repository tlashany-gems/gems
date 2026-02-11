
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
    <div className="flex flex-col items-center">
      <div className={`relative ${sizeClass} rounded-full border-2 border-blue-500 overflow-hidden bg-slate-800 flex items-center justify-center`}>
        <img 
          src={avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`} 
          alt={name}
          className="w-full h-full object-cover"
        />
        {isHost && (
          <div className="absolute top-0 right-0 bg-yellow-500 text-[10px] px-1 rounded-bl-md font-bold text-black">
            مضيف
          </div>
        )}
      </div>
      <span className="text-xs mt-1 font-bold text-slate-200 truncate w-20 text-center">{name}</span>
      {points !== undefined && (
        <span className="text-[10px] text-blue-400 font-bold">{points} نقطة</span>
      )}
    </div>
  );
};
