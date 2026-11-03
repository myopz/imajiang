import { useCallback, useEffect, useMemo, useState } from 'react';
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

function SeatBadge({ p, seat, s, compact }: { p: Player; seat: number; s: GameState; compact?: boolean }) {
  const active = s.phase !== 'end' && s.turn === seat;
  return (
    <div className={cn(
      'inline-flex items-center rounded-full mj-panel border max-w-full',
      compact ? 'flex-col gap-0 px-1.5 py-1 text-[10px] sm:text-xs' : 'gap-1.5 px-2.5 py-1 text-xs sm:text-sm',
      active ? 'border-[#E8B04B] text-[#E8B04B]' : 'border-transparent',
    )}>
      <span className={cn('font-brush leading-none', compact ? 'text-sm' : 'text-base')}>{seatWind(seat, s.dealer)}</span>
      <span className="font-semibold truncate">{p.name}</span>
      {s.dealer === seat && <span className="rounded-full bg-[#B3261E] px-1.5 text-[10px] text-white">庄</span>}
      <span className={p.score >= 0 ? 'text-[#9BE3B9]' : 'text-[#FF9C8F]'}>{p.score}</span>
    </div>
  );
}

function River({ p, lastId, wild }: { p: Player; lastId?: number; wild?: number | null }) {
  return (
    <div className="flex flex-wrap gap-[2px] content-start">
      {p.discards.map((t) => <MjTile key={t.id} k={t.k} size="river" highlight={t.id === lastId} wild={t.k === wild} />)}
    </div>
  );
}

function Opponent({ s, seat, side }: { s: GameState; seat: number; side: 'left' | 'top' | 'right' }) {
  const p = s.players[seat];
  const reveal = s.phase === 'end';
  const vertical = side !== 'top';
  return (
    <div className={cn('flex gap-1.5 sm:gap-2 items-center min-w-0', vertical ? 'flex-col max-w-full' : 'flex-col')}>
      <SeatBadge p={p} seat={seat} s={s} compact={vertical} />
      <div className={cn('flex gap-[2px] shrink-0', vertical ? 'flex-col' : 'flex-row flex-wrap justify-center')}>
        {reveal
          ? p.hand.map((t) => <MjTile key={t.id} k={t.k} size="river" wild={t.k === s.wild} />)
          : p.hand.map((t) => <TileBack key={t.id} vertical={vertical} />)}
      </div>
      <Melds melds={p.melds} small wild={s.wild} />
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

  return (
    <main className="mj-root min-h-screen w-full p-2 sm:p-4 flex flex-col items-center">
      <header className="w-full max-w-[1200px] flex items-center justify-between mb-2 px-1">
        <h1 className="font-brush text-[32px] sm:text-[40px] text-[#E8B04B] leading-none">雀神 · 单机麻将</h1>
        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3 text-sm">
          <label className="flex items-center gap-1.5">
            <span>玩法</span>
            <select
              aria-label="选择地方玩法"
              value={s.ruleId}
              onChange={(e) => restart(e.target.value)}
              className="min-h-8 rounded-full bg-[#08301F] border border-[#E8B04B] text-[#F4EBD0] px-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B04B]"
            >
              {RULESETS.map((r) => <option key={r.id} value={r.id}>{r.name}（{r.region}）</option>)}
            </select>
          </label>
          <span>第 {s.round} 局 · 余牌 {s.wall.length}</span>
          <button type="button" onClick={() => restart()} className={passBtn + ' min-h-8 px-3 text-sm'}>重新开始</button>
        </div>
      </header>
      <div className="w-full max-w-[1200px] mb-1 px-1 flex items-center gap-x-3 text-[11px] sm:text-xs leading-snug min-h-0">
        {s.flipTile && (
          <span className="flex items-center gap-1 shrink-0">赖子皮 <MjTile k={s.flipTile.k} size="river" /></span>
        )}
        {s.wild !== null && (
          <span className="flex items-center gap-1 shrink-0">赖子 <MjTile k={s.wild} size="river" wild /><span className="opacity-80 hidden sm:inline">可当任意牌</span></span>
        )}
        <span className="opacity-70 min-w-0 flex-1 truncate" title={`${rule.name}：${rule.summary.join('；')}`}>
          {rule.name}：{rule.summary.join('；')}
        </span>
      </div>

      <div className="mj-frame w-full max-w-[1200px] rounded-[28px] p-[10px] overflow-hidden">
        <div className="mj-felt relative rounded-[20px] p-2 sm:p-4 grid grid-cols-[56px_minmax(0,1fr)_56px] sm:grid-cols-[96px_minmax(0,1fr)_96px] grid-rows-[auto_minmax(0,1fr)_auto] gap-1.5 sm:gap-3 min-h-[560px] sm:min-h-[680px] overflow-hidden">
          <div className="absolute top-2 left-2 z-10 flex items-center gap-1 pointer-events-none">
            <Die key={`a${s.round}-${s.dice[0]}`} n={s.dice[0]} rolling />
            <Die key={`b${s.round}-${s.dice[1]}`} n={s.dice[1]} rolling />
            <span className="text-[11px] sm:text-xs opacity-80 whitespace-nowrap">{s.dice[0] + s.dice[1]} 点</span>
          </div>
          <div className="col-start-2 row-start-1 flex justify-center min-w-0"><Opponent s={s} seat={2} side="top" /></div>
          <div className="col-start-1 row-start-2 flex items-center justify-center min-w-0 overflow-hidden"><Opponent s={s} seat={3} side="left" /></div>
          <div className="col-start-3 row-start-2 flex items-center justify-center min-w-0 overflow-hidden"><Opponent s={s} seat={1} side="right" /></div>

          <section className="col-start-2 row-start-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] gap-1 sm:gap-2 min-w-0 w-full max-w-full overflow-hidden place-items-center">
            <div className="col-start-2 row-start-1 mj-panel rounded-[12px] p-1 sm:p-1.5 w-[min(100%,140px)] sm:w-[260px] lg:w-[320px] max-h-full overflow-hidden"><River p={s.players[2]} lastId={lastId} wild={s.wild} /></div>
            <div className="col-start-1 row-start-2 mj-panel rounded-[12px] p-1 sm:p-1.5 self-stretch justify-self-stretch w-full min-w-0 max-h-[140px] sm:max-h-[200px] overflow-hidden"><River p={s.players[3]} lastId={lastId} wild={s.wild} /></div>
            <div className="col-start-3 row-start-2 mj-panel rounded-[12px] p-1 sm:p-1.5 self-stretch justify-self-stretch w-full min-w-0 max-h-[140px] sm:max-h-[200px] overflow-hidden"><River p={s.players[1]} lastId={lastId} wild={s.wild} /></div>
            <div className="col-start-2 row-start-2 relative mj-panel rounded-[16px] w-[120px] h-[120px] sm:w-[200px] sm:h-[200px] flex flex-col items-center justify-center gap-0.5 sm:gap-1 border border-[#E8B04B]/40 shrink-0">
              {[0, 1, 2, 3].map((seat) => {
                const pos = ['bottom-1 left-1/2 -translate-x-1/2', 'right-1.5 top-1/2 -translate-y-1/2', 'top-1 left-1/2 -translate-x-1/2', 'left-1.5 top-1/2 -translate-y-1/2'][seat];
                const active = s.phase !== 'end' && s.turn === seat;
                return <span key={seat} className={cn('absolute font-brush text-xl sm:text-2xl', pos, active ? 'text-[#E8B04B]' : 'text-[#F4EBD0]/50')}>{seatWind(seat, s.dealer)}</span>;
              })}
              {s.lastDiscard ? <MjTile k={s.lastDiscard.tile.k} size="big" highlight wild={s.lastDiscard.tile.k === s.wild} /> : <span className="text-xs opacity-70">等待出牌</span>}
              <span className="text-[11px] sm:text-xs text-center px-5 sm:px-6 leading-tight min-h-[2.4em] max-w-full">{s.message || `${NAMES[s.turn]} 的回合`}</span>
            </div>
            <div className="col-start-2 row-start-3 mj-panel rounded-[12px] p-1 sm:p-1.5 w-[min(100%,140px)] sm:w-[260px] lg:w-[320px] max-h-full overflow-hidden"><River p={me} lastId={lastId} wild={s.wild} /></div>
          </section>

          <section className="col-span-3 row-start-3 flex flex-col items-center gap-2 min-w-0 overflow-hidden">
            <div className="flex flex-wrap items-center justify-center gap-2 min-h-10">
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
            <div className="flex items-end gap-3 flex-wrap justify-center">
              <Melds melds={me.melds} wild={s.wild} />
              <div className="flex flex-wrap items-end justify-center gap-[2px] sm:gap-[3px] pt-2 max-w-full">
                {handTiles.map((t) => <MjTile key={t.id} k={t.k} wild={t.k === s.wild} onClick={myTurn ? () => onDiscard(t.id) : undefined} />)}
                {s.drawn && myTurn && (
                  <MjTile k={s.drawn.k} wild={s.drawn.k === s.wild} onClick={() => onDiscard(s.drawn!.id)} className="ml-2 sm:ml-4" highlight />
                )}
              </div>
            </div>
            <SeatBadge p={me} seat={0} s={s} />
          </section>

          {s.phase === 'end' && s.result && (
            <div className="absolute inset-0 z-20 rounded-[20px] bg-black/55 flex items-center justify-center p-3">
              <div className="w-full max-w-[520px] rounded-[16px] bg-[#FBF6E9] text-[#3A220F] p-5 shadow-2xl">
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
        </div>
      </div>
      <p className="mt-2 text-xs opacity-60">累计积分：{saved.scores.join(' / ')}（自动保存在本机）</p>
    </main>
  );
}
