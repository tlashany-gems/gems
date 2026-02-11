
import React, { useState, useEffect, useRef } from 'react';
import { Player, RoomState, ChallengeType, Challenge } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const POLL_INTERVAL = 2000; // استطلاع كل ثانيتين لمحاكاة السيرفر

const App: React.FC = () => {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [loading, setLoading] = useState(false);
  
  const isHost = room?.players.find(p => p.id === playerId)?.isHost;

  // تأثير المزامنة التلقائية (محاكاة السيرفر)
  useEffect(() => {
    let interval: number;
    if (room?.roomId) {
      interval = window.setInterval(async () => {
        const latestRoom = await storageService.getRoom(room.roomId);
        if (latestRoom && latestRoom.serverTime !== room.serverTime) {
          setRoom(latestRoom);
        }
      }, POLL_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [room?.roomId, room?.serverTime]);

  const initPlayer = () => {
    const id = 'p_' + Math.random().toString(36).substr(2, 9);
    setPlayerId(id);
    return id;
  };

  const createRoom = async () => {
    if (!playerName) return alert('سجل اسمك أولاً!');
    setLoading(true);
    const id = initPlayer();
    const roomId = Math.random().toString(36).substr(2, 5).toUpperCase();
    const newRoom: RoomState = {
      roomId,
      players: [{ id, name: playerName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, points: 0, roundPoints: 0, isHost: true, isAlive: true, lastSeen: Date.now() }],
      round: 0,
      status: 'lobby',
      timeLeft: 30,
      serverTime: Date.now()
    };
    await storageService.saveRoom(newRoom);
    setRoom(newRoom);
    setLoading(false);
  };

  const startRound = async (mode: ChallengeType) => {
    if (!room || !isHost) return;
    setLoading(true);
    const challenge = await geminiService.generateChallenge(mode);
    
    // خوارزمية توزيع الكلمات (الدقة 100%)
    let updatedPlayers = [...room.players];
    if (mode === ChallengeType.UNDERCOVER) {
      const spyIdx = Math.floor(Math.random() * updatedPlayers.length);
      updatedPlayers = updatedPlayers.map((p, idx) => ({
        ...p,
        role: idx === spyIdx ? 'spy' : 'citizen',
        targetWord: idx === spyIdx ? challenge.spyWord : challenge.secretWord,
        currentVote: undefined,
        roundPoints: 0
      }));
    } else {
      updatedPlayers = updatedPlayers.map(p => ({ ...p, currentVote: undefined, roundPoints: 0 }));
    }

    const updatedRoom: RoomState = {
      ...room,
      status: 'playing',
      gamePhase: mode === ChallengeType.UNDERCOVER ? 'discussing' : undefined,
      currentChallenge: challenge,
      players: updatedPlayers,
      round: room.round + 1,
      timeLeft: mode === ChallengeType.UNDERCOVER ? 45 : 25
    };
    await storageService.saveRoom(updatedRoom);
    setRoom(updatedRoom);
    setLoading(false);
  };

  const submitVote = async (vote: string) => {
    if (!room || room.status !== 'playing') return;
    const updatedRoom = {
      ...room,
      players: room.players.map(p => p.id === playerId ? { ...p, currentVote: vote } : p)
    };
    setRoom(updatedRoom);
    await storageService.saveRoom(updatedRoom);
  };

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 relative">
        <div className="z-10 bg-slate-900/80 p-8 rounded-[2.5rem] border border-yellow-500/30 backdrop-blur-md shadow-2xl w-full max-w-xs text-center">
          <div className="text-6xl mb-4">👑</div>
          <h1 className="text-3xl font-black text-yellow-500 mb-6">مجلس VIP</h1>
          <input 
            type="text" 
            placeholder="ادخل اسمك..." 
            className="w-full bg-slate-800 border border-white/10 p-4 rounded-2xl text-center mb-4 focus:border-yellow-500 outline-none"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
          />
          <button 
            onClick={createRoom}
            className="w-full btn-ludo-gold py-4 rounded-2xl font-black text-lg shadow-lg active:scale-95 transition-all"
          >
            {loading ? 'انتظر...' : 'إنشاء مجلس ⚡'}
          </button>
        </div>
      </div>
    );
  }

  const currentPlayer = room.players.find(p => p.id === playerId);

  return (
    <div className="flex flex-col h-screen text-white font-['Cairo'] relative overflow-hidden">
      {/* Top Bar */}
      <div className="p-4 flex justify-between items-center glass-ludo border-b border-yellow-500/20">
        <div className="flex items-center gap-2">
          <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-full">{room.roomId}</span>
          <span className="text-xs font-bold text-yellow-200">مجلسنا</span>
        </div>
        <div className="flex -space-x-2">
          {room.players.map(p => (
            <div key={p.id} className="w-8 h-8 rounded-full border border-slate-900 overflow-hidden">
              <img src={p.avatar} className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {room.status === 'lobby' && (
          <div className="space-y-6 text-center">
            <div className="py-10">
              <span className="text-7xl animate-bounce inline-block">🎮</span>
              <h2 className="text-2xl font-black mt-4">بانتظار الربع...</h2>
            </div>
            
            <div className="flex flex-wrap justify-center gap-4">
              {room.players.map(p => <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} points={p.points} />)}
            </div>

            {isHost && (
              <div className="grid grid-cols-1 gap-3 pt-10">
                <button onClick={() => startRound(ChallengeType.UNDERCOVER)} className="btn-ludo-blue py-4 rounded-2xl font-black shadow-xl">لعبة الجاسوس 🕵️‍♂️</button>
                <button onClick={() => startRound(ChallengeType.TRIVIA)} className="bg-slate-800 border border-white/10 py-4 rounded-2xl font-black">تريفيا سريعة 🧠</button>
              </div>
            )}
          </div>
        )}

        {room.status === 'playing' && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <Timer timeLeft={room.timeLeft} totalTime={room.currentChallenge?.type === ChallengeType.UNDERCOVER ? 45 : 25} />
            
            <div className="glass-ludo p-6 rounded-[2rem] border-t-4 border-yellow-500/50 text-center">
              {room.gamePhase === 'discussing' ? (
                <div className="space-y-4">
                  <h3 className="text-xl font-black text-yellow-400">وقت النقاش! 🗣️</h3>
                  <div className="bg-blue-900/50 p-6 rounded-2xl border border-yellow-500/20">
                    <p className="text-xs opacity-60 mb-1">كلمتك السرية</p>
                    <p className="text-4xl font-black">{currentPlayer?.targetWord}</p>
                  </div>
                  <p className="text-[10px] text-blue-200">اسألوا بعضكم البعض بحذر لتعرفوا الدخيل</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xl font-black">{room.currentChallenge?.title}</h3>
                  <p className="text-xs text-blue-100/70">{room.currentChallenge?.description}</p>
                  <div className="bg-white/5 p-4 rounded-xl mt-4 font-bold text-lg">
                    {room.currentChallenge?.question || "من هو الجاسوس؟"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(room.gamePhase === 'discussing' ? [] : (room.currentChallenge?.type === ChallengeType.UNDERCOVER ? room.players.map(p => p.name) : room.currentChallenge?.options))?.map((opt, i) => (
                <button 
                  key={i}
                  disabled={!!currentPlayer?.currentVote}
                  onClick={() => submitVote(opt || '')}
                  className={`
                    p-5 rounded-2xl font-black text-right transition-all border-2
                    ${currentPlayer?.currentVote === opt ? 'border-yellow-400 bg-blue-600' : 'border-white/5 bg-slate-800/80'}
                    ${!!currentPlayer?.currentVote && currentPlayer.currentVote !== opt ? 'opacity-40' : ''}
                  `}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-4 glass-ludo border-t border-white/10 flex justify-between items-center safe-bottom">
        <div className="flex items-center gap-3">
          <img src={currentPlayer?.avatar} className="w-10 h-10 rounded-xl border border-yellow-500" />
          <div className="text-right">
            <p className="text-xs font-black">{playerName}</p>
            <p className="text-[10px] text-yellow-500">{currentPlayer?.points} XP</p>
          </div>
        </div>
        <button onClick={() => window.location.reload()} className="bg-red-500/10 text-red-500 text-[10px] font-black px-4 py-2 rounded-xl border border-red-500/20">خروج</button>
      </div>
    </div>
  );
};

export default App;
