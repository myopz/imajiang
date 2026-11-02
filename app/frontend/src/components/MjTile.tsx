import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { NUM_CN, tileLabel } from '@/game/tiles';

type Size = 'hand' | 'meld' | 'river' | 'big';

const SIZE: Record<Size, string> = {
  hand: 'w-[25px] h-[36px] sm:w-[38px] sm:h-[54px] lg:w-[46px] lg:h-[64px]',
  meld: 'w-[20px] h-[28px] sm:w-[28px] sm:h-[40px]',
  river: 'w-[18px] h-[25px] sm:w-[24px] sm:h-[34px] lg:w-[28px] lg:h-[39px]',
  big: 'w-[40px] h-[56px] sm:w-[52px] sm:h-[72px]',
};

const RED = '#C0262D';
const GREEN = '#1B7F4B';
const BLUE = '#1D4F91';
const INK = '#1A1F2B';

type P = [number, number];

/** 传统筒子排布（viewBox 60×80） */
const DOTS: Record<number, { pts: P[]; r: number; colors?: string[] }> = {
  2: { pts: [[30, 22], [30, 58]], r: 12, colors: [GREEN, BLUE] },
  3: { pts: [[14, 15], [30, 40], [46, 65]], r: 10, colors: [BLUE, RED, GREEN] },
  4: { pts: [[17, 21], [43, 21], [17, 59], [43, 59]], r: 10.5, colors: [BLUE, GREEN, GREEN, BLUE] },
  5: { pts: [[15, 17], [45, 17], [30, 40], [15, 63], [45, 63]], r: 9.5, colors: [BLUE, GREEN, RED, GREEN, BLUE] },
  6: { pts: [[18, 14], [42, 14], [18, 42], [42, 42], [18, 66], [42, 66]], r: 9, colors: [GREEN, GREEN, RED, RED, RED, RED] },
  7: { pts: [[12, 11], [30, 20], [48, 29], [18, 50], [42, 50], [18, 69], [42, 69]], r: 7.5, colors: [GREEN, GREEN, GREEN, RED, RED, RED, RED] },
  8: { pts: [[18, 11], [42, 11], [18, 30], [42, 30], [18, 50], [42, 50], [18, 69], [42, 69]], r: 8, colors: Array(8).fill(BLUE) },
  9: { pts: [[13, 15], [30, 15], [47, 15], [13, 40], [30, 40], [47, 40], [13, 65], [30, 65], [47, 65]], r: 7.8, colors: [BLUE, BLUE, BLUE, RED, RED, RED, GREEN, GREEN, GREEN] },
};

/** 条子：竹节中心点，红色为中心装饰 */
const BAMBOO: Record<number, { pts: P[]; h: number; red?: number[] }> = {
  2: { pts: [[30, 21], [30, 59]], h: 30 },
  3: { pts: [[30, 21], [18, 59], [42, 59]], h: 30 },
  4: { pts: [[18, 21], [42, 21], [18, 59], [42, 59]], h: 30 },
  5: { pts: [[14, 21], [46, 21], [30, 40], [14, 59], [46, 59]], h: 30, red: [2] },
  6: { pts: [[14, 21], [30, 21], [46, 21], [14, 59], [30, 59], [46, 59]], h: 30 },
  7: { pts: [[30, 13], [14, 41], [30, 41], [46, 41], [14, 67], [30, 67], [46, 67]], h: 21, red: [0] },
  8: { pts: [[10, 21], [23, 21], [37, 21], [50, 21], [10, 59], [23, 59], [37, 59], [50, 59]], h: 30 },
  9: { pts: [[14, 15], [30, 15], [46, 15], [14, 40], [30, 40], [46, 40], [14, 65], [30, 65], [46, 65]], h: 21, red: [1, 4, 7] },
};

function Dot({ x, y, r, color }: { x: number; y: number; r: number; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={color} />
      <circle cx={x} cy={y} r={r * 0.72} fill="#FBF6E9" />
      <circle cx={x} cy={y} r={r * 0.5} fill="none" stroke={color} strokeWidth={r * 0.14} strokeDasharray={`${r * 0.25} ${r * 0.18}`} />
      <circle cx={x} cy={y} r={r * 0.24} fill={color} />
    </g>
  );
}

function Stick({ x, y, h, color }: { x: number; y: number; h: number; color: string }) {
  const w = 7.5;
  const top = y - h / 2;
  return (
    <g>
      <rect x={x - w / 2} y={top} width={w} height={h} rx={3.5} fill={color} />
      <rect x={x - 1} y={top + 2} width={2} height={h - 4} rx={1} fill="#FBF6E9" opacity={0.55} />
      <rect x={x - w / 2 - 0.8} y={y - 1.2} width={w + 1.6} height={2.4} rx={1.2} fill={color} stroke="#FBF6E9" strokeWidth={0.6} />
      <rect x={x - w / 2 - 0.8} y={top} width={w + 1.6} height={2.2} rx={1.1} fill={color} />
      <rect x={x - w / 2 - 0.8} y={top + h - 2.2} width={w + 1.6} height={2.2} rx={1.1} fill={color} />
    </g>
  );
}

function Bird() {
  return (
    <g>
      <path d="M18 62 Q10 48 20 34 Q14 20 26 14 Q34 10 38 18 L46 16 L40 22 Q44 34 36 44 Q46 52 44 66 Q36 58 30 60 Q24 70 18 62 Z" fill={GREEN} />
      <path d="M26 14 Q34 10 38 18 L46 16 L40 22 Q36 22 32 22 Z" fill={RED} />
      <circle cx={33} cy={17} r={1.8} fill="#FBF6E9" />
      <path d="M22 40 Q30 36 34 44 M20 50 Q28 46 32 54" stroke="#FBF6E9" strokeWidth={1.6} fill="none" />
      <path d="M28 60 L22 74 M32 60 L34 74" stroke={RED} strokeWidth={2} />
    </g>
  );
}

function Glyph({ text, color, y = 54, size = 44 }: { text: string; color: string; y?: number; size?: number }) {
  return (
    <text x={30} y={y} textAnchor="middle" fontSize={size} fill={color} fontFamily="'Noto Serif SC', serif" fontWeight={900}>
      {text}
    </text>
  );
}

function face(k: number): ReactNode {
  if (k < 9) {
    return (
      <>
        <Glyph text={NUM_CN[k]} color={INK} y={32} size={28} />
        <Glyph text="萬" color={RED} y={72} size={34} />
      </>
    );
  }
  if (k < 18) {
    const n = k - 9 + 1;
    if (n === 1) {
      return (
        <g>
          <circle cx={30} cy={40} r={22} fill={GREEN} />
          <circle cx={30} cy={40} r={18} fill="#FBF6E9" />
          <circle cx={30} cy={40} r={14} fill={RED} />
          <circle cx={30} cy={40} r={10} fill="#FBF6E9" stroke={BLUE} strokeWidth={2} strokeDasharray="3 2" />
          <circle cx={30} cy={40} r={4} fill={BLUE} />
        </g>
      );
    }
    const d = DOTS[n];
    return d.pts.map(([x, y], i) => <Dot key={i} x={x} y={y} r={d.r} color={d.colors?.[i] ?? BLUE} />);
  }
  if (k < 27) {
    const n = k - 18 + 1;
    if (n === 1) return <Bird />;
    const b = BAMBOO[n];
    return b.pts.map(([x, y], i) => <Stick key={i} x={x} y={y} h={b.h} color={b.red?.includes(i) ? RED : GREEN} />);
  }
  if (k <= 30) return <Glyph text={['東', '南', '西', '北'][k - 27]} color={INK} />;
  if (k === 31) return <Glyph text="中" color={RED} />;
  if (k === 32) return <Glyph text="發" color={GREEN} />;
  return <rect x={12} y={14} width={36} height={52} rx={3} fill="none" stroke={BLUE} strokeWidth={4} />;
}

interface Props {
  k: number;
  size?: Size;
  highlight?: boolean;
  wild?: boolean;
  onClick?: () => void;
  className?: string;
}

export function MjTile({ k, size = 'hand', highlight, wild, onClick, className }: Props) {
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      aria-label={tileLabel(k) + (wild ? '（赖子）' : '')}
      onClick={onClick}
      className={cn(
        'mj-tile relative block shrink-0 rounded-[5px] select-none p-0 overflow-visible',
        SIZE[size],
        onClick && 'cursor-pointer transition-transform duration-150 ease-out hover:-translate-y-[6px] focus-visible:-translate-y-[6px] focus-visible:outline-none',
        highlight && 'ring-2 ring-[#E8B04B]',
        wild && 'mj-wild',
        className,
      )}
    >
      <svg
        viewBox="0 0 60 80"
        preserveAspectRatio="xMidYMid meet"
        className="absolute left-[6%] top-[5%] w-[88%] h-[90%] pointer-events-none"
        aria-hidden="true"
      >
        {face(k)}
      </svg>
      {wild && (
        <span className="absolute -top-1 -right-1 rounded-full bg-[#E8B04B] text-[#3A220F] font-bold leading-none px-[3px] py-[2px] text-[8px] sm:text-[10px]">赖</span>
      )}
    </Comp>
  );
}

export function TileBack({ vertical }: { vertical?: boolean }) {
  return (
    <div className={cn('mj-back shrink-0 rounded-[3px]', vertical ? 'w-[22px] h-[12px] sm:w-[30px] sm:h-[16px]' : 'w-[12px] h-[18px] sm:w-[18px] sm:h-[26px]')} />
  );
}

const PIPS: Record<number, P[]> = {
  1: [[50, 50]], 2: [[28, 28], [72, 72]], 3: [[25, 25], [50, 50], [75, 75]],
  4: [[28, 28], [72, 28], [28, 72], [72, 72]], 5: [[27, 27], [73, 27], [50, 50], [27, 73], [73, 73]],
  6: [[30, 24], [70, 24], [30, 50], [70, 50], [30, 76], [70, 76]],
};

export function Die({ n, rolling }: { n: number; rolling?: boolean }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('w-7 h-7 sm:w-9 sm:h-9 drop-shadow', rolling && 'mj-roll')} role="img" aria-label={`骰子 ${n} 点`}>
      <rect x={4} y={4} width={92} height={92} rx={18} fill="#FBF6E9" stroke="#D9CFB4" strokeWidth={3} />
      {PIPS[n].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={n === 1 ? 14 : 9} fill={n === 1 || n === 4 ? RED : INK} />)}
    </svg>
  );
}
