import { component$, useSignal, Slot } from '@builder.io/qwik';
import { getCursorTooltipStyle } from '~/lib/tooltipPosition';

/**
 * Rich tooltip wrapper — hover to reveal structured tooltip content.
 * Content is placed via <Slot> for the trigger area and
 * <Slot name="tooltip"> for the tooltip body (supports full JSX).
 *
 * Usage:
 * <RichTooltip>
 *   <div>Trigger element</div>
 *   <div q:slot="tooltip">
 *     <div class="font-bold text-[var(--accent)]">Title</div>
 *     <div class="text-xs">Description</div>
 *   </div>
 * </RichTooltip>
 */
export const RichTooltip = component$<{ class?: string }>(({ class: className }) => {
  const visible = useSignal(false);
  const style = useSignal({ top: '0px', left: '0px', transform: 'translateY(-100%)' });

  return (
    <div
      class={`relative ${className ?? ''}`}
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
          class="fixed z-50 pointer-events-none border border-[rgba(70,151,195,0.3)] bg-[#0a0e14]/95 backdrop-blur-sm px-3 py-2 max-w-xs text-xs font-mono text-[var(--text)] shadow-lg shadow-black/40"
          style={style.value}
        >
          <Slot name="tooltip" />
        </div>
      )}
    </div>
  );
});

/**
 * Pre-built tooltip stat row: <span class="accent">Label:</span> Value
 */
export const TipRow = component$<{ label: string; value: string | number }>(({ label, value }) => (
  <div>
    <span class="text-[var(--accent)]">{label}:</span> {value}
  </div>
));
