
import React, { useState, useEffect } from 'react';
import { Player, RoomState, ChallengeType } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const POLL_INTERVAL = 2500; // استطلاع كل 2.5 ثانية لتجنب ضغط الشبكة

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

  // المزامنة السحابية الدورية
  useEffect(() => {
    let interval: number;
    if (room?.roomId && view === 'game') {
      interval = window.setInterval(async () => {
        const latestRoom = await storageService.getRoom(room.roomId);
        if (latestRoom && latestRoom.serverTime !== room.serverTime) {
          setRoom(latestRoom);
        }
      }, POLL_INTERVAL);
    }
    return () => clearInterval(interval);
  }, [room?.roomId, room?.serverTime, view]);

  const createRoom = async () => {
    if (!playerName.trim()) return alert('أدخل اسمك أولاً!');
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
    if (!playerName.trim() || !joinCode.trim()) return alert('أدخل الكود واسمك!');
    setLoading(true);
    const player: Player = { id: playerId, name: playerName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, points: 0, roundPoints: 0, isHost: false, isAlive: true, lastSeen: Date.now() };
    const updatedRoom = await storageService.joinRoom(joinCode.toUpperCase(), player);
    if (updatedRoom) {
      setRoom(updatedRoom);
      setView('game');
    } else {
      alert('المجلس غير موجود! تأكد من الكود.');
    }
    setLoading(false);
  };

  const startRound = async (mode: ChallengeType) => {
    if (!room) return;
    setLoading(true);
    try {
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
    } catch (e) {
      alert("فشل بدء الجولة، حاول مرة أخرى.");
    }
    setLoading(false);
  };

  const isHost = room?.players.find(p => p.id === playerId)?.isHost;
  const currentPlayer = room?.players.find(p => p.id === playerId);

  if (view === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6">
        <div className="animate-float mb-4 text-7xl">👑</div>
        <h1 className="text-3xl font-black text-yellow-500 mb-8">مجلس VIP</h1>
        <div className="w-full max-w-xs space-y-3">
          <input 
            type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="اسمك المستعار..." 
            className="w-full bg-slate-900 border border-yellow-500/20 p-4 rounded-xl text-center font-bold outline-none"
          />
          <button onClick={createRoom} className="w-full btn-ludo-gold py-4 rounded-xl text-md">أنشئ مجلسك ⚡</button>
          <button onClick={() => setView('join')} className="w-full bg-white/5 border border-white/10 py-4 rounded-xl font-bold">انضم لصديق 👥</button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <h2 className="text-xl font-black mb-6">أدخل كود المجلس</h2>
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="كود الغرفة" 
            className="w-full bg-slate-900 border border-blue-500/30 p-4 rounded-xl text-center font-black text-xl tracking-widest outline-none"
          />
          <button onClick={joinRoom} disabled={loading} className="w-full btn-ludo-blue py-4 rounded-xl">
            {loading ? 'جاري البحث...' : 'دخول المجلس ✅'}
          </button>
          <button onClick={() => setView('start')} className="text-slate-400 text-xs font-bold">تراجع</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden text-white">
      {/* Mini Header */}
      <div className="p-2 glass-ludo flex justify-between items-center border-b border-yellow-500/10">
        <div className="flex items-center gap-1.5">
           <span className="bg-yellow-500 text-black text-[9px] font-black px-1.5 py-0.5 rounded">#{room?.roomId}</span>
           <span className="text-[9px] font-bold text-yellow-200">{room?.players.length} لاعب</span>
        </div>
        <button onClick={() => window.location.reload()} className="text-[8px] opacity-60 font-bold uppercase">خروج</button>
      </div>

      <div className="flex-1 overflow-hidden p-2 flex flex-col">
        {room?.status === 'lobby' && (
          <div className="flex-1 flex flex-col">
            {/* اللوبي المصغر */}
            <div className="text-center py-2 mb-2 glass-ludo rounded-2xl border border-white/5">
              <h3 className="text-xs font-black">انتظار اللاعبين...</h3>
              <p className="text-[8px] text-blue-300">شارك الكود {room.roomId}</p>
            </div>

            {/* شبكة اللاعبين المضغوطة جداً - 5 أعمدة */}
            <div className="grid grid-cols-5 gap-1.5 p-2 glass-ludo rounded-2xl border border-white/5 overflow-y-auto max-h-[35vh]">
              {room.players.map(p => <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} />)}
            </div>

            {isHost && (
              <div className="mt-auto grid grid-cols-2 gap-2 pb-4">
                <button onClick={() => startRound(ChallengeType.UNDERCOVER)} className="btn-ludo-blue py-3 rounded-lg text-[10px] font-black">الجاسوس 🕵️‍♂️</button>
                <button onClick={() => startRound(ChallengeType.TRIVIA)} className="btn-ludo-gold py-3 rounded-lg text-[10px] font-black">تريفيا 🧠</button>
                <button onClick={() => startRound(ChallengeType.STORY)} className="bg-slate-800 py-3 rounded-lg text-[10px] font-black border border-white/5">قصة 📖</button>
                <button onClick={() => startRound(ChallengeType.TEAM_WAR)} className="bg-slate-800 py-3 rounded-lg text-[10px] font-black border border-white/5">تحدي ⚔️</button>
              </div>
            )}
          </div>
        )}

        {room?.status === 'playing' && (
          <div className="flex-1 flex flex-col space-y-3">
            <Timer timeLeft={room.timeLeft} totalTime={room.gamePhase === 'discussing' ? 45 : 25} />
            
            <div className="glass-ludo p-4 rounded-2xl text-center flex-1 flex flex-col justify-center border-t-2 border-yellow-500/30">
              {room.gamePhase === 'discussing' ? (
                <div className="animate-in zoom-in duration-300">
                  <h3 className="text-sm font-black text-yellow-500 mb-2 uppercase">مرحلة الكلام</h3>
                  <div className="bg-blue-600/20 p-4 rounded-xl border border-yellow-500/10">
                    <p className="text-[7px] text-blue-300 mb-1">كلمتك السرية</p>
                    <p className="text-3xl font-black">{currentPlayer?.targetWord}</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <h3 className="text-xs font-black text-yellow-500 uppercase">{room.currentChallenge?.title}</h3>
                  <div className="bg-black/40 p-3 rounded-xl font-bold text-xs leading-relaxed">
                    {room.currentChallenge?.question || "من تظنه الجاسوس؟"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 pb-2">
              {(room.gamePhase === 'discussing' ? [] : (room.currentChallenge?.type === ChallengeType.UNDERCOVER ? room.players.map(p => p.name) : room.currentChallenge?.options))?.map((opt, i) => (
                <button 
                  key={i}
                  className="p-3 rounded-xl bg-slate-900/60 border border-white/5 text-right font-bold text-[11px] active:bg-blue-600"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mini Footer */}
      <div className="p-2 glass-ludo border-t border-yellow-500/20 flex justify-between items-center safe-bottom">
        <div className="flex items-center gap-2">
          <img src={currentPlayer?.avatar} className="w-8 h-8 rounded-lg border border-yellow-500" />
          <div className="leading-tight">
            <p className="text-[9px] font-black">{playerName}</p>
            <p className="text-[7px] text-yellow-500 font-bold uppercase">{currentPlayer?.points} XP</p>
          </div>
        </div>
        <div className="bg-blue-600/20 px-3 py-1.5 rounded-lg border border-blue-500/20">
           <span className="text-[8px] font-black text-blue-400 tracking-tighter uppercase">VIP MEMBER</span>
        </div>
      </div>
    </div>
  );
};

export default App;
