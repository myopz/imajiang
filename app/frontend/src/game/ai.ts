import type { ClaimChoice, ClaimOptions, Player, SelfGang, Tile } from './types';
import { evalShanten } from './rules';
import { toCounts } from './tiles';

function keepValue(k: number, c: number[]): number {
  if (k >= 27) return c[k] >= 2 ? 6 : 0;
  const r = k % 9;
  let v = r === 0 || r === 8 ? 1 : r === 1 || r === 7 ? 2 : 3;
  if (r > 0 && c[k - 1] > 0) v += 2;
  if (r < 8 && c[k + 1] > 0) v += 2;
  if (r > 1 && c[k - 2] > 0) v += 1;
  if (r < 7 && c[k + 2] > 0) v += 1;
  if (c[k] >= 2) v += 3;
  return v;
}

export function minDiscardShanten(c: number[], meldCount: number, wild: number | null): number {
  let best = 99;
  for (let k = 0; k < 34; k++) {
    if (c[k] === 0 || k === wild) continue;
    c[k]--;
    best = Math.min(best, evalShanten(c, meldCount, wild));
    c[k]++;
  }
  return best;
}

/** 选择出牌：保留赖子；先最小化向听数，再比较有效进张，最后丢弃孤张/字牌。 */
export function chooseDiscard(hand: Tile[], meldCount: number, wild: number | null): Tile {
  const c = toCounts(hand);
  let kinds = [...new Set(hand.map((t) => t.k))].filter((k) => k !== wild);
  if (kinds.length === 0) kinds = [hand[0].k];
  const scored = kinds.map((k) => {
    c[k]--;
    const s = evalShanten(c, meldCount, wild);
    c[k]++;
    return { k, s };
  });
  const minS = Math.min(...scored.map((x) => x.s));
  const cands = scored.filter((x) => x.s === minS).map((x) => ({ k: x.k, uke: 0, val: keepValue(x.k, c) }));

  if (cands.length > 1 && cands.length <= 10) {
    for (const cd of cands) {
      c[cd.k]--;
      let uke = 0;
      for (let t = 0; t < 34; t++) {
        if (t === cd.k || t === wild || c[t] >= 4) continue;
        c[t]++;
        if (evalShanten(c, meldCount, wild) < minS) uke += 5 - c[t];
        c[t]--;
      }
      c[cd.k]++;
      cd.uke = uke;
    }
  }
  cands.sort((a, b) => b.uke - a.uke || a.val - b.val);
  const target = cands[0].k;
  return hand.find((t) => t.k === target) ?? hand[hand.length - 1];
}

function without(c: number[], kinds: number[]): number[] {
  const n = c.slice();
  for (const k of kinds) n[k]--;
  return n;
}

export function aiClaimDecision(player: Player, tile: Tile, opts: ClaimOptions, wild: number | null): ClaimChoice {
  if (opts.hu) return { type: 'hu' };
  const m = player.melds.length;
  const c = toCounts(player.hand);
  const cur = evalShanten(c, m, wild);
  const k = tile.k;
  if (opts.gang && evalShanten(without(c, [k, k, k]), m + 1, wild) <= cur) return { type: 'gang' };
  if (opts.peng && minDiscardShanten(without(c, [k, k]), m + 1, wild) < cur) return { type: 'peng' };
  for (const kinds of opts.chi) {
    if (minDiscardShanten(without(c, kinds), m + 1, wild) < cur) return { type: 'chi', kinds };
  }
  return { type: 'pass' };
}

export function aiShouldSelfGang(player: Player, gang: SelfGang, wild: number | null): boolean {
  const m = player.melds.length;
  const c = toCounts(player.hand);
  const cur = minDiscardShanten(c, m, wild);
  const { k } = gang;
  if (gang.type === 'agang') return evalShanten(without(c, [k, k, k, k]), m + 1, wild) <= cur;
  return evalShanten(without(c, [k]), m, wild) <= cur;
}
