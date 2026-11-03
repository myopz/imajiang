import type { ClaimChoice, ClaimOptions, GameState, Player, RoundResult, SelfGang, SelfOptions, Tile } from './types';
import { HONG_ZHONG, createWall, nextKind, sortTiles, suitOf, tileLabel, toCounts } from './tiles';
import { isWinning, scoreHand } from './rules';
import { aiClaimDecision } from './ai';
import { getRule } from './rulesets';

export const NAMES = ['你', '小王', '老李', '阿珍'];
const clone = (s: GameState): GameState => structuredClone(s);
const rollDie = () => 1 + Math.floor(Math.random() * 6);

export function newRound(scores: number[], dealer: number, round: number, ruleId: string): GameState {
  const rule = getRule(ruleId);
  const wall = createWall(rule);
  const dice: [number, number] = [rollDie(), rollDie()];
  let flipTile: Tile | null = null;
  let wild: number | null = null;
  if (rule.wild === 'hongzhong') wild = HONG_ZHONG;
  const players: Player[] = NAMES.map((name, i) => ({
    name, hand: wall.splice(0, 13), melds: [], discards: [], score: scores[i] ?? 0,
  }));
  if (rule.wild === 'flip') {
    // 按骰子点数从牌尾数墩翻出赖子皮
    const idx = Math.max(0, wall.length - (dice[0] + dice[1]) * 2);
    flipTile = wall.splice(idx, 1)[0];
    wild = nextKind(flipTile.k);
  }
  players.forEach((p) => { p.hand = sortTiles(p.hand, wild); });
  const s: GameState = {
    ruleId: rule.id, dice, flipTile, wild, wall, players, dealer, round, turn: dealer, phase: 'turn',
    drawn: null, lastDiscard: null, afterKong: false, humanClaim: null, result: null,
    message: `掷出 ${dice[0]} + ${dice[1]} 点，${NAMES[dealer]}坐庄`,
  };
  return drawTile(s, dealer, false);
}

function drawTile(s: GameState, p: number, afterKong: boolean): GameState {
  if (s.wall.length === 0) return endRound(s, null, null, null, []);
  const t = s.wall.shift() as Tile;
  s.players[p].hand.push(t);
  s.turn = p;
  s.phase = 'turn';
  s.drawn = t;
  s.afterKong = afterKong;
  s.lastDiscard = null;
  return s;
}

export function selfOptions(s: GameState, p: number): SelfOptions {
  const pl = s.players[p];
  if (s.phase !== 'turn' || s.turn !== p) return { hu: false, gangs: [] };
  const rule = getRule(s.ruleId);
  const c = toCounts(pl.hand);
  const hu = s.drawn !== null && isWinning(c, pl.melds.length, rule, s.wild);
  const gangs: SelfGang[] = [];
  if (s.wall.length > 0) {
    c.forEach((n, k) => n === 4 && k !== s.wild && gangs.push({ type: 'agang', k }));
    pl.melds.forEach((m) => m.type === 'peng' && c[m.tiles[0].k] > 0 && gangs.push({ type: 'jiagang', k: m.tiles[0].k }));
  }
  return { hu, gangs };
}

export function claimOptions(s: GameState, q: number, tile: Tile, from: number): ClaimOptions {
  const none: ClaimOptions = { hu: false, peng: false, gang: false, chi: [] };
  const rule = getRule(s.ruleId);
  const pl = s.players[q];
  const k = tile.k;
  if (k === s.wild) return none; // 赖子打出后不可被吃碰杠胡
  const c = toCounts(pl.hand);
  c[k]++;
  const hu = rule.discardWin && isWinning(c, pl.melds.length, rule, s.wild);
  c[k]--;
  const chi: number[][] = [];
  if (rule.allowChi && q === (from + 1) % 4 && k < 27) {
    for (const pair of [[k - 2, k - 1], [k - 1, k + 1], [k + 1, k + 2]]) {
      const ok = pair.every((x) => x >= 0 && x < 27 && x !== s.wild && suitOf(x) === suitOf(k) && c[x] > 0);
      if (ok) chi.push(pair);
    }
  }
  return { hu, peng: c[k] >= 2, gang: c[k] === 3 && s.wall.length > 0, chi };
}

const hasAny = (o: ClaimOptions) => o.hu || o.peng || o.gang || o.chi.length > 0;

function takeKinds(pl: Player, kinds: number[]): Tile[] {
  return kinds.map((k) => pl.hand.splice(pl.hand.findIndex((t) => t.k === k), 1)[0]);
}

export function discard(prev: GameState, p: number, tileId: number): GameState {
  const s = clone(prev);
  const pl = s.players[p];
  const i = pl.hand.findIndex((t) => t.id === tileId);
  if (i < 0) return prev;
  const [t] = pl.hand.splice(i, 1);
  pl.hand = sortTiles(pl.hand, s.wild);
  pl.discards.push(t);
  s.lastDiscard = { tile: t, from: p };
  s.drawn = null;
  s.message = `${pl.name} 打出 ${tileLabel(t.k)}`;
  if (p !== 0) {
    const opts = claimOptions(s, 0, t, p);
    if (hasAny(opts)) {
      s.phase = 'claim';
      s.humanClaim = opts;
      return s;
    }
  }
  return resolveClaims(s, null);
}

/** 处理所有玩家对弃牌的响应：胡 > 杠/碰 > 吃。 */
export function resolveClaims(prev: GameState, humanChoice: ClaimChoice | null): GameState {
  const s = clone(prev);
  const ld = s.lastDiscard;
  if (!ld) return s;
  const { tile, from } = ld;
  s.humanClaim = null;
  const choices: { q: number; c: ClaimChoice }[] = [];
  for (let d = 1; d < 4; d++) {
    const q = (from + d) % 4;
    const opts = claimOptions(s, q, tile, from);
    if (!hasAny(opts)) continue;
    const c = q === 0 ? humanChoice ?? { type: 'pass' as const } : aiClaimDecision(s.players[q], tile, opts, s.wild);
    if (c.type !== 'pass') choices.push({ q, c });
  }
  const pick = choices.find((x) => x.c.type === 'hu')
    ?? choices.find((x) => x.c.type === 'gang' || x.c.type === 'peng')
    ?? choices.find((x) => x.c.type === 'chi');

  if (!pick) return drawTile(s, (from + 1) % 4, false);
  const { q, c } = pick;
  const pl = s.players[q];
  s.players[from].discards.pop();

  if (c.type === 'hu') {
    pl.hand.push(tile);
    return endRound(s, q, from, tile, pl.hand);
  }
  if (c.type === 'gang') {
    pl.melds.push({ type: 'mgang', tiles: [...takeKinds(pl, [tile.k, tile.k, tile.k]), tile], from });
    s.message = `${pl.name} 杠！`;
    return drawTile(s, q, true);
  }
  const used = c.type === 'peng' ? [tile.k, tile.k] : c.type === 'chi' ? c.kinds : [];
  pl.melds.push({ type: c.type === 'peng' ? 'peng' : 'chi', tiles: sortTiles([...takeKinds(pl, used), tile]), from });
  s.message = `${pl.name} ${c.type === 'peng' ? '碰' : '吃'}！`;
  s.turn = q;
  s.phase = 'turn';
  s.drawn = null;
  s.lastDiscard = null;
  s.afterKong = false;
  return s;
}

export function selfGang(prev: GameState, p: number, g: SelfGang): GameState {
  const s = clone(prev);
  const pl = s.players[p];
  if (g.type === 'agang') {
    pl.melds.push({ type: 'agang', tiles: takeKinds(pl, [g.k, g.k, g.k, g.k]), from: null });
  } else {
    const m = pl.melds.find((x) => x.type === 'peng' && x.tiles[0].k === g.k);
    if (!m) return prev;
    m.tiles.push(...takeKinds(pl, [g.k]));
    m.type = 'jiagang';
  }
  pl.hand = sortTiles(pl.hand, s.wild);
  s.message = `${pl.name} ${g.type === 'agang' ? '暗杠' : '加杠'}！`;
  return drawTile(s, p, true);
}

export function selfWin(prev: GameState, p: number): GameState {
  const s = clone(prev);
  return endRound(s, p, null, s.drawn, s.players[p].hand);
}

function endRound(s: GameState, winner: number | null, from: number | null, winTile: Tile | null, hand: Tile[]): GameState {
  s.phase = 'end';
  s.humanClaim = null;
  let result: RoundResult;
  if (winner === null) {
    result = { kind: 'draw', winner: null, from: null, winTile: null, fans: [], total: 0, deltas: [0, 0, 0, 0] };
    s.message = '牌墙摸完，流局';
  } else {
    const selfDraw = from === null;
    const rule = getRule(s.ruleId);
    const fans = scoreHand(hand, s.players[winner].melds, { selfDraw, afterKong: s.afterKong, lastTile: s.wall.length === 0 }, rule, s.wild);
    const total = fans.reduce((a, f) => a + f.fan, 0);
    const deltas = [0, 0, 0, 0];
    if (selfDraw) {
      for (let i = 0; i < 4; i++) if (i !== winner) { deltas[i] -= total; deltas[winner] += total; }
    } else if (from !== null) {
      deltas[from] -= total * 2;
      deltas[winner] += total * 2;
    }
    deltas.forEach((d, i) => { s.players[i].score += d; });
    s.players[winner].hand = sortTiles(hand, s.wild);
    result = { kind: 'win', winner, from, winTile, fans, total, deltas };
    s.message = `${s.players[winner].name} ${selfDraw ? '自摸' : '胡'}了！`;
  }
  s.result = result;
  return s;
}
