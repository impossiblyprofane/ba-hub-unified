import { component$ } from '@builder.io/qwik';
import { GameIcon } from '~/components/GameIcon';
import { SimpleTooltip } from '~/components/ui/SimpleTooltip';

export const StatBadge = component$<{ icon: string; label: string; value: number | string; compact?: boolean; accent?: boolean }>(
  ({ icon, label, value, compact, accent }) => (
    <SimpleTooltip text={label}>
      <div
        class={
          compact
            ? 'flex items-center gap-2 px-2 py-1 bg-[var(--bg)]/40'
            : 'flex flex-col items-center gap-1 p-2 bg-[var(--bg)]/40'
        }
      >
        <GameIcon src={icon} size={compact ? 16 : 22} variant={accent ? 'accent' : 'white'} alt={label} />
        <span class={`${compact ? 'text-xs' : 'text-sm text-center'} font-semibold ${accent ? 'text-[var(--accent)]' : 'text-[var(--text)]'}`}>
          {value}
        </span>
      </div>
    </SimpleTooltip>
  ),
);
