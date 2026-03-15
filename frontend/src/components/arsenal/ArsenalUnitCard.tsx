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
      class="relative border border-[rgba(51,51,51,0.15)] overflow-hidden"
      style={{ willChange: 'transform' }}
    >
      <div
        class="relative aspect-[4/3] bg-[#0b0f14]/25"
        style={{
          backgroundImage: `url(${props.unitIconUrl})`,
          backgroundSize: 'contain',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'center',
        }}
      >
        <div class="absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent" />
        <div class="absolute top-1 left-1 px-1 py-0.5 text-[8px] font-mono uppercase tracking-widest bg-black/70 border border-[rgba(51,51,51,0.3)]">
          {props.categoryCode}
        </div>
        <div class="absolute top-1 right-1 px-1 py-0.5 text-[8px] font-mono uppercase tracking-widest bg-black/70 border border-[rgba(51,51,51,0.3)]">
          {props.cost}
        </div>
        {(props.countryFlagUrl || props.specIconUrl) && (
          <div class="absolute bottom-1 right-1 flex items-center gap-1">
            {props.specIconUrl && (
              <div
                class="w-3.5 h-3.5 border border-[rgba(51,51,51,0.3)] bg-black/70"
                onMouseEnter$={(event) => props.onTooltipShow$(event, props.specName || 'Specialization')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={props.specIconUrl}
                  width={14}
                  height={14}
                  class="w-full h-full object-cover"
                  alt={props.specName || 'Specialization'}
                />
              </div>
            )}
            {props.countryFlagUrl && (
              <div
                class="w-4 h-3 border border-[rgba(51,51,51,0.3)] bg-black/70"
                onMouseEnter$={(event) => props.onTooltipShow$(event, props.countryName || 'Country')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={props.countryFlagUrl}
                  width={16}
                  height={12}
                  class="w-full h-full object-cover"
                  alt={props.countryName || 'Country'}
                />
              </div>
            )}
          </div>
        )}
        {(props.seats || props.lift) && (
          <div class="absolute bottom-1 left-1 flex flex-col gap-1 text-[8px] font-mono text-[var(--text)] tracking-widest">
            {typeof props.seats === 'number' && props.seats > 0 && (
              <span
                class="flex items-center gap-0.5 bg-black/70 px-1 py-0.5 border border-[rgba(51,51,51,0.3)] font-semibold"
                onMouseEnter$={(event) => props.onTooltipShow$(event, 'Seats')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={UtilIconPaths.STAT_SEATS}
                  width={10}
                  height={10}
                  class="w-2.5 h-2.5"
                  alt="Seats"
                />
                {props.seats}
              </span>
            )}
            {typeof props.lift === 'number' && props.lift > 0 && (
              <span
                class="flex items-center gap-0.5 bg-black/70 px-1 py-0.5 border border-[rgba(51,51,51,0.3)] font-semibold"
                onMouseEnter$={(event) => props.onTooltipShow$(event, 'Lift')}
                onMouseMove$={props.onTooltipMove$}
                onMouseLeave$={props.onTooltipHide$}
              >
                <img
                  src={UtilIconPaths.STAT_HEAVYLIFT}
                  width={10}
                  height={10}
                  class="w-2.5 h-2.5"
                  alt="Lift"
                />
                {props.lift}
              </span>
            )}
          </div>
        )}
      </div>
      <div class="border-t border-[rgba(51,51,51,0.15)] bg-[rgba(26,26,26,0.4)] px-1 py-1 text-center">
        <p class="text-[9px] font-semibold uppercase tracking-wider text-[var(--text)] leading-tight truncate">
          {props.unitName}
        </p>
      </div>
    </Link>
  );
});
