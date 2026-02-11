
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, RoomState, ChallengeType, Challenge } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

// Constants
const ROUND_TIME = 20;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<RoomState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(`seed-${Math.random()}`);
  
  // Fix: Use ReturnType<typeof setInterval> instead of NodeJS.Timeout for browser compatibility
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Sound effects mock
  const playSound = (type: 'win' | 'click' | 'tick') => {
    console.log(`[Sound] Playing ${type}`);
  };

  const createRoom = async () => {
    if (!nameInput) return;
    setLoading(true);
    const roomId = Math.random().toString(36).substring(7).toUpperCase();
    const host: Player = {
      id: 'host-' + Date.now(),
      name: nameInput,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`,
      points: 0,
      isHost: true,
      isAlive: true
    };

    const newRoom: RoomState = {
      roomId,
      players: [host],
      round: 0,
      status: 'lobby',
      timeLeft: ROUND_TIME,
      history: []
    };

    await storageService.saveRoom(newRoom);
    setGameState(newRoom);
    setCurrentPlayer(host);
    setLoading(false);
    playSound('click');
  };

  const joinRoom = async () => {
    if (!roomInput || !nameInput) return;
    setLoading(true);
    const room = await storageService.getRoom(roomInput.toUpperCase());
    if (room) {
      const newPlayer: Player = {
        id: 'player-' + Date.now(),
        name: nameInput,
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`,
        points: 0,
        isHost: false,
        isAlive: true
      };
      room.players.push(newPlayer);
      await storageService.saveRoom(room);
      setGameState(room);
      setCurrentPlayer(newPlayer);
    } else {
      alert('الغرفة غير موجودة!');
    }
    setLoading(false);
  };

  const startNextRound = useCallback(async () => {
    if (!gameState || !currentPlayer?.isHost) return;

    setLoading(true);
    const types = Object.values(ChallengeType);
    const randomType = types[Math.floor(Math.random() * types.length)];
    const challenge = await geminiService.generateChallenge(randomType);

    const updatedRoom: RoomState = {
      ...gameState,
      status: 'playing',
      round: gameState.round + 1,
      currentChallenge: challenge,
      timeLeft: ROUND_TIME,
      players: gameState.players.map(p => ({ ...p, currentVote: undefined }))
    };

    await storageService.saveRoom(updatedRoom);
    setGameState(updatedRoom);
    setLoading(false);
  }, [gameState, currentPlayer]);

  useEffect(() => {
    if (gameState?.status === 'playing' && gameState.timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setGameState(prev => {
          if (!prev) return null;
          if (prev.timeLeft <= 1) {
            if (timerRef.current) clearInterval(timerRef.current);
            return { ...prev, timeLeft: 0, status: 'round_end' };
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [gameState?.status, gameState?.timeLeft]);

  const handleVote = async (option: string) => {
    if (!gameState || !currentPlayer || gameState.status !== 'playing') return;
    
    // Check if correct
    let pointsToAdd = 0;
    if (gameState.currentChallenge?.correctAnswer === option) {
      // Logic for speed: fastest get 3, 2nd gets 2, others 1
      const alreadyAnsweredCount = gameState.players.filter(p => p.currentVote).length;
      pointsToAdd = alreadyAnsweredCount === 0 ? 3 : alreadyAnsweredCount === 1 ? 2 : 1;
      playSound('win');
    }

    const updatedPlayers = gameState.players.map(p => 
      p.id === currentPlayer.id 
        ? { ...p, currentVote: option, points: p.points + pointsToAdd } 
        : p
    );

    const updatedRoom: RoomState = {
      ...gameState,
      players: updatedPlayers
    };
    
    setGameState(updatedRoom);
    setCurrentPlayer(prev => prev ? { ...prev, points: prev.points + pointsToAdd, currentVote: option } : null);
    await storageService.saveRoom(updatedRoom);
  };

  // Render Screens
  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
        <div className="text-center space-y-2 animate-float">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">مجلس التحدي</h1>
          <p className="text-slate-400 font-medium">اللعبة الجماعية الأكثر حماساً</p>
        </div>

        <div className="glass w-full p-8 rounded-3xl shadow-2xl border-white/5 space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center mb-4">
              <img 
                src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`} 
                className="w-24 h-24 rounded-full border-4 border-blue-500 bg-slate-800 p-1 mb-2"
                alt="Avatar"
              />
              <button 
                onClick={() => setSelectedAvatar(`seed-${Math.random()}`)}
                className="text-xs text-blue-400 font-bold hover:underline"
              >
                تغيير الشخصية
              </button>
            </div>
            
            <input 
              type="text" 
              placeholder="أدخل اسمك..." 
              className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-center font-bold"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
            />
            
            <div className="h-px bg-slate-800 my-4" />

            <button 
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
            >
              إنشاء غرفة جديدة
            </button>

            <div className="relative flex items-center py-2">
              <div className="flex-grow border-t border-slate-800"></div>
              <span className="flex-shrink mx-4 text-slate-500 text-sm">أو</span>
              <div className="flex-grow border-t border-slate-800"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="كود الغرفة" 
                className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500 outline-none text-center uppercase"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
              />
              <button 
                onClick={joinRoom}
                disabled={loading}
                className="bg-purple-600 hover:bg-purple-500 text-white font-bold px-6 py-3 rounded-xl shadow-lg transition-transform active:scale-95 disabled:opacity-50"
              >
                انضمام
              </button>
            </div>
          </div>
        </div>
        
        <p className="text-slate-600 text-[10px] fixed bottom-4">الإصدار 1.0.4 - جميع الحقوق محفوظة</p>
      </div>
    );
  }

  // Lobby Screen
  if (gameState.status === 'lobby') {
    return (
      <div className="min-h-screen p-6 flex flex-col space-y-6">
        <header className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-white/5">
          <div>
            <h2 className="text-sm text-slate-400">كود الغرفة</h2>
            <p className="text-2xl font-black text-blue-400">{gameState.roomId}</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm text-slate-400">اللاعبين</h2>
            <p className="text-2xl font-black text-white">{gameState.players.length}</p>
          </div>
        </header>

        <main className="flex-1 glass rounded-3xl p-6 overflow-y-auto">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            في الانتظار...
          </h3>
          <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
            {gameState.players.map(player => (
              <PlayerAvatar 
                key={player.id} 
                name={player.name} 
                avatar={player.avatar} 
                isHost={player.isHost}
              />
            ))}
            {/* Simulation of many players */}
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex flex-col items-center opacity-30">
                <div className="w-14 h-14 rounded-full border-2 border-dashed border-slate-600 flex items-center justify-center">
                  <span className="text-lg">+</span>
                </div>
                <span className="text-[10px] mt-1">بانتظار...</span>
              </div>
            ))}
          </div>
        </main>

        <footer className="sticky bottom-0 pb-4">
          {currentPlayer?.isHost ? (
            <button 
              onClick={startNextRound}
              disabled={loading || gameState.players.length < 1}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black py-5 rounded-2xl shadow-xl hover:brightness-110 active:scale-95 transition-all text-xl"
            >
              {loading ? 'جاري التحميل...' : 'ابدأ اللعبة!'}
            </button>
          ) : (
            <div className="bg-slate-800/80 p-5 rounded-2xl text-center border border-blue-500/20">
              <p className="text-blue-300 font-bold">بانتظار المضيف لبدء التحدي...</p>
            </div>
          )}
        </footer>
      </div>
    );
  }

  // Playing Screen
  return (
    <div className="min-h-screen p-4 flex flex-col space-y-4">
      {/* HUD */}
      <div className="flex justify-between items-center px-2">
        <div className="flex items-center gap-2">
          <div className="bg-slate-800 px-4 py-1 rounded-full border border-white/10">
            <span className="text-xs text-slate-400 ml-2">الجولة</span>
            <span className="font-bold text-lg">{gameState.round}</span>
          </div>
        </div>
        <div className="bg-blue-600/20 px-4 py-1 rounded-full border border-blue-500/30">
          <span className="text-blue-400 font-bold">{currentPlayer?.points} نقطة</span>
        </div>
      </div>

      <Timer timeLeft={gameState.timeLeft} totalTime={ROUND_TIME} />

      {/* Challenge Card */}
      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="glass w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col">
          {/* Challenge Type Badge */}
          <div className="absolute top-4 left-4 bg-purple-600 text-[10px] px-3 py-1 rounded-full font-bold uppercase tracking-widest shadow-lg">
            {gameState.currentChallenge?.type}
          </div>

          <div className="text-center space-y-4 mt-6">
            <h2 className="text-2xl font-black text-white leading-tight">
              {gameState.currentChallenge?.title}
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              {gameState.currentChallenge?.description}
            </p>

            {gameState.status === 'playing' ? (
              <div className="py-6 space-y-6">
                <div className="text-xl font-bold text-blue-300 bg-slate-900/50 p-4 rounded-2xl border border-blue-500/10">
                  {gameState.currentChallenge?.question}
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {gameState.currentChallenge?.options?.map((option, idx) => (
                    <button
                      key={idx}
                      disabled={!!currentPlayer?.currentVote}
                      onClick={() => handleVote(option)}
                      className={`
                        w-full py-4 px-6 rounded-2xl font-bold text-right transition-all transform active:scale-[0.98] border-2
                        ${currentPlayer?.currentVote === option 
                          ? 'bg-blue-600 border-white text-white shadow-blue-500/50 shadow-lg' 
                          : 'bg-slate-800/50 border-white/5 hover:border-blue-500/50 text-slate-200'}
                        ${currentPlayer?.currentVote && currentPlayer?.currentVote !== option ? 'opacity-50 grayscale-[0.5]' : ''}
                      `}
                    >
                      <span className="ml-4 text-blue-400">●</span>
                      {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Round End Results
              <div className="py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="text-3xl font-black text-green-400">انتهى الوقت!</div>
                <div className="bg-green-500/10 p-6 rounded-3xl border border-green-500/20">
                  <p className="text-slate-400 text-xs mb-2">الإجابة الصحيحة كانت:</p>
                  <p className="text-2xl font-bold text-white">{gameState.currentChallenge?.correctAnswer}</p>
                </div>
                
                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-slate-500">نتائج الجولة</h4>
                  <div className="flex flex-wrap justify-center gap-2">
                    {gameState.players.map(p => (
                      <div key={p.id} className="relative">
                        <PlayerAvatar name={p.name} avatar={p.avatar} size="sm" />
                        {p.currentVote === gameState.currentChallenge?.correctAnswer && (
                          <div className="absolute -top-1 -right-1 bg-green-500 rounded-full w-4 h-4 flex items-center justify-center text-[10px]">
                            ✓
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {currentPlayer?.isHost && (
                  <button 
                    onClick={startNextRound}
                    className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-xl shadow-lg mt-4"
                  >
                    الجولة التالية
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Real-time feed/ticker */}
      <footer className="h-16 flex items-center overflow-hidden">
        <div className="flex gap-4 animate-marquee whitespace-nowrap">
           {gameState.players.filter(p => p.currentVote).map(p => (
             <div key={p.id} className="bg-slate-800/50 px-3 py-1 rounded-full text-[10px] text-slate-300 border border-white/5">
               {p.name} قام بالإجابة!
             </div>
           ))}
        </div>
      </footer>
    </div>
  );
};

export default App;
