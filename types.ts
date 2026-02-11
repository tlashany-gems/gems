
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
  isHost: boolean;
  isAlive: boolean;
  currentVote?: string;
}

export interface Challenge {
  type: ChallengeType;
  title: string;
  description: string;
  question?: string;
  options?: string[];
  correctAnswer?: string;
  secretWord?: string; // For Undercover
  spyWord?: string;    // For Undercover
}

export interface RoomState {
  roomId: string;
  players: Player[];
  round: number;
  status: 'lobby' | 'starting' | 'playing' | 'round_end' | 'game_over';
  currentChallenge?: Challenge;
  timeLeft: number;
  history: any[];
}
