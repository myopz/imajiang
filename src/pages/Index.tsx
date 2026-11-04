import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MjTile, TileBack } from '@/components/MjTile';
import { cn } from '@/lib/utils';
import type { ClaimChoice, GameState, Meld, Player } from '@/game/types';
import { NAMES, discard, newRound, resolveClaims, selfGang, selfOptions, selfWin } from '@/game/engine';
import { aiShouldSelfGang, chooseDiscard } from '@/game/ai';
import { tileLabel } from '@/game/tiles';
import { RULESETS, getRule } from '@/game/rulesets';
import { Die } from '@/components/MjTile';

const STORE = 'mj-solo-v2';
const WINDS = ['东', '南', '西', '北'];
const AI_DELAY = 650;

interface Saved { scores: number[]; dealer: number; round: number; ruleId: string }

function loadSaved(): Saved {
  try {
    const v = JSON.parse(localStorage.getItem(STORE) ?? '') as Saved;
    if (Array.isArray(v.scores) && v.scores.length === 4) return { ...v, ruleId: getRule(v.ruleId).id };
  } catch { /* 无存档时使用默认值 */ }
  return { scores: [0, 0, 0, 0], dealer: 0, round: 1, ruleId: 'classic' };
}

const seatWind = (seat: number, dealer: number) => WINDS[(seat - dealer + 4) % 4];

function Melds({ melds, small, wild }: { melds: Meld[]; small?: boolean; wild?: number | null }) {
  if (melds.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {melds.map((m, i) => (
        <div key={i} className="flex gap-[1px]">
          {m.tiles.map((t, j) =>
            m.type === 'agang' && (j === 0 || j === 3)
              ? <TileBack key={t.id} />
              : <MjTile key={t.id} k={t.k} size={small ? 'river' : 'meld'} wild={t.k === wild} />,
          )}
        </div>
      ))}
    </div>
  );
}

/** 舞台基准尺寸：牌桌按此逻辑尺寸绘制，再整体缩放到可用区域，任何屏幕下都完整显示。 */
const STAGE = {
  landscape: { w: 1200, h: 800, handW: 58, handH: 80, font: 14, riverW: 34, riverH: 46, cols: 6 },
  portrait: { w: 760, h: 1000, handW: 48, handH: 66, font: 18, riverW: 30, riverH: 41, cols: 6 },
};
type StageBase = (typeof STAGE)['landscape'];

/** 出牌区几何：宽度由列数决定；到中心距离 d ≥ 宽度一半，保证四边对称且四角不重叠。 */
function riverGeom(base: StageBase) {
  const width = base.cols * base.riverW + (base.cols - 1) * 2 + 6;
  return { width, d: Math.ceil(width / 2) + 4, minH: 3 * base.riverH + 2 * 5 + 6 };
}
const RIVER_ROTATION = [0, -90, 180, 90];

function useStageFit() {
  const ref = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const portrait = box.w < box.h;
  const base = portrait ? STAGE.portrait : STAGE.landscape;
  const scale = Math.min(box.w / base.w, box.h / base.h) || 1;
  return { ref, base, portrait, scale, width: box.w / scale, height: box.h / scale, ready: box.w > 0 };
}

function SeatBadge({ p, seat, s }: { p: Player; seat: number; s: GameState }) {
  const active = s.phase !== 'end' && s.turn === seat;
  return (
    <div
      style={{ fontSize: 'var(--ui-font)' }}
      className={cn('inline-flex flex-wrap items-center justify-center gap-x-1.5 max-w-[124px] rounded-[16px] px-2.5 py-1 leading-tight mj-panel border',
        active ? 'border-[#E8B04B] text-[#E8B04B]' : 'border-transparent')}
    >
      <span className="font-brush text-[1.15em] leading-none">{seatWind(seat, s.dealer)}</span>
      <span className="font-semibold">{p.name}</span>
      {s.dealer === seat && <span className="rounded-full bg-[#B3261E] px-1.5 text-[0.8em] text-white">庄</span>}
      <span className={p.score >= 0 ? 'text-[#9BE3B9]' : 'text-[#FF9C8F]'}>{p.score}</span>
    </div>
  );
}

/** 出牌区：四边摆放——每家出牌区居中对齐在罗盘的一条边上，按座位旋转 0/90/180/270°，四家完全对称。 */
function River({ s, seat, lastId, base }: { s: GameState; seat: number; lastId?: number; base: StageBase }) {
  const { width, d, minH } = riverGeom(base);
  return (
    <div className="absolute left-1/2 top-1/2 w-0 h-0" style={{ transform: `rotate(${RIVER_ROTATION[seat]}deg)` }}>
      <div
        className="absolute mj-panel rounded-[10px] p-[3px] grid gap-x-[2px] gap-y-[5px] content-start"
        style={{ left: -width / 2, top: d, width, minHeight: minH, gridTemplateColumns: `repeat(${base.cols}, ${base.riverW}px)` }}
      >
        {s.players[seat].discards.map((t) => (
          <MjTile key={t.id} k={t.k} size="river" highlight={t.id === lastId} wild={t.k === s.wild} />
        ))}
      </div>
    </div>
  );
}

function Opponent({ s, seat, side }: { s: GameState; seat: number; side: 'left' | 'top' | 'right' }) {
  const p = s.players[seat];
  const reveal = s.phase === 'end';
  const vertical = side !== 'top';
  const pos = {
    top: 'top-2 left-1/2 -translate-x-1/2 items-center',
    left: 'left-2 top-1/2 -translate-y-1/2 items-start',
    right: 'right-2 top-1/2 -translate-y-1/2 items-end',
  }[side];
  return (
    <div className={cn('absolute flex flex-col gap-1.5', pos)}>
      <SeatBadge p={p} seat={seat} s={s} />
      <div className={cn('flex gap-2', vertical ? (side === 'right' ? 'flex-row-reverse' : 'flex-row') : 'flex-col items-center')}>
        <div className={cn('flex gap-[2px]', vertical ? (reveal ? 'flex-wrap w-[54px]' : 'flex-col') : 'flex-row')}>
          {reveal
            ? p.hand.map((t) => <MjTile key={t.id} k={t.k} size="river" wild={t.k === s.wild} />)
            : p.hand.map((t) => <TileBack key={t.id} vertical={vertical} />)}
        </div>
        <div className={vertical ? 'max-w-[84px]' : ''}><Melds melds={p.melds} small wild={s.wild} /></div>
      </div>
    </div>
  );
}

export default function Index() {
  const [saved, setSaved] = useState<Saved>(loadSaved);
  const [s, setS] = useState<GameState>(() => newRound(saved.scores, saved.dealer, saved.round, saved.ruleId));

  useEffect(() => {
    if (s.phase !== 'end' || !s.result) return;
    const data = { scores: s.players.map((p) => p.score), dealer: s.dealer, round: s.round, ruleId: s.ruleId };
    localStorage.setItem(STORE, JSON.stringify(data));
    setSaved(data);
  }, [s]);

  // 电脑回合
  useEffect(() => {
    if (s.phase !== 'turn' || s.turn === 0) return;
    const id = window.setTimeout(() => {
      setS((cur) => {
        if (cur.phase !== 'turn' || cur.turn === 0) return cur;
        const p = cur.turn;
        const opts = selfOptions(cur, p);
        if (opts.hu) return selfWin(cur, p);
        const g = opts.gangs.find((x) => aiShouldSelfGang(cur.players[p], x, cur.wild));
        if (g) return selfGang(cur, p, g);
        const pl = cur.players[p];
        return discard(cur, p, chooseDiscard(pl.hand, pl.melds.length, cur.wild).id);
      });
    }, AI_DELAY);
    return () => window.clearTimeout(id);
  }, [s]);

  const myOpts = useMemo(() => selfOptions(s, 0), [s]);
  const myTurn = s.phase === 'turn' && s.turn === 0;

  const onDiscard = (id: number) => myTurn && setS((cur) => discard(cur, 0, id));
  const onClaim = (c: ClaimChoice) => setS((cur) => resolveClaims(cur, c));

  const nextRound = useCallback(() => {
    const r = s.result;
    const dealer = r && r.winner === s.dealer ? s.dealer : (s.dealer + 1) % 4;
    const data = { scores: s.players.map((p) => p.score), dealer, round: s.round + 1, ruleId: s.ruleId };
    localStorage.setItem(STORE, JSON.stringify(data));
    setSaved(data);
    setS(newRound(data.scores, dealer, data.round, data.ruleId));
  }, [s]);

  const restart = (ruleId: string = s.ruleId) => {
    const data = { scores: [0, 0, 0, 0], dealer: 0, round: 1, ruleId };
    localStorage.setItem(STORE, JSON.stringify(data));
    setSaved(data);
    setS(newRound(data.scores, 0, 1, ruleId));
  };
  const rule = getRule(s.ruleId);

  const me = s.players[0];
  const lastId = s.lastDiscard?.tile.id;
  const handTiles = s.drawn && myTurn ? me.hand.filter((t) => t.id !== s.drawn?.id) : me.hand;
  const goldBtn = 'min-h-10 rounded-full px-5 font-bold text-[15px] bg-[#E8B04B] text-[#3A220F] hover:bg-[#f0c165] focus-visible:ring-2 focus-visible:ring-[#E8B04B] focus-visible:outline-none';
  const huBtn = 'min-h-10 rounded-full px-6 font-bold text-[15px] bg-[#B3261E] text-white hover:bg-[#cc3329] focus-visible:ring-2 focus-visible:ring-[#E8B04B] focus-visible:outline-none';
  const passBtn = 'min-h-10 rounded-full px-5 font-bold text-[15px] !bg-transparent border border-[#F4EBD0] text-[#F4EBD0] hover:!bg-white/10';

  const stage = useStageFit();
  const uiScale = Math.min(2, Math.max(1, 0.85 / stage.scale));
  const stageStyle = {
    width: stage.width,
    height: stage.height,
    transform: `scale(${stage.scale})`,
    '--hand-w': `${stage.base.handW}px`,
    '--hand-h': `${stage.base.handH}px`,
    '--ui-font': `${stage.base.font}px`,
    '--river-w': `${stage.base.riverW}px`,
    '--river-h': `${stage.base.riverH}px`,
  } as CSSProperties;
  const showActions = myTurn || (s.phase === 'claim' && !!s.humanClaim);

  return (
    <main className="mj-root h-[100dvh] w-full overflow-hidden p-1 sm:p-2 flex flex-col gap-1">
      <header className="h-9 shrink-0 flex items-center justify-between gap-2 px-1 text-xs sm:text-sm">
        <h1 className="font-brush text-[22px] sm:text-[26px] text-[#E8B04B] leading-none whitespace-nowrap">雀神<span className="hidden sm:inline"> · 单机麻将</span></h1>
        <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
          <select
            aria-label="选择地方玩法"
            value={s.ruleId}
            onChange={(e) => restart(e.target.value)}
            className="h-8 max-w-[116px] sm:max-w-none rounded-full bg-[#08301F] border border-[#E8B04B] text-[#F4EBD0] px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B04B]"
          >
            {RULESETS.map((r) => <option key={r.id} value={r.id}>{r.name}（{r.region}）</option>)}
          </select>
          <Popover>
            <PopoverTrigger className="h-8 rounded-full px-2.5 border border-[#F4EBD0] text-[#F4EBD0] hover:bg-white/10 whitespace-nowrap">规则</PopoverTrigger>
            <PopoverContent className="w-72 bg-[#FBF6E9] text-[#3A220F] border-[#D9CFB4] text-sm">
              <p className="font-bold mb-1">{rule.name}（{rule.region}）</p>
              <ul className="list-disc pl-4 space-y-0.5">{rule.summary.map((t) => <li key={t}>{t}</li>)}</ul>
            </PopoverContent>
          </Popover>
          <span className="whitespace-nowrap">第{s.round}局 · 余{s.wall.length}</span>
          <button type="button" onClick={() => restart()} className="h-8 rounded-full px-2.5 !bg-transparent border border-[#F4EBD0] text-[#F4EBD0] hover:!bg-white/10 whitespace-nowrap">重开</button>
        </div>
      </header>

      <div className="mj-frame flex-1 min-h-0 w-full rounded-[20px] p-[6px]">
        <div ref={stage.ref} className="mj-felt relative w-full h-full rounded-[15px] overflow-hidden">
          {stage.ready && (
            <div className="absolute left-0 top-0 origin-top-left" style={stageStyle}>
              <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5" style={{ fontSize: 'var(--ui-font)' }}>
                <span className="flex items-center gap-1.5">
                  <Die key={`a${s.round}-${s.dice[0]}`} n={s.dice[0]} rolling /><Die key={`b${s.round}-${s.dice[1]}`} n={s.dice[1]} rolling />
                  <span>{s.dice[0] + s.dice[1]} 点</span>
                </span>
                {s.flipTile && <span className="flex items-center gap-1.5">赖子皮 <MjTile k={s.flipTile.k} size="river" /></span>}
                {s.wild !== null && <span className="flex items-center gap-1.5">赖子 <MjTile k={s.wild} size="river" wild /></span>}
              </div>

              <Opponent s={s} seat={2} side="top" />
              <Opponent s={s} seat={3} side="left" />
              <Opponent s={s} seat={1} side="right" />

              {[0, 1, 2, 3].map((seat) => <River key={seat} s={s} seat={seat} lastId={lastId} base={stage.base} />)}

              <div style={{ width: riverGeom(stage.base).d * 2 - 8, height: riverGeom(stage.base).d * 2 - 8 }} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 mj-panel rounded-[16px] flex flex-col items-center justify-center gap-1 border border-[#E8B04B]/40">
                {[0, 1, 2, 3].map((seat) => {
                  const pos = ['bottom-1 left-1/2 -translate-x-1/2', 'right-1.5 top-1/2 -translate-y-1/2', 'top-1 left-1/2 -translate-x-1/2', 'left-1.5 top-1/2 -translate-y-1/2'][seat];
                  const active = s.phase !== 'end' && s.turn === seat;
                  return <span key={seat} className={cn('absolute font-brush text-2xl', pos, active ? 'text-[#E8B04B]' : 'text-[#F4EBD0]/50')}>{seatWind(seat, s.dealer)}</span>;
                })}
                {s.lastDiscard ? <MjTile k={s.lastDiscard.tile.k} size="big" highlight wild={s.lastDiscard.tile.k === s.wild} /> : <span className="opacity-70" style={{ fontSize: 'var(--ui-font)' }}>等待出牌</span>}
                <span className="text-center px-7 leading-tight" style={{ fontSize: `calc(var(--ui-font) * 0.85)` }}>{s.message || `${NAMES[s.turn]} 的回合`}</span>
              </div>

              <div className="absolute left-3" style={{ bottom: stage.portrait ? stage.base.handH + 28 : 12 }}><SeatBadge p={me} seat={0} s={s} /></div>

              <section className="absolute inset-x-2 bottom-3 flex flex-col items-center gap-2">
                <div className="relative z-10 min-h-11 flex items-center justify-center" style={{ transform: `scale(${uiScale})`, transformOrigin: 'bottom center' }}>
                  {showActions && (
                    <div className="flex flex-wrap items-center justify-center gap-2 rounded-[24px] bg-[#08301F]/90 px-3 py-1">
                      {s.phase === 'claim' && s.humanClaim && s.lastDiscard && (
                        <>
                          <span className="text-sm">{s.players[s.lastDiscard.from].name} 打出 {tileLabel(s.lastDiscard.tile.k)}：</span>
                          {s.humanClaim.hu && <button type="button" className={huBtn} onClick={() => onClaim({ type: 'hu' })}>胡</button>}
                          {s.humanClaim.gang && <button type="button" className={goldBtn} onClick={() => onClaim({ type: 'gang' })}>杠</button>}
                          {s.humanClaim.peng && <button type="button" className={goldBtn} onClick={() => onClaim({ type: 'peng' })}>碰</button>}
                          {s.humanClaim.chi.map((kinds) => (
                            <button type="button" key={kinds.join()} className={goldBtn} onClick={() => onClaim({ type: 'chi', kinds })}>
                              吃 {[...kinds, s.lastDiscard!.tile.k].sort((a, b) => a - b).map((k) => tileLabel(k).slice(0, 1)).join('')}
                            </button>
                          ))}
                          <button type="button" className={passBtn} onClick={() => onClaim({ type: 'pass' })}>过</button>
                        </>
                      )}
                      {myTurn && (
                        <>
                          {myOpts.hu && <button type="button" className={huBtn} onClick={() => setS((c) => selfWin(c, 0))}>自摸 胡</button>}
                          {myOpts.gangs.map((g) => (
                            <button type="button" key={g.type + g.k} className={goldBtn} onClick={() => setS((c) => selfGang(c, 0, g))}>
                              {g.type === 'agang' ? '暗杠' : '加杠'} {tileLabel(g.k)}
                            </button>
                          ))}
                          <span className="text-sm text-[#E8B04B]">轮到你了，点击一张牌打出</span>
                        </>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex items-end justify-center gap-3">
                  <Melds melds={me.melds} wild={s.wild} />
                  <div className="flex items-end gap-[2px]">
                    {handTiles.map((t) => <MjTile key={t.id} k={t.k} wild={t.k === s.wild} onClick={myTurn ? () => onDiscard(t.id) : undefined} />)}
                    {s.drawn && myTurn && (
                      <MjTile k={s.drawn.k} wild={s.drawn.k === s.wild} onClick={() => onDiscard(s.drawn!.id)} className="ml-3" highlight />
                    )}
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>
      </div>

          {s.phase === 'end' && s.result && (
            <div className="fixed inset-0 z-30 bg-black/55 flex overflow-y-auto p-3">
              <div className="m-auto w-full max-w-[520px] rounded-[16px] bg-[#FBF6E9] text-[#3A220F] p-4 sm:p-5 shadow-2xl">
                <h2 className="font-brush text-4xl text-center text-[#B3261E] mb-3">
                  {s.result.kind === 'draw' ? '流局' : `${s.players[s.result.winner!].name} ${s.result.from === null ? '自摸' : '胡牌'}`}
                </h2>
                {s.result.kind === 'win' && (
                  <>
                    {s.result.from !== null && <p className="text-center text-sm mb-2">{s.players[s.result.from].name} 点炮 {tileLabel(s.result.winTile!.k)}</p>}
                    <div className="flex flex-wrap justify-center gap-[2px] mb-2">
                      {s.players[s.result.winner!].hand.map((t) => <MjTile key={t.id} k={t.k} size="meld" wild={t.k === s.wild} highlight={t.id === s.result!.winTile?.id} />)}
                    </div>
                    <div className="flex justify-center mb-3"><Melds melds={s.players[s.result.winner!].melds} wild={s.wild} /></div>
                    <ul className="text-sm grid grid-cols-2 gap-x-6 gap-y-1 mb-2">
                      {s.result.fans.map((f) => <li key={f.name} className="flex justify-between"><span>{f.name}</span><span>{f.fan} 番</span></li>)}
                    </ul>
                    <p className="text-center font-bold mb-3">合计 {s.result.total} 番{s.result.from === null ? '（三家各付）' : '（点炮者付双倍）'}</p>
                  </>
                )}
                <div className="grid grid-cols-4 gap-2 text-center text-sm mb-4">
                  {s.players.map((p, i) => (
                    <div key={i} className="rounded-[10px] bg-[#EFE6CC] py-2">
                      <div className="font-semibold">{p.name}</div>
                      <div className={s.result!.deltas[i] >= 0 ? 'text-[#1E7A46]' : 'text-[#B3261E]'}>{s.result!.deltas[i] > 0 ? '+' : ''}{s.result!.deltas[i]}</div>
                      <div className="text-xs opacity-70">总 {p.score}</div>
                    </div>
                  ))}
                </div>
                <div className="flex justify-center gap-3">
                  <button type="button" className="min-h-10 rounded-full px-6 font-bold bg-[#0E5A40] text-white hover:bg-[#17704F]" onClick={nextRound}>下一局</button>
                  <button type="button" className="min-h-10 rounded-full px-6 font-bold !bg-transparent border border-[#3A220F] text-[#3A220F]" onClick={() => restart()}>重新开始</button>
                </div>
              </div>
            </div>
          )}
    </main>
  );
}
