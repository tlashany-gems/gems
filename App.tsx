
import React, { useState, useEffect, useRef } from 'react';
import { Player, RoomState, ChallengeType, Challenge } from './types';
import { storageService } from './services/storageService';
import { geminiService } from './services/geminiService';
import { PlayerAvatar } from './components/PlayerAvatar';
import { Timer } from './components/Timer';

const ROUND_TIME = 25;
const SPY_DISCUSS_TIME = 45;

const SOUNDS = {
  START: 'https://assets.mixkit.co/active_storage/sfx/2571/2571-preview.mp3',
  CORRECT: 'https://assets.mixkit.co/active_storage/sfx/2000/2000-preview.mp3',
  END: 'https://assets.mixkit.co/active_storage/sfx/1084/1084-preview.mp3',
  VOTE: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3'
};

const GAME_MODES = [
  { id: ChallengeType.UNDERCOVER, name: 'لعبة الجاسوس', icon: '🕵️‍♂️', desc: 'اكشف الخائن بالمجلس' },
  { id: ChallengeType.TRIVIA, name: 'تريفيا رويال', icon: '🧠', desc: 'تحدي ذكاء وسرعة' },
  { id: ChallengeType.TRUTH_LIE, name: 'أخطر كذبة', icon: '🤥', desc: 'فرق الحقيقة من الخيال' },
  { id: ChallengeType.STORY, name: 'قصة مجنونة', icon: '📖', desc: 'ألف حكايتك مع الكل' },
  { id: ChallengeType.CITY_BUILD, name: 'بناء المدينة', icon: '🏙️', desc: 'قرارات مصيرية للجميع' },
];

const App: React.FC = () => {
  const [room, setRoom] = useState<RoomState | null>(null);
  const [playerId, setPlayerId] = useState<string>('');
  const [playerName, setPlayerName] = useState<string>('');
  const [selectedMode, setSelectedMode] = useState<ChallengeType>(ChallengeType.UNDERCOVER);
  const [showModeSelector, setShowModeSelector] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [gamePhase, setGamePhase] = useState<'discussing' | 'voting'>('discussing');
  const timerRef = useRef<number | null>(null);

  const playSound = (url: string) => {
    const audio = new Audio(url);
    audio.volume = 0.4;
    audio.play().catch(() => {});
  };

  useEffect(() => {
    const tg = (window as any).Telegram?.WebApp;
    if (tg) {
      tg.expand();
      const user = tg.initDataUnsafe?.user;
      if (user) {
        setPlayerName(user.first_name + (user.last_name ? ` ${user.last_name}` : ''));
        setPlayerId(user.id.toString());
      } else {
        setPlayerId('p_' + Math.random().toString(36).substr(2, 9));
      }
    } else {
      setPlayerId('p_' + Math.random().toString(36).substr(2, 9));
    }
  }, []);

  useEffect(() => {
    if (room && room.status === 'playing') {
      timerRef.current = window.setInterval(() => {
        setRoom(prev => {
          if (!prev || prev.timeLeft <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            if (prev?.currentChallenge?.type === ChallengeType.UNDERCOVER && gamePhase === 'discussing') {
               setGamePhase('voting');
               playSound(SOUNDS.VOTE);
               return { ...prev, timeLeft: ROUND_TIME };
            }
            playSound(SOUNDS.END);
            return prev ? { ...prev, status: 'round_end' as const, timeLeft: 0 } : null;
          }
          return { ...prev, timeLeft: prev.timeLeft - 1 };
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [room?.status, room?.round, gamePhase]);

  const createRoom = async () => {
    if (!playerName) return alert('يا بطل، وش اسمك؟');
    setLoading(true);
    const newRoomId = Math.random().toString(36).substr(2, 6).toUpperCase();
    const newState: RoomState = {
      roomId: newRoomId,
      players: [{ id: playerId, name: playerName, avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${playerName}`, points: 0, roundPoints: 0, isHost: true, isAlive: true }],
      round: 0,
      status: 'lobby',
      timeLeft: ROUND_TIME,
      history: []
    };
    await storageService.saveRoom(newState);
    setRoom(newState);
    setLoading(false);
  };

  const startNextRound = async () => {
    if (!room) return;
    setLoading(true);
    try {
      const challenge = await geminiService.generateChallenge(selectedMode);
      let updatedPlayers = room.players.map(p => ({
          ...p,
          currentVote: undefined,
          roundPoints: 0,
          roundPointsLabel: undefined
      }));
      
      setGamePhase('discussing');

      if (selectedMode === ChallengeType.UNDERCOVER) {
        const spyIndex = Math.floor(Math.random() * updatedPlayers.length);
        updatedPlayers = updatedPlayers.map((p, idx) => ({
          ...p,
          role: idx === spyIndex ? 'spy' : 'citizen',
          targetWord: idx === spyIndex ? challenge.spyWord : challenge.secretWord
        }));
      }

      const updatedRoom: RoomState = {
        ...room,
        status: 'playing',
        currentChallenge: challenge,
        timeLeft: selectedMode === ChallengeType.UNDERCOVER ? SPY_DISCUSS_TIME : ROUND_TIME,
        round: room.round + 1,
        players: updatedPlayers
      };
      
      await storageService.saveRoom(updatedRoom);
      setRoom(updatedRoom);
      setShowModeSelector(false);
      playSound(SOUNDS.START);
    } catch (err) {
      alert('حدث خطأ فني بالمجلس');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer: string) => {
    if (!room || room.status !== 'playing') return;
    const currentPlayer = room.players.find(p => p.id === playerId);
    if (currentPlayer?.currentVote) return;

    let isCorrect = false;
    let roundPoints = 0;
    let label = '';

    if (room.currentChallenge?.type === ChallengeType.UNDERCOVER) {
      const targetPlayer = room.players.find(p => p.name === answer);
      isCorrect = targetPlayer?.role === 'spy';
      roundPoints = isCorrect ? 5 : 0;
      label = isCorrect ? 'كشفت الجاسوس! ✅' : 'تصويت غلط! ❌';
    } else {
      isCorrect = answer === room.currentChallenge?.correctAnswer;
      const correctAnswersSoFar = room.players.filter(p => p.currentVote === room.currentChallenge?.correctAnswer).length;
      if (isCorrect) {
        playSound(SOUNDS.CORRECT);
        roundPoints = correctAnswersSoFar === 0 ? 3 : 1;
        label = correctAnswersSoFar === 0 ? 'أسرع واحد! 🔥' : 'إجابة صح ✅';
      } else {
        label = 'غلط ❌';
      }
    }

    const updatedRoom: RoomState = {
      ...room,
      players: room.players.map(p => p.id === playerId ? { 
        ...p, 
        points: p.points + roundPoints, 
        roundPoints, 
        roundPointsLabel: label, 
        currentVote: answer 
      } : p)
    };
    
    setRoom(updatedRoom);
    await storageService.saveRoom(updatedRoom);
  };

  const isHost = room?.players.find(p => p.id === playerId)?.isHost;
  const currentModeInfo = GAME_MODES.find(m => m.id === selectedMode);
  const currentPlayer = room?.players.find(p => p.id === playerId);

  if (!room) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center font-['Cairo'] relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-900 to-slate-950 z-[-2]"></div>
        <div className="text-[120px] mb-2 drop-shadow-[0_0_30px_rgba(251,191,36,0.3)]">🏆</div>
        <h1 className="text-5xl font-black bg-clip-text text-transparent bg-gradient-to-r from-yellow-200 to-yellow-600 mb-2">مجلس التحدي</h1>
        <p className="text-blue-300 font-bold mb-12 tracking-widest text-xs uppercase">The Ultimate VIP Experience</p>
        
        <div className="w-full max-w-xs space-y-6">
          <div className="relative group">
            <input 
              type="text" 
              value={playerName} 
              onChange={e => setPlayerName(e.target.value)}
              placeholder="سجل اسمك يا بطل..."
              className="w-full bg-slate-900/80 border-2 border-yellow-500/30 rounded-2xl px-6 py-4 text-center font-black text-yellow-100 focus:border-yellow-500 transition-all outline-none shadow-[inset_0_2px_10px_rgba(0,0,0,0.5)]"
            />
            <div className="absolute -top-3 right-4 bg-yellow-500 text-black text-[9px] font-black px-2 py-0.5 rounded-full uppercase shadow-md">Player Name</div>
          </div>
          <button 
            onClick={createRoom}
            disabled={loading}
            className="w-full btn-ludo-gold py-5 rounded-2xl font-black text-xl active:translate-y-1 transition-all flex items-center justify-center gap-3 animate-gold"
          >
            {loading ? 'يتم التجهيز...' : 'افتح مجلس VIP ⚡'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-h-screen relative font-['Cairo'] overflow-hidden">
      {/* Background with provided GIF */}
      <div className="fixed inset-0 bg-[#0f172a] z-[-2]"></div>
      <div className="fixed inset-0 bg-[url('https://i.postimg.cc/wxV3PspQ/1756574872401.gif')] bg-cover opacity-20 mix-blend-screen z-[-1] pointer-events-none"></div>

      {/* Mode Selector Overlay */}
      {showModeSelector && (
        <div className="fixed inset-0 z-[100] bg-slate-950/95 backdrop-blur-xl p-6 flex flex-col animate-in slide-in-from-bottom duration-500">
          <div className="flex justify-between items-center mb-10">
            <h2 className="text-3xl font-black text-yellow-500">اختر نوع التحدي</h2>
            <button onClick={() => setShowModeSelector(false)} className="bg-slate-800 w-12 h-12 rounded-full flex items-center justify-center border border-white/10 text-white">✕</button>
          </div>
          <div className="grid grid-cols-1 gap-4 overflow-y-auto pb-40">
            {GAME_MODES.map(mode => (
              <button
                key={mode.id}
                onClick={() => setSelectedMode(mode.id)}
                className={`relative flex items-center gap-5 p-5 rounded-[2rem] border-2 transition-all duration-300
                  ${selectedMode === mode.id ? 'bg-blue-600 border-yellow-500 shadow-2xl scale-[1.02]' : 'bg-slate-900/50 border-white/5 opacity-70'}`}
              >
                <span className="text-5xl">{mode.icon}</span>
                <div className="text-right">
                   <h3 className="font-black text-lg text-white">{mode.name}</h3>
                   <p className="text-[10px] text-blue-200 font-bold">{mode.desc}</p>
                </div>
                {selectedMode === mode.id && <div className="absolute left-6 text-2xl">⭐</div>}
              </button>
            ))}
          </div>
          <div className="p-6 fixed bottom-0 left-0 right-0">
             <button onClick={() => setShowModeSelector(false)} className="w-full btn-ludo-gold py-5 rounded-[2rem] font-black text-xl">اعتماد الاختيار ✅</button>
          </div>
        </div>
      )}

      {/* Top Header */}
      <div className="px-4 py-4 flex justify-between items-center bg-slate-950/40 backdrop-blur-md border-b border-yellow-500/20 shadow-xl">
        <div className="flex items-center gap-2">
           <div className="bg-yellow-500 px-3 py-1 rounded-full shadow-[0_0_10px_rgba(251,191,36,0.5)]">
              <span className="text-[10px] font-black text-black uppercase">{room.roomId}</span>
           </div>
           <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">مجلس VIP</span>
        </div>
        <div className="flex -space-x-2">
          {room.players.slice(0, 5).map(p => <div key={p.id} className="w-9 h-9 rounded-full border-2 border-slate-900 overflow-hidden shadow-lg"><img src={p.avatar} className="w-full h-full object-cover" /></div>)}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6">
        {room.status === 'lobby' && (
          <div className="space-y-8 pb-10">
            <div className="text-center py-6">
              <div className="inline-block bg-yellow-500/10 p-6 rounded-[3rem] mb-4 shadow-[inset_0_0_20px_rgba(251,191,36,0.1)] border border-yellow-500/20 animate-gold">
                <span className="text-7xl">⚔️</span>
              </div>
              <h2 className="text-3xl font-black text-white mb-1">المجلس جاهز</h2>
              <p className="text-blue-300 text-sm">ننتظر دخول المحترفين للميدان</p>
            </div>

            <div className="glass-ludo rounded-[3rem] p-8 border-2 border-yellow-500/30 relative overflow-hidden group">
               <div className="relative z-10 flex flex-col items-center text-center">
                  <div className="bg-gradient-to-br from-yellow-400 to-yellow-700 p-6 rounded-[2.5rem] mb-6 shadow-[0_15px_30px_rgba(0,0,0,0.5)] border-4 border-yellow-200/50">
                     <span className="text-7xl drop-shadow-2xl">{currentModeInfo?.icon}</span>
                  </div>
                  <h3 className="text-3xl font-black mb-1 text-yellow-500 tracking-tighter">{currentModeInfo?.name}</h3>
                  <p className="text-blue-100/70 text-sm mb-8">{currentModeInfo?.desc}</p>
                  {isHost && (
                    <button onClick={() => setShowModeSelector(true)} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-8 py-3 rounded-2xl font-black text-xs transition-all active:scale-95">تغيير اللعبة ⚙️</button>
                  )}
               </div>
            </div>

            <div className="space-y-4">
               <div className="flex items-center gap-3 px-2">
                  <div className="h-px flex-1 bg-yellow-500/20"></div>
                  <span className="text-[10px] font-black text-yellow-500/60 uppercase">الموجودين بالمجلس ({room.players.length})</span>
                  <div className="h-px flex-1 bg-yellow-500/20"></div>
               </div>
               <div className="flex flex-wrap justify-center gap-6">
                  {room.players.map(p => <PlayerAvatar key={p.id} name={p.name} avatar={p.avatar} isHost={p.isHost} points={p.points} />)}
               </div>
            </div>

            {isHost && (
              <div className="pt-6">
                <button 
                  onClick={startNextRound} 
                  disabled={loading}
                  className="w-full btn-ludo-gold py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl active:translate-y-2 transition-all"
                >
                  {loading ? 'يتم التوزيع...' : 'ابدأ التحدي! 🔥'}
                </button>
              </div>
            )}
          </div>
        )}

        {room.status === 'playing' && (
          <div className="space-y-6">
            <Timer timeLeft={room.timeLeft} totalTime={selectedMode === ChallengeType.UNDERCOVER && gamePhase === 'discussing' ? SPY_DISCUSS_TIME : ROUND_TIME} />
            
            <div className="glass-ludo p-8 rounded-[3rem] text-center border-t-4 border-yellow-500/50 shadow-2xl">
              {selectedMode === ChallengeType.UNDERCOVER && gamePhase === 'discussing' ? (
                 <div className="space-y-6">
                    <h2 className="text-2xl font-black text-yellow-500">مرحلة النقاش 🗣️</h2>
                    <p className="text-sm text-blue-200">اسأل وحقق واكشف من هو الدخيل!</p>
                    <div className="bg-gradient-to-br from-blue-900 to-indigo-950 p-8 rounded-[2rem] border-2 border-yellow-500/30 shadow-inner">
                       <p className="text-[10px] font-black text-yellow-500 mb-2 uppercase tracking-widest">كلمتك السرية</p>
                       <p className="text-5xl font-black text-white tracking-tighter drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]">{currentPlayer?.targetWord}</p>
                    </div>
                    {isHost && (
                       <button onClick={() => { setGamePhase('voting'); playSound(SOUNDS.VOTE); }} className="mt-4 bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 px-6 py-2 rounded-full font-black text-xs">تخطِ للنقاش ⏭️</button>
                    )}
                 </div>
              ) : selectedMode === ChallengeType.UNDERCOVER && gamePhase === 'voting' ? (
                 <div className="space-y-4">
                    <h2 className="text-3xl font-black text-red-500">من هو الجاسوس؟ 🗳️</h2>
                    <p className="text-sm text-slate-300">اختر من المجلس الشخص اللي تشك فيه.</p>
                 </div>
              ) : (
                <>
                  <h2 className="text-3xl font-black mb-3 text-white leading-tight drop-shadow-lg">{room.currentChallenge?.title}</h2>
                  <p className="text-sm text-blue-200 leading-relaxed mb-8">{room.currentChallenge?.description}</p>
                  {room.currentChallenge?.question && (
                    <div className="bg-black/30 p-8 rounded-[2rem] border border-white/5 shadow-inner">
                      <p className="text-2xl font-black text-yellow-50 leading-snug">{room.currentChallenge.question}</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 pb-20">
              {(selectedMode === ChallengeType.UNDERCOVER && gamePhase === 'discussing' 
                ? [] 
                : selectedMode === ChallengeType.UNDERCOVER && gamePhase === 'voting'
                  ? room.players.map(p => p.name) 
                  : room.currentChallenge?.options)?.map((option, idx) => {
                const isSelected = currentPlayer?.currentVote === option;
                const isDisabled = !!currentPlayer?.currentVote;
                return (
                  <button
                    key={idx}
                    onClick={() => submitAnswer(option || '')}
                    disabled={isDisabled}
                    className={`p-6 rounded-[2rem] text-right font-black transition-all border-2 flex justify-between items-center text-lg shadow-xl
                      ${isSelected 
                        ? 'btn-ludo-blue border-white scale-[1.02]' 
                        : isDisabled 
                          ? 'opacity-30 bg-slate-900 border-transparent' 
                          : 'bg-slate-800/80 border-white/10 hover:border-yellow-500/50'}`}
                  >
                    <span className="flex-1 text-white">{option}</span>
                    {isSelected && <span className="text-2xl animate-bounce">👑</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {room.status === 'round_end' && (
          <div className="space-y-8 text-center animate-in zoom-in duration-500 pb-32">
            <h2 className="text-5xl font-black text-yellow-500 drop-shadow-[0_0_20px_rgba(251,191,36,0.5)] mt-10">كفو يا أبطال!</h2>
            
            <div className="grid grid-cols-1 gap-6">
               {room.currentChallenge?.type === ChallengeType.UNDERCOVER && (
                 <div className="glass-ludo p-8 rounded-[3rem] border-2 border-blue-500/40">
                    <p className="text-[10px] text-yellow-500 font-black mb-4 uppercase tracking-widest">الجاسوس المختبئ</p>
                    <div className="flex flex-col items-center gap-4">
                       <PlayerAvatar name={room.players.find(p => p.role === 'spy')?.name || ''} avatar={room.players.find(p => p.role === 'spy')?.avatar || ''} size="lg" />
                       <p className="text-4xl font-black text-white">{room.players.find(p => p.role === 'spy')?.name}</p>
                    </div>
                 </div>
               )}

               {room.currentChallenge?.correctAnswer && (
                 <div className="bg-gradient-to-r from-green-900/40 to-emerald-950/40 p-8 rounded-[2.5rem] border-2 border-green-500/30">
                   <p className="text-[10px] text-green-400 font-black mb-2 uppercase tracking-widest">الإجابة الصحيحة</p>
                   <p className="text-4xl font-black text-white">{room.currentChallenge.correctAnswer}</p>
                 </div>
               )}
            </div>

            <div className="space-y-3">
              <h3 className="text-right text-[11px] font-black text-yellow-500/60 uppercase px-4 tracking-widest">ترتيب المجلس</h3>
              {room.players.sort((a,b) => b.points - a.points).map((p, idx) => (
                <div key={p.id} className="bg-slate-900/60 p-5 rounded-[2rem] border border-white/5 flex items-center justify-between shadow-2xl">
                  <div className="flex items-center gap-4">
                    <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-black shadow-lg ${idx === 0 ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-white'}`}>{idx+1}</span>
                    <img src={p.avatar} className="w-14 h-14 rounded-2xl border-2 border-white/10" alt="" />
                    <div className="text-right">
                      <span className="font-black text-lg block text-white">{p.name}</span>
                      <span className={`text-[10px] font-bold px-3 py-1 rounded-full ${p.roundPoints > 0 ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                        {p.roundPointsLabel || 'غياب'}
                      </span>
                    </div>
                  </div>
                  <div className="text-left bg-black/30 px-4 py-2 rounded-2xl border border-white/5">
                    <span className="text-2xl font-black text-yellow-500">{p.points}</span>
                    <span className="text-[8px] font-black block opacity-50 uppercase">PTS</span>
                  </div>
                </div>
              ))}
            </div>

            {isHost && (
              <div className="fixed bottom-28 left-6 right-6 z-10">
                <button 
                  onClick={startNextRound} 
                  className="w-full btn-ludo-gold py-6 rounded-[2.5rem] font-black text-2xl shadow-2xl active:translate-y-2 transition-all"
                >
                  الجولة التالية ⚡
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* VIP Player Footer */}
      <div className="p-4 bg-slate-950/90 backdrop-blur-xl border-t-2 border-yellow-500/30 safe-bottom flex items-center justify-between z-20">
         <div className="flex items-center gap-4">
            <div className="relative">
               <img src={currentPlayer?.avatar} className="w-14 h-14 rounded-2xl border-2 border-yellow-500 shadow-xl" alt="" />
               <div className="absolute -bottom-1 -right-1 bg-green-500 w-4 h-4 rounded-full border-2 border-slate-950"></div>
            </div>
            <div>
               <p className="text-base font-black text-white leading-tight mb-1">{playerName}</p>
               <div className="bg-yellow-500/10 border border-yellow-500/20 px-3 py-0.5 rounded-full inline-block">
                  <span className="text-[11px] font-black text-yellow-500 tracking-widest uppercase">{currentPlayer?.points} XP</span>
               </div>
            </div>
         </div>
         <button onClick={() => window.location.reload()} className="bg-red-500/10 text-red-500 px-6 py-3 rounded-2xl font-black text-[10px] border border-red-500/20 uppercase active:bg-red-500/20">خروج</button>
      </div>
    </div>
  );
};

export default App;
