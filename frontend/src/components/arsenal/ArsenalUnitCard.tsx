import { component$, type PropFunction } from '@builder.io/qwik';
import { Link } from '@builder.io/qwik-city';
import { UtilIconPaths } from '~/lib/iconPaths';

export type ArsenalUnitCardProps = {
  href: string;
  dataCardId: number;
  unitName: string;
  unitIconUrl: string;
  categoryCode: string;
  cost: number;
  countryName?: string;
  countryFlagUrl?: string;
  specName?: string;
  specIconUrl?: string;
  seats?: number;
  lift?: number;
  onTooltipShow$: PropFunction<(event: MouseEvent, text: string) => void>;
  onTooltipMove$: PropFunction<(event: MouseEvent) => void>;
  onTooltipHide$: PropFunction<() => void>;
};

export const ArsenalUnitCard = component$((props: ArsenalUnitCardProps) => {
  return (
    <Link
      href={props.href}
      data-native-link
      data-card-id={props.dataCardId}
      class="relative border border-[var(--border)] bg-[var(--bg-raised)] overflow-hidden"
      style={{ willChange: 'transform' }}
    >
      <div
        class="relative aspect-[4/3] bg-[#0b0f14]"
        style={{
          backgroundImage: `url(${props.unitIconUrl})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div class="absolute top-2 left-2 px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-black/70 border border-[var(--border)]">
          {props.categoryCode}
        </div>
        <div class="absolute top-2 right-2 px-2 py-1 text-[10px] font-mono uppercase tracking-widest bg-black/70 border border-[var(--border)]">
          {props.cost}
        </div>
        {(props.countryFlagUrl || props.specIconUrl) && (
          <div class="absolute bottom-2 right-2 flex items-center gap-2">
            {props.specIconUrl && (
              <div
                class="w-5 h-5 border border-[var(--border)] bg-black/70"
                onMouseEnter$={(event) => props.onTooltipShow$(event, props.specName || 'Specialization')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={props.specIconUrl}
                  width={20}
                  height={20}
                  class="w-full h-full object-cover"
                  alt={props.specName || 'Specialization'}
                />
              </div>
            )}
            {props.countryFlagUrl && (
              <div
                class="w-6 h-4 border border-[var(--border)] bg-black/70"
                onMouseEnter$={(event) => props.onTooltipShow$(event, props.countryName || 'Country')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={props.countryFlagUrl}
                  width={24}
                  height={16}
                  class="w-full h-full object-cover"
                  alt={props.countryName || 'Country'}
                />
              </div>
            )}
          </div>
        )}
        {(props.seats || props.lift) && (
          <div class="absolute bottom-2 left-2 flex flex-col gap-2 text-[10px] font-mono text-[var(--text)] tracking-widest">
            {typeof props.seats === 'number' && props.seats > 0 && (
              <span
                class="flex items-center gap-1 bg-black/70 px-2 py-1 border border-[var(--border)] font-semibold"
                onMouseEnter$={(event) => props.onTooltipShow$(event, 'Seats')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={UtilIconPaths.STAT_SEATS}
                  width={12}
                  height={12}
                  class="w-3 h-3"
                  alt="Seats"
                />
                {props.seats}
              </span>
            )}
            {typeof props.lift === 'number' && props.lift > 0 && (
              <span
                class="flex items-center gap-1 bg-black/70 px-2 py-1 border border-[var(--border)] font-semibold"
                onMouseEnter$={(event) => props.onTooltipShow$(event, 'Lift')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={UtilIconPaths.STAT_HEAVYLIFT}
                  width={12}
                  height={12}
                  class="w-3 h-3"
                  alt="Lift"
                />
                {props.lift}
              </span>
            )}
          </div>
        )}
      </div>
      <div class="border-t border-[var(--border)] bg-[var(--bg-raised)] px-2 py-2 text-center">
        <p class="text-[11px] font-semibold uppercase tracking-wider text-[var(--text)] leading-tight truncate">
          {props.unitName}
        </p>
      </div>
    </Link>
  );
});
