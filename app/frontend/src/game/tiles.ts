import type { Tile } from './types';
import type { RuleSet } from './rulesets';

export const NUM_CN = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
export const SUIT_CN = ['万', '筒', '条'];
export const HONOR_CN = ['东', '南', '西', '北', '中', '发', '白'];
export const HONG_ZHONG = 31;

export const isHonor = (k: number) => k >= 27;
export const suitOf = (k: number) => (k >= 27 ? 3 : Math.floor(k / 9));

export function tileLabel(k: number): string {
  if (isHonor(k)) return HONOR_CN[k - 27];
  return NUM_CN[k % 9] + SUIT_CN[suitOf(k)];
}

/** 翻赖子：赖子皮的下一张（同花色循环，风牌、箭牌各自循环）。 */
export function nextKind(k: number): number {
  if (k < 27) return Math.floor(k / 9) * 9 + ((k % 9) + 1) % 9;
  if (k <= 30) return 27 + ((k - 27 + 1) % 4);
  return 31 + ((k - 31 + 1) % 3);
}

export function createWall(rule: RuleSet): Tile[] {
  const kinds = rule.tileSet === 'hongzhong'
    ? [...Array.from({ length: 27 }, (_, i) => i), HONG_ZHONG]
    : Array.from({ length: 34 }, (_, i) => i);
  const tiles: Tile[] = [];
  let id = 0;
  for (const k of kinds) for (let n = 0; n < 4; n++) tiles.push({ id: id++, k });
  for (let i = tiles.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
  }
  return tiles;
}

/** 理牌：赖子放最前，其余按花色点数。 */
export const sortTiles = (tiles: Tile[], wild: number | null = null): Tile[] =>
  [...tiles].sort((a, b) => Number(b.k === wild) - Number(a.k === wild) || a.k - b.k || a.id - b.id);

export function toCounts(tiles: Tile[]): number[] {
  const c = new Array<number>(34).fill(0);
  for (const t of tiles) c[t.k]++;
  return c;
}
