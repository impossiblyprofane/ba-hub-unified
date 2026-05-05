import { component$, useSignal, Slot } from '@builder.io/qwik';
import { getCursorTooltipStyle } from '~/lib/tooltipPosition';

/**
 * SimpleTooltip — self-contained cursor-following tooltip for plain text.
 * Wraps any trigger content via <Slot> and shows a styled tooltip on hover.
 *
 * Uses the project's tactical styling: dark blurred bg, mono font, accent border.
 *
 * Usage:
 *   <SimpleTooltip text="Full unit name here">
 *     <p class="truncate">Short na…</p>
 *   </SimpleTooltip>
 */
export const SimpleTooltip = component$<{ text: string; class?: string }>(
  ({ text, class: className }) => {
    const visible = useSignal(false);
    const style = useSignal({ top: '0px', left: '0px', transform: 'translateY(-100%)' });

    return (
      <div
        class={className ?? ''}
        onMouseEnter$={(e: MouseEvent) => {
          visible.value = true;
          style.value = getCursorTooltipStyle(e.clientX, e.clientY);
        }}
        onMouseMove$={(e: MouseEvent) => {
          style.value = getCursorTooltipStyle(e.clientX, e.clientY);
        }}
        onMouseLeave$={() => {
          visible.value = false;
        }}
      >
        <Slot />
        {visible.value && (
          <div
            class="fixed z-50 pointer-events-none border border-[rgba(70,151,195,0.3)] bg-[#0a0e14]/95 backdrop-blur-sm px-2.5 py-1.5 max-w-xs text-[10px] font-mono text-[var(--text)] whitespace-pre-wrap shadow-lg shadow-black/40"
            style={style.value}
          >
            {text}
          </div>
        )}
      </div>
    );
  },
);
