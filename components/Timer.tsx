
import React from 'react';

interface Props {
  timeLeft: number;
  totalTime: number;
}

export const Timer: React.FC<Props> = ({ timeLeft, totalTime }) => {
  const percentage = (timeLeft / totalTime) * 100;
  const color = timeLeft < 5 ? 'bg-red-500' : 'bg-blue-500';

  return (
    <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden mb-4 border border-white/10 shadow-inner">
      <div 
        className={`h-full transition-all duration-1000 ease-linear ${color}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
};
