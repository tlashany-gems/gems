
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
    if (!playerName.trim()) return;
    setLoading(true);
    const roomId = Math.random().toString(36).substr(2, 5).toUpperCase();
    const newRoom: RoomState = {
      roomId,
      players: [{ 
        id: playerId, 
        name: playerName, 
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, 
        points: 0, roundPoints: 0, isHost: true, isAlive: true, lastSeen: Date.now() 
      }],
      round: 0, status: 'lobby', timeLeft: 30, serverTime: Date.now()
    };
    await storageService.saveRoom(newRoom);
    setRoom(newRoom);
    setView('game');
    setLoading(false);
  };

  const joinRoom = async () => {
    if (!playerName.trim() || !joinCode.trim()) return;
    setLoading(true);
    const player: Player = { 
      id: playerId, name: playerName, 
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, 
      points: 0, roundPoints: 0, isHost: false, isAlive: true, lastSeen: Date.now() 
    };
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
      console.error(e);
    }
    setLoading(false);
  };

  const currentPlayer = room?.players.find(p => p.id === playerId);
  const isHost = currentPlayer?.isHost;

  if (view === 'start') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 bg-slate-950/40">
        <div className="relative mb-6">
          <div className="absolute inset-0 bg-yellow-500 blur-2xl opacity-20 animate-pulse"></div>
          <span className="relative text-8xl drop-shadow-2xl">👑</span>
        </div>
        <h1 className="text-4xl font-black text-yellow-500 mb-2 tracking-tighter">مجلس VIP</h1>
        <p className="text-[10px] text-blue-400 mb-10 font-bold uppercase tracking-[0.3em]">Online Social Club</p>
        
        <div className="w-full max-w-xs space-y-3">
          <input 
            type="text" value={playerName} onChange={e => setPlayerName(e.target.value)}
            placeholder="اسمك الكريم..." 
            className="w-full bg-slate-900/80 border border-white/10 p-4 rounded-2xl text-center font-bold outline-none focus:border-yellow-500/50"
          />
          <button onClick={createRoom} className="w-full btn-ludo-gold py-4 rounded-2xl text-lg animate-in slide-in-from-bottom-2">ابدأ مجلسك ⚡</button>
          <button onClick={() => setView('join')} className="w-full bg-white/5 border border-white/10 py-4 rounded-2xl font-bold hover:bg-white/10 transition-colors">انضم لخويك 👥</button>
        </div>
      </div>
    );
  }

  if (view === 'join') {
    return (
      <div className="flex flex-col items-center justify-center h-screen p-6 text-center">
        <h2 className="text-2xl font-black text-white mb-8">وين المجلس؟ 📍</h2>
        <div className="w-full max-w-xs space-y-4">
          <input 
            type="text" value={joinCode} onChange={e => setJoinCode(e.target.value.toUpperCase())}
            placeholder="كود الغرفة (مثال: AB123)" 
            className="w-full bg-slate-900 border border-blue-500/30 p-5 rounded-3xl text-center font-black text-2xl tracking-widest outline-none uppercase"
          />
          <button onClick={joinRoom} disabled={loading} className="w-full btn-ludo-blue py-4 rounded-2xl text-lg font-black">
            {loading ? 'جاري الدخول...' : 'دخول المجلس ✅'}
          </button>
          <button onClick={() => setView('start')} className="text-slate-500 text-xs font-bold uppercase tracking-widest">رجوع</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden text-white bg-slate-950/60">
      {/* Ultra Slim Header */}
      <div className="px-3 py-1.5 glass-ludo flex justify-between items-center border-b border-white/5">
        <div className="flex items-center gap-2">
           <div className="bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 rounded-md">
             <span className="text-yellow-500 text-[10px] font-black leading-none">ID: {room?.roomId}</span>
           </div>
           <span className="text-[9px] font-bold text-white/40 uppercase">{room?.players.length} Players</span>
        </div>
        <button onClick={() => window.location.reload()} className="bg-red-500/10 text-red-500 text-[8px] font-black px-2 py-1 rounded border border-red-500/20 uppercase">Exit</button>
      </div>

      <div className="flex-1 overflow-hidden p-2 flex flex-col space-y-2">
        {room?.status === 'lobby' && (
          <div className="flex-1 flex flex-col">
            <div className="text-center py-2 mb-2 bg-blue-500/5 rounded-2xl border border-blue-500/10">
              <h3 className="text-[11px] font-black text-blue-400 uppercase tracking-widest">Waiting for members</h3>
            </div>

            {/* Micro Player Grid - High Density */}
            <div className="grid grid-cols-5 gap-2 p-3 glass-ludo rounded-3xl border border-white/5 overflow-y-auto max-h-[40vh] shadow-inner">
              {room.players.map(p => <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} />)}
            </div>

            {isHost && (
              <div className="mt-auto grid grid-cols-2 gap-2 pb-2">
                <button onClick={() => startRound(ChallengeType.UNDERCOVER)} className="btn-ludo-blue py-3 rounded-xl text-[10px] font-black shadow-lg">الجاسوس 🕵️‍♂️</button>
                <button onClick={() => startRound(ChallengeType.TRIVIA)} className="btn-ludo-gold py-3 rounded-xl text-[10px] font-black shadow-lg">تريفيا 🧠</button>
                <button onClick={() => startRound(ChallengeType.STORY)} className="bg-slate-800/80 backdrop-blur-md py-3 rounded-xl text-[10px] font-black border border-white/10">قصة 📖</button>
                <button onClick={() => startRound(ChallengeType.TEAM_WAR)} className="bg-slate-800/80 backdrop-blur-md py-3 rounded-xl text-[10px] font-black border border-white/10">تحدي ⚔️</button>
              </div>
            )}
            {!isHost && (
              <div className="mt-auto pb-4 text-center">
                <div className="inline-block animate-bounce px-4 py-2 bg-white/5 rounded-full text-[10px] font-bold text-white/40 border border-white/10">
                  بانتظار راعي المجلس يبدأ... 🕒
                </div>
              </div>
            )}
          </div>
        )}

        {room?.status === 'playing' && (
          <div className="flex-1 flex flex-col">
            <Timer timeLeft={room.timeLeft} totalTime={room.gamePhase === 'discussing' ? 45 : 25} />
            
            <div className="glass-ludo p-6 rounded-[2.5rem] text-center flex-1 flex flex-col justify-center border-2 border-yellow-500/20 shadow-[0_0_30px_rgba(251,191,36,0.05)] relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
              
              {room.gamePhase === 'discussing' ? (
                <div className="animate-in zoom-in duration-500">
                  <span className="text-[9px] bg-yellow-500 text-black px-2 py-0.5 rounded-full font-black uppercase mb-3 inline-block">كلمتك السرية</span>
                  <div className="bg-black/40 p-6 rounded-3xl border border-white/5 shadow-2xl">
                    <p className="text-4xl font-black text-white drop-shadow-glow">{currentPlayer?.targetWord}</p>
                  </div>
                  <p className="text-[10px] mt-4 text-white/50 leading-relaxed px-4">لا تذكر الكلمة مباشرة! أوصفها بذكاء عشان ما يكشفك الجاسوس.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="text-xs font-black text-yellow-500 uppercase tracking-widest">{room.currentChallenge?.title}</h3>
                  <div className="bg-slate-900/60 p-5 rounded-2xl font-bold text-sm leading-relaxed border border-white/5">
                    {room.currentChallenge?.question || "من هو الجاسوس بيننا؟"}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 gap-1.5 py-4 max-h-[30vh] overflow-y-auto">
              {(room.gamePhase === 'discussing' ? [] : (room.currentChallenge?.type === ChallengeType.UNDERCOVER ? room.players.map(p => p.name) : room.currentChallenge?.options))?.map((opt, i) => (
                <button 
                  key={i}
                  className="p-3.5 rounded-2xl bg-slate-900/80 border border-white/10 text-right font-bold text-xs active:scale-[0.98] active:bg-blue-600 transition-all shadow-md"
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mini Footer - Compact Info Bar */}
      <div className="px-3 py-2 glass-ludo border-t border-white/5 flex justify-between items-center safe-bottom">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg border border-yellow-500/50 overflow-hidden bg-slate-800 shadow-lg">
            <img src={currentPlayer?.avatar} className="w-full h-full object-cover" />
          </div>
          <div className="leading-none">
            <p className="text-[10px] font-black text-white truncate max-w-[80px]">{playerName}</p>
            <p className="text-[8px] text-yellow-500 font-bold uppercase mt-0.5">{currentPlayer?.points} XP</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
           <div className="bg-blue-600/10 px-3 py-1 rounded-full border border-blue-600/20">
             <span className="text-[8px] font-black text-blue-400 tracking-tighter uppercase">VIP MEMBER</span>
           </div>
        </div>
      </div>
    </div>
  );
};

export default App;
