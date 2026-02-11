
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Player, RoomState, ChallengeType, Challenge } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { telegramService } from './services/telegramService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const ROUND_TIME = 20;
const tg = (window as any).Telegram?.WebApp;

const App: React.FC = () => {
  const [gameState, setGameState] = useState<RoomState | null>(null);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomInput, setRoomInput] = useState('');
  const [nameInput, setNameInput] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(`seed-${Math.random()}`);
  
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (tg) {
      tg.ready();
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setNameInput(`${user.first_name || ''} ${user.last_name || ''}`.trim() || user.username || 'لاعب');
        if (user.photo_url) setSelectedAvatar(user.photo_url);
      }
    }
  }, []);

  const playSound = (type: 'win' | 'click' | 'tick') => {
    if (tg?.HapticFeedback) {
      if (type === 'win') tg.HapticFeedback.notificationOccurred('success');
      else tg.HapticFeedback.impactOccurred('light');
    }
  };

  const createRoom = async () => {
    if (!nameInput) return;
    setLoading(true);
    const roomId = Math.random().toString(36).substring(7).toUpperCase();
    const userId = tg?.initDataUnsafe?.user?.id?.toString() || 'host-' + Date.now();
    
    const host: Player = {
      id: userId,
      name: nameInput,
      avatar: selectedAvatar.startsWith('http') ? selectedAvatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`,
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
    
    // إرسال رسالة عبر البوت للمستخدم
    if (tg?.initDataUnsafe?.user) {
      await telegramService.notifyRoomCreated(tg.initDataUnsafe.user, roomId);
    }

    setLoading(false);
    playSound('click');
  };

  const joinRoom = async () => {
    if (!roomInput || !nameInput) return;
    setLoading(true);
    const room = await storageService.getRoom(roomInput.toUpperCase());
    if (room) {
      const newPlayer: Player = {
        id: tg?.initDataUnsafe?.user?.id?.toString() || 'player-' + Date.now(),
        name: nameInput,
        avatar: selectedAvatar.startsWith('http') ? selectedAvatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`,
        points: 0,
        isHost: false,
        isAlive: true
      };
      room.players.push(newPlayer);
      await storageService.saveRoom(room);
      setGameState(room);
      setCurrentPlayer(newPlayer);
      playSound('click');
    } else {
      alert('المجلس غير موجود!');
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
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [gameState?.status, gameState?.timeLeft]);

  const handleVote = async (option: string) => {
    if (!gameState || !currentPlayer || gameState.status !== 'playing') return;
    
    let pointsToAdd = 0;
    if (gameState.currentChallenge?.correctAnswer === option) {
      const alreadyAnsweredCount = gameState.players.filter(p => p.currentVote).length;
      pointsToAdd = alreadyAnsweredCount === 0 ? 3 : alreadyAnsweredCount === 1 ? 2 : 1;
      playSound('win');
    }

    const updatedPlayers = gameState.players.map(p => 
      p.id === currentPlayer.id ? { ...p, currentVote: option, points: p.points + pointsToAdd } : p
    );

    const updatedRoom: RoomState = { ...gameState, players: updatedPlayers };
    setGameState(updatedRoom);
    setCurrentPlayer(prev => prev ? { ...prev, points: prev.points + pointsToAdd, currentVote: option } : null);
    await storageService.saveRoom(updatedRoom);
  };

  const shareRoom = () => {
    if (tg) {
      tg.switchInlineQuery(gameState?.roomId || '');
    }
  };

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 space-y-8 max-w-md mx-auto">
        <div className="text-center space-y-2 animate-float">
          <h1 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">مجلس التحدي</h1>
          <p className="text-slate-400 font-medium">أهلاً بك يا {nameInput.split(' ')[0]}</p>
        </div>

        <div className="glass w-full p-8 rounded-3xl shadow-2xl border-white/5 space-y-6">
          <div className="flex flex-col items-center mb-4">
            <img src={selectedAvatar.startsWith('http') ? selectedAvatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`} className="w-24 h-24 rounded-full border-4 border-blue-500 bg-slate-800 p-1 mb-2 object-cover" alt="Avatar"/>
            {!selectedAvatar.startsWith('http') && <button onClick={() => setSelectedAvatar(`seed-${Math.random()}`)} className="text-xs text-blue-400 font-bold">تغيير الشخصية</button>}
          </div>
          
          <input type="text" placeholder="اسمك..." className="w-full bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center font-bold text-white" value={nameInput} onChange={(e) => setNameInput(e.target.value)}/>
          
          <div className="space-y-3">
            <button onClick={createRoom} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl shadow-lg transition-transform active:scale-95">أنشئ مجلساً جديداً</button>
            <div className="flex gap-2">
              <input type="text" placeholder="كود المجلس" className="flex-1 bg-slate-900/50 border border-slate-700 rounded-xl px-4 py-3 text-center uppercase text-white" value={roomInput} onChange={(e) => setRoomInput(e.target.value)}/>
              <button onClick={joinRoom} disabled={loading} className="bg-purple-600 px-6 py-3 rounded-xl font-bold text-white">دخول</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // شاشة الانتظار
  if (gameState.status === 'lobby') {
    return (
      <div className="min-h-screen p-6 flex flex-col space-y-6">
        <div className="flex justify-between items-center bg-slate-800/50 p-4 rounded-2xl border border-white/5 shadow-lg">
          <div onClick={shareRoom} className="cursor-pointer">
            <h2 className="text-xs text-slate-400">كود المجلس (اضغط للمشاركة)</h2>
            <p className="text-2xl font-black text-blue-400">{gameState.roomId} 🔗</p>
          </div>
          <div className="text-right">
            <h2 className="text-sm text-slate-400">اللاعبين</h2>
            <p className="text-2xl font-black text-white">{gameState.players.length}</p>
          </div>
        </div>

        <div className="flex-1 glass rounded-3xl p-6 overflow-y-auto">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            المجلس ينعقد الآن...
          </h3>
          <div className="grid grid-cols-3 gap-6">
            {gameState.players.map(player => (
              <PlayerAvatar key={player.id} name={player.name} avatar={player.avatar} isHost={player.isHost} />
            ))}
          </div>
        </div>

        {currentPlayer?.isHost ? (
          <button onClick={startNextRound} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black py-5 rounded-2xl shadow-xl text-xl transition-all active:scale-95">
            {loading ? 'جاري التحضير...' : 'ابدأ التحدي الآن!'}
          </button>
        ) : (
          <div className="bg-slate-800/80 p-5 rounded-2xl text-center border border-blue-500/20">
            <p className="text-blue-300 font-bold">بانتظار المضيف لفتح باب التحدي...</p>
          </div>
        )}
      </div>
    );
  }

  // شاشة اللعب
  return (
    <div className="min-h-screen p-4 flex flex-col space-y-4">
      <div className="flex justify-between items-center px-2">
        <div className="bg-slate-800 px-4 py-1 rounded-full border border-white/10">
          <span className="text-xs text-slate-400 ml-2">الجولة</span>
          <span className="font-bold text-lg">{gameState.round}</span>
        </div>
        <div className="bg-blue-600/20 px-4 py-1 rounded-full border border-blue-500/30">
          <span className="text-blue-400 font-bold">{currentPlayer?.points} نقطة</span>
        </div>
      </div>

      <Timer timeLeft={gameState.timeLeft} totalTime={ROUND_TIME} />

      <main className="flex-1 flex flex-col items-center justify-center">
        <div className="glass w-full max-w-lg p-6 rounded-[2.5rem] shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-4 left-4 bg-purple-600 text-[10px] px-3 py-1 rounded-full font-bold uppercase">
            {gameState.currentChallenge?.type}
          </div>

          <div className="text-center space-y-4 mt-6">
            <h2 className="text-2xl font-black text-white leading-tight">{gameState.currentChallenge?.title}</h2>
            <p className="text-slate-400 text-sm leading-relaxed">{gameState.currentChallenge?.description}</p>

            {gameState.status === 'playing' ? (
              <div className="py-6 space-y-6">
                <div className="text-xl font-bold text-blue-300 bg-slate-900/50 p-5 rounded-2xl border border-blue-500/10 shadow-inner">
                  {gameState.currentChallenge?.question}
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {gameState.currentChallenge?.options?.map((option, idx) => (
                    <button key={idx} disabled={!!currentPlayer?.currentVote} onClick={() => handleVote(option)} className={`w-full py-4 px-6 rounded-2xl font-bold text-right transition-all border-2 ${currentPlayer?.currentVote === option ? 'bg-blue-600 border-white text-white shadow-lg' : 'bg-slate-800/50 border-white/5 text-slate-200'}`}>
                      <span className="ml-4 text-blue-400">●</span> {option}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="py-8 space-y-6 animate-in fade-in slide-in-from-bottom-4">
                <div className="text-3xl font-black text-green-400">انتهت الجولة!</div>
                <div className="bg-green-500/10 p-6 rounded-3xl border border-green-500/20 shadow-lg">
                  <p className="text-slate-400 text-xs mb-2">الإجابة الصحيحة:</p>
                  <p className="text-2xl font-bold text-white">{gameState.currentChallenge?.correctAnswer}</p>
                </div>
                {currentPlayer?.isHost && <button onClick={startNextRound} className="w-full bg-blue-600 py-4 rounded-2xl font-bold text-xl shadow-blue-500/30 shadow-xl">تحدي جديد</button>}
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
