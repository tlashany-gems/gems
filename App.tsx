
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
        setNameInput(`${user.first_name || ''}`.trim() || user.username || 'لاعب');
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

  if (!gameState) {
    return (
      <div className="flex flex-col items-center justify-start p-4 space-y-6 max-w-sm mx-auto pt-8">
        <div className="text-center space-y-1">
          <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">مجلس التحدي</h1>
          <p className="text-slate-400 text-xs font-medium italic">أهلاً بك يا {nameInput}</p>
        </div>

        <div className="glass w-full p-6 rounded-2xl shadow-xl space-y-4">
          <div className="flex flex-col items-center">
            <img src={selectedAvatar.startsWith('http') ? selectedAvatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedAvatar}`} className="w-20 h-20 rounded-full border-2 border-blue-500 bg-slate-800 p-1 mb-2 shadow-inner" alt="Avatar"/>
            {!selectedAvatar.startsWith('http') && <button onClick={() => setSelectedAvatar(`seed-${Math.random()}`)} className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">تغيير الصورة</button>}
          </div>
          
          <input type="text" placeholder="اسمك..." className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-center font-bold text-white text-sm" value={nameInput} onChange={(e) => setNameInput(e.target.value)}/>
          
          <div className="space-y-2">
            <button onClick={createRoom} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-3 rounded-lg shadow-lg active:scale-95 text-sm transition-all">أنشئ مجلساً جديداً</button>
            <div className="flex gap-2">
              <input type="text" placeholder="كود المجلس" className="flex-1 bg-slate-900/50 border border-slate-700 rounded-lg px-4 py-2 text-center uppercase text-white text-sm" value={roomInput} onChange={(e) => setRoomInput(e.target.value)}/>
              <button onClick={joinRoom} disabled={loading} className="bg-purple-600 px-4 py-2 rounded-lg font-bold text-white text-sm">دخول</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (gameState.status === 'lobby') {
    return (
      <div className="p-4 flex flex-col space-y-4 h-full">
        <div className="flex justify-between items-center bg-slate-800/50 p-3 rounded-xl border border-white/5 shadow-md">
          <div onClick={() => { if(tg) tg.switchInlineQuery(gameState.roomId); }} className="cursor-pointer">
            <h2 className="text-[10px] text-slate-400">كود المجلس (انقر للمشاركة)</h2>
            <p className="text-xl font-black text-blue-400 tracking-widest">{gameState.roomId} 🔗</p>
          </div>
          <div className="text-right">
            <h2 className="text-[10px] text-slate-400">اللاعبين</h2>
            <p className="text-xl font-black text-white">{gameState.players.length}</p>
          </div>
        </div>

        <div className="flex-1 glass rounded-2xl p-4 overflow-y-auto min-h-0">
          <h3 className="text-sm font-bold mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            في انتظار البقية...
          </h3>
          <div className="grid grid-cols-4 gap-4">
            {gameState.players.map(player => (
              <PlayerAvatar key={player.id} name={player.name} avatar={player.avatar} isHost={player.isHost} size="sm" />
            ))}
          </div>
        </div>

        {currentPlayer?.isHost ? (
          <button onClick={startNextRound} disabled={loading} className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-black py-4 rounded-xl shadow-xl text-lg active:scale-95 transition-all">
            {loading ? 'جاري التجهيز...' : 'ابدأ التحدي!'}
          </button>
        ) : (
          <div className="bg-slate-800/80 p-3 rounded-xl text-center border border-blue-500/20">
            <p className="text-blue-300 text-xs font-bold animate-pulse">بانتظار المضيف ليبدأ...</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="p-3 flex flex-col space-y-3 h-full">
      <div className="flex justify-between items-center">
        <div className="bg-slate-800 px-3 py-0.5 rounded-full border border-white/10">
          <span className="text-[10px] text-slate-400 ml-1">جولة</span>
          <span className="font-bold text-sm text-blue-400">{gameState.round}</span>
        </div>
        <div className="bg-blue-600/20 px-3 py-0.5 rounded-full border border-blue-500/30">
          <span className="text-blue-400 font-bold text-xs">{currentPlayer?.points} نقطة</span>
        </div>
      </div>

      <Timer timeLeft={gameState.timeLeft} totalTime={ROUND_TIME} />

      <main className="flex-1 flex flex-col items-center justify-start pt-2">
        <div className="glass w-full max-w-sm p-5 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col">
          <div className="absolute top-3 left-3 bg-purple-600 text-[8px] px-2 py-0.5 rounded-full font-bold uppercase">
            {gameState.currentChallenge?.type}
          </div>

          <div className="text-center space-y-2 mt-4">
            <h2 className="text-lg font-black text-white">{gameState.currentChallenge?.title}</h2>
            
            {gameState.status === 'playing' ? (
              <div className="space-y-4 pt-2">
                <div className="text-sm font-bold text-blue-100 bg-slate-900/60 p-4 rounded-xl border border-blue-500/2