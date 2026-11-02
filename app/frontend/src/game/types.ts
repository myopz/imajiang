export interface Tile {
  id: number;
  /** 0-8 万, 9-17 筒, 18-26 条, 27-30 东南西北, 31-33 中发白 */
  k: number;
}

export type MeldType = 'chi' | 'peng' | 'mgang' | 'agang' | 'jiagang';

export interface Meld {
  type: MeldType;
  tiles: Tile[];
  from: number | null;
}

export interface Player {
  name: string;
  hand: Tile[];
  melds: Meld[];
  discards: Tile[];
  score: number;
}

export interface FanItem {
  name: string;
  fan: number;
}

export interface ClaimOptions {
  hu: boolean;
  peng: boolean;
  gang: boolean;
  chi: number[][];
}

export type ClaimChoice =
  | { type: 'hu' }
  | { type: 'gang' }
  | { type: 'peng' }
  | { type: 'chi'; kinds: number[] }
  | { type: 'pass' };

export interface SelfGang {
  type: 'agang' | 'jiagang';
  k: number;
}

export interface SelfOptions {
  hu: boolean;
  gangs: SelfGang[];
}

export interface RoundResult {
  kind: 'win' | 'draw';
  winner: number | null;
  from: number | null;
  winTile: Tile | null;
  fans: FanItem[];
  total: number;
  deltas: number[];
}

export type Phase = 'turn' | 'claim' | 'end';

export interface GameState {
  ruleId: string;
  dice: [number, number];
  /** 翻赖子玩法翻出的赖子皮 */
  flipTile: Tile | null;
  /** 赖子牌种（无赖子玩法为 null） */
  wild: number | null;
  wall: Tile[];
  players: Player[];
  dealer: number;
  round: number;
  turn: number;
  phase: Phase;
  drawn: Tile | null;
  lastDiscard: { tile: Tile; from: number } | null;
  afterKong: boolean;
  humanClaim: ClaimOptions | null;
  result: RoundResult | null;
  message: string;
}
