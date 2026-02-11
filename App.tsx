
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, RoomState, ChallengeType, Challenge } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { telegramService } from './services/telegramService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const ROUND_TIME = 20;

const App: React.FC = () => {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // 初始化玩家
  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setPlayerName(user.first_name + (user.last_name ? ` ${user.last_name}` : ''));
        setPlayerId(user.id.toString());
      } else {
        const fallbackId = 'p_' + Math.random().toString(36).substr(2, 9);
        setPlayerId(fallbackId);
      }
    } else {
      const fallbackId = 'p_' + Math.random().toString(36).substr(2, 9);
      setPlayerId(fallbackId);
    }
  }, []);

  // Sync with Storage Simulation
  useEffect(() => {
    if (room && room.status === 'playing') {
      timerRef.current = window.setInterval(() => {
        setRoom(prev => {
          if (!prev || prev.timeLeft <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            return prev ? { ...prev, status: 'round_end' as const, timeLeft: 0 } : null;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [room?.status, room?.round]);

  const createRoom = async () => {
    if (!playerName) return alert('يرجى إدخال اسمك أولاً');
    setLoading(true);
    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newPlayer: Player = {
      id: playerId,
      name: playerName,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`,
      points: 0,
      isHost: true,
      isAlive: true
    };

    const newState: RoomState = {
      roomId: newRoomId,
      players: [newPlayer],
      round: 1,
      status: 'lobby',
      timeLeft: ROUND_TIME,
      history: []
    };

    await storageService.saveRoom(newState);
    setRoom(newState);
    setLoading(false);
    
    const tg = (window as any).Telegram?.WebApp;
    if (tg?.initDataUnsafe?.user) {
      telegramService.notifyRoomCreated(tg.initDataUnsafe.user, newRoomId);
    }
  };

  const startNextRound = async () => {
    if (!room) return;
    setLoading(true);
    try {
      const challenge = await geminiService.generateChallenge(ChallengeType.TRIVIA);
      const updatedRoom: RoomState = {
        ...room,
        status: 'playing',
        currentChallenge: challenge,
        timeLeft: ROUND_TIME,
        round: room.round + 1,
        players: room.players.map(p => ({ ...p, currentVote: undefined }))
      };
      await storageService.saveRoom(updatedRoom);
      setRoom(updatedRoom);
    } catch (err) {
      setError('فشل في إنشاء التحدي. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!room || room.status !== 'playing') return;
    
    const isCorrect = answer === room.currentChallenge?.correctAnswer;
    const pointsToAdd = isCorrect ? (room.timeLeft > 10 ? 3 : 1) : 0;

    const updatedRoom: RoomState = {
      ...room,
      players: room.players.map(p => 
        p.id === playerId 
          ? { ...p, points: p.points + pointsToAdd, currentVote: answer } 
          : p
      )
    };

    setRoom(updatedRoom);
    await storageService.saveRoom(updatedRoom);
  };

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-start min-h-screen p-4 safe-top bg-[#0f172a] text-white">
        <header className="w-full py-6 text-center">
          <h1 className="text-4xl font-black text-blue-500 mb-2 drop-shadow-lg">مجلس التحدي</h1>
          <p className="text-slate-400 text-sm">لعبة الذكاء والجماعات الأكثر متعة</p>
        </header>

        <div className="w-full max-w-md glass rounded-3xl p-6 shadow-2xl mt-4">
          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-xs font-bold text-blue-400 mr-2 uppercase tracking-widest">اسم البطل</label>
              <input 
                type="text" 
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="أدخل اسمك هنا..."
                className="w-full bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-white placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <button 
              onClick={createRoom}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 py-4 rounded-2xl font-bold text-lg shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-3"
            >
              {loading ? (
                <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
              ) : (
                <>
                  <span>إنشاء مجلس جديد</span>
                  <span className="text-2xl">🚀</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-4 py-2">
              <div className="h-px flex-1 bg-white/10"></div>
              <span className="text-slate-500 text-xs font-bold uppercase">أو</span>
              <div className="h-px flex-1 bg-white/10"></div>
            </div>

            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="كود المجلس"
                className="flex-1 bg-slate-900/50 border border-white/10 rounded-2xl px-4 py-3 text-center font-mono text-xl tracking-widest focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button className="bg-slate-800 px-6 rounded-2xl font-bold hover:bg-slate-700 transition-colors border border-white/5">دخول</button>
            </div>
          </div>
        </div>

        <footer className="mt-auto py-8 text-center text-slate-600 text-[10px] uppercase tracking-widest">
          متصل عبر خوادم آمنة • تحديات مدعومة بالذكاء الاصطناعي
        </footer>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen overflow-hidden bg-[#0f172a] text-white safe-top">
      {/* Top Bar - Very Compact */}
      <div className="flex items-center justify-between px-4 py-3 glass border-b border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-blue-600 text-[10px] px-2 py-0.5 rounded-full font-bold"># {room.roomId}</div>
          <span className="text-xs font-bold text-slate-400">الجولة {room.round}</span>
        </div>
        <div className="flex -space-x-2 rtl:space-x-reverse">
          {room.players.slice(0, 5).map(p => (
            <div key={p.id} className="w-6 h-6 rounded-full border border-slate-900 bg-slate-800 overflow-hidden">
              <img src={p.avatar} alt={p.name} className="w-full h-full" />
            </div>
          ))}
          {room.players.length > 5 && (
            <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-900 flex items-center justify-center text-[8px] font-bold">
              +{room.players.length - 5}
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {room.status === 'lobby' && (
          <div className="text-center space-y-6 py-8">
            <div className="animate-bounce inline-block bg-blue-500/10 p-4 rounded-full">
              <span className="text-4xl">👥</span>
            </div>
            <h2 className="text-2xl font-bold">في انتظار اللاعبين...</h2>
            <p className="text-slate-400 text-sm">شارك الكود <span className="text-blue-400 font-mono font-bold">{room.roomId}</span> ليبدأ أصدقاؤك بالانضمام</p>
            
            <div className="grid grid-cols-3 gap-4 pt-4">
              {room.players.map(p => (
                <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} size="md" />
              ))}
            </div>

            {room.players.find(p => p.id === playerId)?.isHost && (
              <button 
                onClick={startNextRound}
                disabled={loading}
                className="w-full bg-green-600 hover:bg-green-500 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-green-500/20"
              >
                {loading ? 'جاري التحميل...' : 'ابدأ اللعبة الآن!'}
              </button>
            )}
          </div>
        )}

        {room.status === 'playing' && (
          <div className="space-y-6">
            <Timer timeLeft={room.timeLeft} totalTime={ROUND_TIME} />
            
            <div className="glass rounded-3xl p-6 text-center space-y-4 shadow-xl border-t border-white/10">
              <h3 className="text-blue-400 text-xs font-black uppercase tracking-[0.2em]">تحدي الـ Trivia</h3>
              <h2 className="text-xl font-bold leading-relaxed">{room.currentChallenge?.question}</h2>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {room.currentChallenge?.options?.map((option, idx) => {
                const isSelected = room.players.find(p => p.id === playerId)?.currentVote === option;
                return (
                  <button 
                    key={idx}
                    onClick={() => submitAnswer(option)}
                    disabled={!!room.players.find(p => p.id === playerId)?.currentVote}
                    className={`w-full py-4 px-6 rounded-2xl text-right font-bold transition-all border-2 flex items-center justify-between
                      ${isSelected 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-400' 
                        : 'bg-slate-800/50 border-white/5 hover:border-white/20'}`}
                  >
                    <span>{option}</span>
                    {isSelected && <span className="text-xl">✅</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {room.status === 'round_end' && (
          <div className="space-y-6 text-center">
            <h2 className="text-3xl font-black text-yellow-500">انتهى الوقت!</h2>
            <div className="glass rounded-3xl p-6 space-y-4">
              <p className="text-slate-400">الإجابة الصحيحة هي:</p>
              <div className="bg-green-500/20 text-green-400 py-3 px-6 rounded-2xl border border-green-500/30 text-xl font-bold">
                {room.currentChallenge?.correctAnswer}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-500 text-right mr-2">ترتيب اللاعبين</h4>
              {room.players.sort((a,b) => b.points - a.points).map((p, idx) => (
                <div key={p.id} className="flex items-center justify-between bg-slate-800/40 p-3 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-700'}`}>
                      {idx + 1}
                    </span>
                    <img src={p.avatar} alt={p.name} className="w-8 h-8 rounded-full" />
                    <span className="font-bold text-sm">{p.name}</span>
                  </div>
                  <span className="text-blue-400 font-bold">{p.points}</span>
                </div>
              ))}
            </div>

            {room.players.find(p => p.id === playerId)?.isHost && (
              <button 
                onClick={startNextRound}
                className="w-full bg-blue-600 hover:bg-blue-500 py-4 rounded-2xl font-bold shadow-lg"
              >
                الجولة التالية ➡️
              </button>
            )}
          </div>
        )}
      </div>

      {/* Persistent Player Status Bottom - For Mobile feel */}
      <div className="p-4 glass border-t border-white/10 safe-bottom">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full border-2 border-blue-500 p-0.5">
              <img src={room.players.find(p => p.id === playerId)?.avatar} className="w-full h-full rounded-full" />
            </div>
            <div>
              <p className="text-xs font-bold">{playerName}</p>
              <p className="text-[10px] text-blue-400 font-black">{room.players.find(p => p.id === playerId)?.points} نقطة</p>
            </div>
          </div>
          <button 
            onClick={() => window.location.reload()}
            className="text-[10px] font-bold text-red-400 uppercase tracking-tighter"
          >
            خروج من الغرفة
          </button>
        </div>
      </div>
    </div>
  );
};

export default App;
