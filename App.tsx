
import React, { useState, useEffect } from 'react';
import { Player, RoomState, ChallengeType } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const POLL_INTERVAL = 2000;

const App: React.FC = () => {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [joinCode, setJoinCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<'start' | 'join' | 'game'>('start');

  useEffect(() => {
    const id = localStorage.getItem('council_pid') || 'p_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('council_pid', id);
    setPlayerId(id);
  }, []);

  // المزامنة التلقائية
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

  const createRoom = async () => {
    if (!playerName) return alert('سجل اسمك يا بطل!');
    setLoading(true);
    const roomId = Math.random().toString(36).substr(2, 5).toUpperCase();
    const newRoom: RoomState = {
      roomId,
      players: [{ id: playerId, name: playerName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, points: 0, roundPoints: 0, isHost: true, isAlive: true, lastSeen: Date.now() }],
      round: 0,
      status: 'lobby',
      timeLeft: 30,
      serverTime: Date.now()
    };
    await storageService.saveRoom(newRoom);
    setRoom(newRoom);
    setView('game');
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName || !joinCode) return alert('أدخل اسمك وكود المجلس!');
    setLoading(true);
    const player: Player = { id: playerId, name: playerName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, points: 0, roundPoints: 0, isHost: false, isAlive: true, lastSeen: Date.now() };
    const updatedRoom = await storageService.joinRoom(joinCode.toUpperCase(), player);
    if (updatedRoom) {
      setRoom(updatedRoom);
      setView('game');
    } else {
      alert('المجلس غير موجود!');
    }
    setLoading(false);
  };

  const startRound = async (mode: ChallengeType) => {
    if (!room) return;
    setLoading(true);
    const challenge = await geminiService.generateChallenge(mode);
    let updatedPlayers = room.players.map(p => ({ ...p, currentVote: undefined, roundPoints: 0 }));
    
    if (mode === ChallengeType.UNDERCOVER) {
      const spyIdx = Math.floor(Math.random() * updatedPlayers.length);
      updatedPlayers = updatedPlayers.map((p, idx) => ({
        ...p,
        role: idx === spyIdx ? 'spy' : 'citizen',
        targetWord: idx === spyIdx ? challenge.spyWord : challenge.secretWord
      }));
    }

    const updatedRoom: RoomState = {
      ...room,
      status: 'playing',
      gamePhase: mode === ChallengeType.UNDERCOVER ? 'discussing' : undefined,
      currentChallenge: challenge,
      players: updatedPlayers,
      round: room.round + 1,
      timeLeft: mode === ChallengeType.UNDERCOVER ? 45 : 25,
      serverTime: Date.now()
    };
    await storageService.saveRoom(updatedRoom);
    setRoom(updatedRoom);
    setLoading(false);
  };

  const submitVote = async (vote: string) => {
    if (!room || room.status !== 'playing') return;
    const updatedRoom = {
      ...room,
      players: room.players.map(p => p.id === playerId ? { ...p, currentVote: vote } : p),
      serverTime: Date.now()
    };
    setRoom(updatedRoom);
    await storageService.saveRoom(updatedRoom);
  };

  const isHost = room?.players.find(p => p.id === playerId)?.isHost;
  const currentPlayer = room?.players.find(p => p.id === playerId);

  if (view === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <div className="animate-float mb-6">
          <span className="text-8xl drop-shadow-[0_0_20px_rgba(251,191,36,0.6)]">🏆</span>
        </div>
        <h1 className="text-4xl font-black text-yellow-500 mb-2">مجلس VIP</h1>
        <p className="text-blue-300 text-xs mb-10 tracking-widest uppercase">The Ultimate Social Game</p>
        
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="وش اسمك باللعبة؟" 
            className="w-full bg-slate-900 border border-yellow-500/30 p-4 rounded-2xl text-center font-bold focus:border-yellow-500 outline-none"
          />
          <button onClick={createRoom} className="w-full btn-ludo-gold py-4 rounded-2xl text-lg">إنشاء مجلس جديد ⚡</button>
          <button onClick={() => setView('join')} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-bold">انضمام لمجلس صديق 👥</button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <h2 className="text-2xl font-black text-white mb-6">أدخل كود المجلس</h2>
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="مثال: A1B2C" 
            className="w-full bg-slate-900 border border-blue-500/30 p-5 rounded-2xl text-center font-black text-2xl tracking-widest outline-none"
          />
          <button onClick={joinRoom} className="w-full btn-ludo-blue py-4 rounded-2xl text-lg">دخول المجلس الآن ✅</button>
          <button onClick={() => setView('start')} className="text-slate-400 text-xs font-bold">رجوع للخلف</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Header المصغر */}
      <div className="p-3 glass-ludo flex justify-between items-center border-b border-yellow-500/20">
        <div className="flex items-center gap-2">
           <span className="bg-yellow-500 text-black text-[10px] font-black px-2 py-0.5 rounded-md">#{room?.roomId}</span>
           <span className="text-[10px] font-bold text-yellow-200">اللاعبين: {room?.players.length}</span>
        </div>
        <button onClick={() => window.location.reload()} className="text-[10px] bg-red-500/20 text-red-400 px-3 py-1 rounded-md font-bold">خروج</button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {room?.status === 'lobby' && (
          <div className="space-y-4">
            <div className="text-center py-4 glass-ludo rounded-3xl border border-white/5">
              <span className="text-4xl">🎮</span>
              <h3 className="text-lg font-black mt-1">بانتظار الربع...</h3>
              <p className="text-[9px] text-blue-300">شارك الكود {room.roomId} مع أصحابك</p>
            </div>

            {/* شبكة اللاعبين المضغوطة */}
            <div className="player-grid glass-ludo rounded-3xl border border-white/5 min-h-[150px]">
              {room.players.map(p => <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} points={p.points} />)}
            </div>

            {isHost && (
              <div className="grid grid-cols-2 gap-2 pt-2">
                <button onClick={() => startRound(ChallengeType.UNDERCOVER)} className="btn-ludo-blue py-3 rounded-xl text-xs">الجاسوس 🕵️‍♂️</button>
                <button onClick={() => startRound(ChallengeType.TRIVIA)} className="btn-ludo-gold py-3 rounded-xl text-xs">تريفيا 🧠</button>
                <button onClick={() => startRound(ChallengeType.STORY)} className="bg-slate-800 py-3 rounded-xl text-xs font-bold border border-white/5">قصة 📖</button>
                <button onClick={() => startRound(ChallengeType.CITY_BUILD)} className="bg-slate-800 py-3 rounded-xl text-xs font-bold border border-white/5">المدينة 🏙️</button>
              </div>
            )}
          </div>
        )}

        {room?.status === 'playing' && (
          <div className="space-y-4">
            <Timer timeLeft={room.timeLeft} totalTime={room.gamePhase === 'discussing' ? 45 : 25} />
            <div className="glass-ludo p-5 rounded-3xl text-center">
              {room.gamePhase === 'discussing' ? (
                <div className="space-y-3">
                  <h3 className="text-lg font-black text-yellow-500">مرحلة الكلام 🗣️</h3>
                  <div className="bg-blue-900/40 p-4 rounded-2xl border border-yellow-500/20">
                    <p className="text-[8px] opacity-60 mb-1 uppercase">كلمتك السرية</p>
                    <p className="text-3xl font-black text-white">{currentPlayer?.targetWord}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <h3 className="text-md font-black">{room.currentChallenge?.title}</h3>
                  <div className="bg-black/20 p-4 rounded-2xl mt-2 font-bold text-sm leading-relaxed">
                    {room.currentChallenge?.question || "من هو الجاسوس؟"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-2 pb-10">
              {(room.gamePhase === 'discussing' ? [] : (room.currentChallenge?.type === ChallengeType.UNDERCOVER ? room.players.map(p => p.name) : room.currentChallenge?.options))?.map((opt, i) => (
                <button 
                  key={i}
                  disabled={!!currentPlayer?.currentVote}
                  onClick={() => submitVote(opt || '')}
                  className={`
                    p-4 rounded-2xl font-black text-right transition-all border
                    ${currentPlayer?.currentVote === opt ? 'border-yellow-400 bg-blue-600' : 'border-white/5 bg-slate-900/60'}
                    ${!!currentPlayer?.currentVote && currentPlayer.currentVote !== opt ? 'opacity-40' : ''}
                    text-sm
                  `}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Player Footer Bar */}
      <div className="p-3 glass-ludo border-t border-yellow-500/20 flex justify-between items-center safe-bottom">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl border border-yellow-500 overflow-hidden">
            <img src={currentPlayer?.avatar} className="w-full h-full object-cover" />
          </div>
          <div>
            <p className="text-[10px] font-black leading-tight">{playerName}</p>
            <p className="text-[8px] text-yellow-500 font-bold uppercase">{currentPlayer?.points} XP Points</p>
          </div>
        </div>
        <div className="bg-blue-600/20 px-4 py-2 rounded-xl border border-blue-500/30">
           <span className="text-[10px] font-black text-blue-400">VIP PLAYER</span>
        </div>
      </div>
    </div>
  );
};

export default App;
