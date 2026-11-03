import type { FanItem, Meld, Tile } from './types';
import type { RuleSet } from './rulesets';
import { isHonor, suitOf, toCounts } from './tiles';

function standardShanten(counts: number[], meldCount: number): number {
  const c = counts.slice();
  let best = 8;
  const scan = (start: number, sets: number, partials: number, pair: number): void => {
    let i = start;
    while (i < 34 && c[i] === 0) i++;
    if (i >= 34) {
      const s = sets + meldCount;
      const v = 8 - 2 * s - Math.min(partials, 4 - s) - pair;
      if (v < best) best = v;
      return;
    }
    const suited = i < 27;
    const r = i % 9;
    if (c[i] >= 3) { c[i] -= 3; scan(i, sets + 1, partials, pair); c[i] += 3; }
    if (suited && r <= 6 && c[i + 1] > 0 && c[i + 2] > 0) {
      c[i]--; c[i + 1]--; c[i + 2]--; scan(i, sets + 1, partials, pair); c[i]++; c[i + 1]++; c[i + 2]++;
    }
    if (sets + meldCount + partials < 4) {
      if (c[i] >= 2) { c[i] -= 2; scan(i, sets, partials + 1, pair); c[i] += 2; }
      if (suited && r <= 7 && c[i + 1] > 0) { c[i]--; c[i + 1]--; scan(i, sets, partials + 1, pair); c[i]++; c[i + 1]++; }
      if (suited && r <= 6 && c[i + 2] > 0) { c[i]--; c[i + 2]--; scan(i, sets, partials + 1, pair); c[i]++; c[i + 2]++; }
    }
    c[i]--; scan(i, sets, partials, pair); c[i]++;
  };
  for (let i = 0; i < 34; i++) {
    if (c[i] >= 2) { c[i] -= 2; scan(0, 0, 0, 1); c[i] += 2; }
  }
  scan(0, 0, 0, 0);
  return best;
}

function chiitoiShanten(c: number[]): number {
  let pairs = 0;
  let kinds = 0;
  for (const n of c) { if (n >= 1) kinds++; if (n >= 2) pairs++; }
  return 6 - pairs + Math.max(0, 7 - kinds);
}

const cache = new Map<string, number>();

/** 不含赖子的向听数：-1 和牌，0 听牌。 */
export function shanten(counts: number[], meldCount: number): number {
  const key = counts.join('') + meldCount;
  const hit = cache.get(key);
  if (hit !== undefined) return hit;
  let s = standardShanten(counts, meldCount);
  if (meldCount === 0) s = Math.min(s, chiitoiShanten(counts));
  if (cache.size > 80000) cache.clear();
  cache.set(key, s);
  return s;
}

/** 剩余牌能否全部组成面子（赖子可补位）。每个分支在副本上操作。 */
function canSetsClean(c: number[], w: number, start: number): boolean {
  let i = start;
  while (i < 34 && c[i] === 0) i++;
  if (i >= 34) return w % 3 === 0;
  const n = c[i];
  const branches: Array<[number[], number]> = [];
  if (n >= 3) { const d = c.slice(); d[i] -= 3; branches.push([d, w]); }
  if (n < 3 && w >= 3 - n) { const d = c.slice(); d[i] = 0; branches.push([d, w - (3 - n)]); }
  if (i < 27) {
    const r = i % 9;
    if (r <= 6) {
      const d = c.slice(); let ww = w; d[i]--;
      for (const j of [i + 1, i + 2]) { if (d[j] > 0) d[j]--; else ww--; }
      if (ww >= 0) branches.push([d, ww]);
    }
    if (r === 7 && c[i + 1] > 0 && w >= 1) { const d = c.slice(); d[i]--; d[i + 1]--; branches.push([d, w - 1]); }
  }
  return branches.some(([d, ww]) => canSetsClean(d, ww, i));
}


function canStandard(c: number[], w: number): boolean {
  for (let k = 0; k < 34; k++) {
    if (c[k] >= 2) { const d = c.slice(); d[k] -= 2; if (canSetsClean(d, w, 0)) return true; }
    if (c[k] === 1 && w >= 1) { const d = c.slice(); d[k] = 0; if (canSetsClean(d, w - 1, 0)) return true; }
  }
  return w >= 2 && canSetsClean(c.slice(), w - 2, 0);
}

function canChiitoi(c: number[], w: number, meldCount: number): boolean {
  if (meldCount > 0) return false;
  const total = c.reduce((a, b) => a + b, 0) + w;
  if (total !== 14) return false;
  const odd = c.filter((n) => n % 2 === 1).length;
  return odd <= w;
}

const ORPHANS = [0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33];

function canThirteen(c: number[], w: number, meldCount: number): boolean {
  if (meldCount > 0) return false;
  if (c.some((n, k) => n > 0 && !ORPHANS.includes(k))) return false;
  const missing = ORPHANS.filter((k) => c[k] === 0).length;
  const hasPair = ORPHANS.some((k) => c[k] >= 2);
  return missing + (hasPair ? 0 : 1) <= w && c.reduce((a, b) => a + b, 0) + w === 14;
}

export function splitWild(counts: number[], wild: number | null): { c: number[]; w: number } {
  const c = counts.slice();
  if (wild === null) return { c, w: 0 };
  const w = c[wild];
  c[wild] = 0;
  return { c, w };
}

export function isWinning(counts: number[], meldCount: number, rule: RuleSet, wild: number | null): boolean {
  const { c, w } = splitWild(counts, wild);
  if (w === 0 && shanten(c, meldCount) === -1) return true;
  if (w > 0 && (canStandard(c, w) || canChiitoi(c, w, meldCount))) return true;
  return rule.thirteen && canThirteen(c, w, meldCount);
}

/** AI 用：带赖子的近似向听数（每张赖子约减少一向听）。 */
export function evalShanten(counts: number[], meldCount: number, wild: number | null): number {
  const { c, w } = splitWild(counts, wild);
  return Math.max(w > 0 ? 0 : -1, shanten(c, meldCount) - w);
}

function canAllTriplets(c: number[], w: number): boolean {
  const need = (d: number[]) => d.reduce((a, n) => a + (n === 0 ? 0 : (3 - (n % 3)) % 3), 0);
  for (let k = 0; k < 34; k++) {
    if (c[k] === 0) continue;
    const d = c.slice();
    const used = Math.min(2, d[k]);
    d[k] -= used;
    const ww = w - (2 - used);
    if (ww >= 0 && need(d) <= ww) return true;
  }
  return w >= 2 && need(c) <= w - 2;
}

interface ScoreContext { selfDraw: boolean; afterKong: boolean; lastTile: boolean }

export function scoreHand(hand: Tile[], melds: Meld[], ctx: ScoreContext, rule: RuleSet, wild: number | null): FanItem[] {
  const { c, w } = splitWild(toCounts(hand), wild);
  const noChi = melds.every((m) => m.type !== 'chi');
  const kongs = melds.filter((m) => m.type !== 'chi' && m.type !== 'peng').length;
  const thirteen = rule.thirteen && canThirteen(c, w, melds.length) && !(w === 0 && shanten(c, melds.length) === -1);
  const pengpeng = !thirteen && noChi && canAllTriplets(c, w);
  const chiitoi = !thirteen && !pengpeng && canChiitoi(c, w, melds.length)
    && !(w === 0 ? standardShanten(c, 0) === -1 : canStandard(c, w));

  const kinds = [...hand, ...melds.flatMap((m) => m.tiles)].map((t) => t.k).filter((k) => k !== wild);
  const suits = new Set(kinds.filter((k) => !isHonor(k)).map(suitOf));
  const hasHonor = kinds.some(isHonor);
  const allHonor = suits.size === 0;
  const pure = suits.size === 1 && !hasHonor;
  const mixed = suits.size === 1 && hasHonor;
  const closed = melds.every((m) => m.type === 'agang');

  const items: FanItem[] = [];
  const add = (cond: boolean, name: string, fan: number) => { if (cond) items.push({ name, fan }); };

  if (rule.id === 'guangdong') {
    add(true, '鸡胡', 1);
    add(thirteen, '十三幺', 13);
    add(chiitoi, '七对', 4);
    add(pengpeng, '对对胡', 3);
    add(allHonor, '字一色', 10);
    add(pure, '清一色', 7);
    add(mixed, '混一色', 3);
    add(ctx.selfDraw, '自摸', 1);
    add(ctx.afterKong && ctx.selfDraw, '杠上开花', 2);
    add(ctx.lastTile, '海底', 1);
    return items;
  }

  add(true, rule.id === 'hongzhong' ? '自摸底分' : '底和', rule.id === 'hongzhong' ? 2 : 1);
  add(chiitoi, '七对', 2);
  add(pengpeng, '碰碰胡', 2);
  add(allHonor, '字一色', 6);
  add(pure, '清一色', 3);
  add(mixed, '混一色', 1);
  add(rule.wild !== 'none' && w === 0, '硬胡（无赖子）', 2);
  add(closed && rule.id !== 'hongzhong', '门前清', 1);
  add(ctx.selfDraw && rule.id !== 'hongzhong', '自摸', 1);
  add(kongs > 0, `杠 ×${kongs}`, kongs);
  add(ctx.afterKong && ctx.selfDraw, '杠上开花', 1);
  add(ctx.lastTile, ctx.selfDraw ? '海底捞月' : '河底捞鱼', 1);
  return items;
}
