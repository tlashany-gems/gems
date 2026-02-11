
// Add TEAM_WAR to the enum to satisfy its usage in geminiService.ts
export enum ChallengeType {
  TRIVIA = 'trivia',
  UNDERCOVER = 'undercover',
  TRUTH_LIE = 'truth_lie',
  CITY_BUILD = 'city_build',
  STORY = 'story',
  TEAM_WAR = 'team_war'
}

export interface Player {
  id: string;
  name: string;
  avatar: string;
  points: number;
  roundPoints: number; 
  roundPointsLabel?: string; 
  isHost: boolean;
  isAlive: boolean;
  currentVote?: string;
  role?: 'spy' | 'citizen';
  targetWord?: string;
  lastSeen: number; // للمزامنة والتأكد من تواجد اللاعب
}

export interface Challenge {
  type: ChallengeType;
  title: string;
  description: string;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  secretWord?: string; 
  spyWord?: string;    
}

export interface RoomState {
  roomId: string;
  players: Player[];
  round: number;
  status: 'lobby' | 'playing' | 'round_end';
  currentChallenge?: Challenge;
  timeLeft: number;
  gamePhase?: 'discussing' | 'voting';
  serverTime: number; // لمزامنة الوقت بين اللاعبين
}
