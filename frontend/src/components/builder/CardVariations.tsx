/**
 * CardVariations — R4 "Detached Float" row demos
 *
 * Shows the R4 approach across different row compositions so you can compare
 * how rows look with and without transports side by side.
 *
 * Rows:
 *  R4-A — No transports at all (clean baseline)
 *  R4-B — Same units, now some have transports (detached float appears)
 *  R4-C — All cards have transports (full float row)
 *  R4-D — Single unit with transport + 3 empty slots
 *  R4-E — Fully loaded row, all with transports, no empty slots
 *  R4-F — Fully loaded row, no transports, no empty slots
 */
import { component$, type JSXOutput } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';

/* -- Sample data -- */
const U1 = { name: 'M1A2 Abrams', icon: '/images/labels/icons/US_M1A2.png', count: 3, cost: 150 };
const U2 = { name: 'M270 MLRS', icon: '/images/labels/icons/US_M270.png', count: 2, cost: 200 };
const U3 = { name: 'M2A3 Bradley', icon: '/images/labels/icons/US_M2A3.png', count: 2, cost: 120 };
const U4 = { name: 'M109A6', icon: '/images/labels/icons/US_M109A6.png', count: 1, cost: 250 };
const T = { name: 'M113A3', icon: '/images/labels/icons/US_M113A3.png', count: 3, cost: 30 };

/* ── Shared sub-components ── */

const LeftRail = ({ transport }: { transport: boolean }) => (
  <div class="flex flex-col w-8 border-r border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
    <button class="h-5 flex items-center justify-center text-[11px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] border-b border-[rgba(51,51,51,0.1)] transition-colors">{'\u25c0'}</button>
    <button class="flex-1 flex items-center justify-center text-[14px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] transition-colors">{'\u2212'}</button>
    {transport && (
      <button class="h-6 flex items-center justify-center text-[12px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] border-t border-[rgba(51,51,51,0.15)] transition-colors">{'\u2212'}</button>
    )}
  </div>
);

const RightRail = ({ transport }: { transport: boolean }) => (
  <div class="flex flex-col w-8 border-l border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
    <button class="h-5 flex items-center justify-center text-[11px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] border-b border-[rgba(51,51,51,0.1)] transition-colors">{'\u25b6'}</button>
    <button class="flex-1 flex items-center justify-center text-[14px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] transition-colors">+</button>
    {transport && (
      <button class="h-6 flex items-center justify-center text-[12px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] hover:bg-[rgba(70,151,195,0.08)] border-t border-[rgba(51,51,51,0.15)] transition-colors">+</button>
    )}
  </div>
);

const DeleteCol = () => (
  <div class="flex items-center justify-center w-6 bg-[rgba(200,50,50,0.05)] border-l border-[rgba(51,51,51,0.15)] flex-shrink-0">
    <button class="text-sm font-black text-[var(--text-dim)] hover:text-[var(--red)]">{'\u2715'}</button>
  </div>
);

const TransportBar = () => (
  <div class="flex-1 flex items-center gap-1.5 px-2 h-6 bg-[rgba(70,151,195,0.05)]">
    <GameIcon src={T.icon} size={16} alt={T.name} />
    <span class="text-[10px] font-mono font-semibold text-[var(--text-dim)] truncate flex-1">{T.name}</span>
    <span class="text-[9px] font-mono font-black text-[var(--text-dim)] tabular-nums">{'\u00d7'}{T.count}</span>
    <span class="text-[9px] font-mono font-bold text-[var(--accent)] tabular-nums">+{T.cost * T.count}</span>
  </div>
);

const Sidebar = ({ label, slots, maxSlots, pts, maxPts }: {
  label: string; slots: number; maxSlots: number; pts: number; maxPts: number;
}) => (
  <div class="w-[140px] flex-shrink-0 flex flex-col justify-center gap-1.5 px-4 py-3 border-r border-[rgba(51,51,51,0.15)]">
    <span class="font-mono tracking-[0.2em] uppercase text-[var(--text)] text-sm font-semibold leading-tight">
      {label}
    </span>
    <div class="flex flex-col gap-0.5">
      <span class="text-[11px] font-mono tabular-nums text-[var(--text-dim)]">{slots}/{maxSlots} slots</span>
      <span class="text-[11px] font-mono tabular-nums">
        <span class="text-[var(--accent)]">{pts}</span>
        <span class="text-[var(--text-dim)]">/{maxPts} pts</span>
      </span>
    </div>
  </div>
);

const EmptySlot = () => (
  <div class="flex flex-col gap-px">
    <div class="flex items-center justify-center bg-[rgba(26,26,26,0.25)] border border-[rgba(51,51,51,0.1)] min-h-[76px]">
      <span class="text-[var(--text-dim)] text-lg leading-none mr-1">+</span>
      <span class="text-[10px] font-mono font-semibold text-[var(--text-dim)] uppercase tracking-wider">ADD UNIT</span>
    </div>
  </div>
);

/** V4b unit card core — icon-as-background, name header, count/cost footer */
const UnitCore = ({ unit }: { unit: typeof U1 }) => (
  <div class="relative overflow-hidden min-h-[76px]">
    <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
      <img src={unit.icon} alt="" class="w-20 h-20 object-contain opacity-[0.35]" />
    </div>
    <div class="relative z-10 flex flex-col justify-between h-full">
      <div class="px-2 py-1.5 border-b border-[rgba(51,51,51,0.1)]">
        <p class="text-xs font-bold text-[var(--text)] truncate leading-tight">{unit.name}</p>
      </div>
      <div class="flex items-center gap-3 px-2 py-1.5">
        <span class="text-[11px] font-mono font-black text-[var(--text)] tabular-nums">{'\u00d7'}{unit.count}</span>
        <span class="text-[11px] font-mono font-bold text-[var(--accent)] tabular-nums">{unit.cost * unit.count} pts</span>
      </div>
    </div>
  </div>
);

/* ===============================================================================
   R4 Card — Detached Float pattern
   Main card body is always the same height. Transport is a separate element
   below with gap-px separation, visually "floating" under the card.
   =============================================================================== */

const R4Card = ({ unit, transport }: { unit: typeof U1; transport: boolean }) => (
  <div class="flex flex-col border border-[rgba(51,51,51,0.15)] hover:border-[rgba(70,151,195,0.25)] transition-colors">
    {/* Main card body — same height whether or not transport exists */}
    <div class="flex items-stretch bg-[rgba(26,26,26,0.35)] flex-1">
      <LeftRail transport={false} />
      <div class="flex-1 min-w-0 flex flex-col">
        <UnitCore unit={unit} />
      </div>
      <RightRail transport={false} />
      <DeleteCol />
    </div>
    {/* Detached transport bar — only when present */}
    {transport && (
      <div class="flex items-stretch border-t border-[rgba(51,51,51,0.15)]">
        <div class="w-8 flex items-center justify-center border-r border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
          <button class="text-[12px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">{'\u2212'}</button>
        </div>
        <TransportBar />
        <div class="w-8 flex items-center justify-center border-l border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.5)] flex-shrink-0">
          <button class="text-[12px] font-black text-[var(--text-dim)] hover:text-[var(--accent)] transition-colors">+</button>
        </div>
        <div class="w-6 flex-shrink-0" />
      </div>
    )}
  </div>
);

/* ===============================================================================
   ROW COMPOSITIONS — pairs of "no transport" / "with transport" for comparison
   =============================================================================== */

/** R4-A: No transports — clean baseline, 4 slots (3 filled, 1 empty) */
const R4ARow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="ARMOR" slots={3} maxSlots={4} pts={540} maxPts={800} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U1} transport={false} />
      <R4Card unit={U2} transport={false} />
      <R4Card unit={U3} transport={false} />
      <EmptySlot />
    </div>
  </div>
);

/** R4-B: Same 3 units, now 2 have transports — shows the float appearing */
const R4BRow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="ARMOR" slots={3} maxSlots={4} pts={720} maxPts={800} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U1} transport={true} />
      <R4Card unit={U2} transport={false} />
      <R4Card unit={U3} transport={true} />
      <EmptySlot />
    </div>
  </div>
);

/** R4-C: All 3 filled cards have transports — full float row */
const R4CRow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="ARMOR" slots={3} maxSlots={4} pts={810} maxPts={800} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U1} transport={true} />
      <R4Card unit={U2} transport={true} />
      <R4Card unit={U3} transport={true} />
      <EmptySlot />
    </div>
  </div>
);

/** R4-D: Single unit with transport + 3 empty — sparse row */
const R4DRow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="RECON" slots={1} maxSlots={4} pts={180} maxPts={600} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U3} transport={true} />
      <EmptySlot />
      <EmptySlot />
      <EmptySlot />
    </div>
  </div>
);

/** R4-E: Fully loaded — all 4 slots filled, all with transports */
const R4ERow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="SUPPORT" slots={4} maxSlots={4} pts={960} maxPts={1000} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U1} transport={true} />
      <R4Card unit={U2} transport={true} />
      <R4Card unit={U3} transport={true} />
      <R4Card unit={U4} transport={true} />
    </div>
  </div>
);

/** R4-F: Fully loaded — all 4 slots filled, none with transports */
const R4FRow = () => (
  <div class="flex bg-gradient-to-b from-[var(--bg)] to-[rgba(26,26,26,0.7)] border border-[rgba(51,51,51,0.15)]">
    <Sidebar label="SUPPORT" slots={4} maxSlots={4} pts={720} maxPts={1000} />
    <div class="flex-1 grid grid-cols-4 items-start gap-px bg-[rgba(51,51,51,0.1)]">
      <R4Card unit={U1} transport={false} />
      <R4Card unit={U2} transport={false} />
      <R4Card unit={U3} transport={false} />
      <R4Card unit={U4} transport={false} />
    </div>
  </div>
);

/* ===============================================================================
   MAIN EXPORT
   =============================================================================== */

type RowEntry = { label: string; desc: string; Row: () => JSXOutput };

const PAIRS: { group: string; rows: RowEntry[] }[] = [
  {
    group: 'Partial fill — 3/4 slots',
    rows: [
      {
        label: 'R4-A — No transports',
        desc: '3 units, no transports, 1 empty slot. Clean baseline — all cards same height.',
        Row: R4ARow,
      },
      {
        label: 'R4-B — Mixed (2 transports)',
        desc: 'Same 3 units, 2 now have transports. Float bars appear below those cards. Non-transport card stays same height.',
        Row: R4BRow,
      },
      {
        label: 'R4-C — All transports',
        desc: 'All 3 filled cards have transports. Full float row — every card has a detached bar.',
        Row: R4CRow,
      },
    ],
  },
  {
    group: 'Edge cases',
    rows: [
      {
        label: 'R4-D — Single unit + transport',
        desc: '1 unit with transport, 3 empty slots. Sparse row — float bar sits under the single card.',
        Row: R4DRow,
      },
      {
        label: 'R4-E — Full row, all transports',
        desc: '4/4 slots filled, every card has transport. Maximum density.',
        Row: R4ERow,
      },
      {
        label: 'R4-F — Full row, no transports',
        desc: '4/4 slots filled, zero transports. Cleanest possible row.',
        Row: R4FRow,
      },
    ],
  },
];

export const CardVariations = component$(() => {
  return (
    <div class="mt-10 border-t border-[rgba(51,51,51,0.3)] pt-6">
      <p class="font-mono tracking-[0.3em] uppercase text-[var(--accent)] text-xs mb-2">
        // r4_detached_float_variants
      </p>
      <p class="text-[11px] font-mono text-[var(--text-dim)] mb-6">
        R4 "Detached Float" across different row compositions — compare no-transport vs with-transport side by side.
      </p>

      <div class="space-y-12 max-w-[1200px]">
        {PAIRS.map(({ group, rows }) => (
          <div key={group}>
            <p class="font-mono tracking-[0.2em] uppercase text-[var(--text-dim)] text-[10px] mb-4 border-b border-[rgba(51,51,51,0.15)] pb-2">
              {group}
            </p>
            <div class="space-y-8">
              {rows.map(({ label, desc, Row }) => (
                <div key={label}>
                  <div class="flex items-baseline gap-3 mb-1">
                    <span class="text-sm font-bold text-[var(--text)]">{label}</span>
                  </div>
                  <p class="text-[11px] font-mono text-[var(--text-dim)] mb-3">{desc}</p>
                  <Row />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});
