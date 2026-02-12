import { component$, useSignal, Slot } from '@builder.io/qwik';

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
  const pos = useSignal({ x: 0, y: 0 });

  return (
    <div
      class={`relative ${className ?? ''}`}
      onMouseEnter$={(e: MouseEvent) => {
        visible.value = true;
        pos.value = { x: e.clientX, y: e.clientY };
      }}
      onMouseMove$={(e: MouseEvent) => {
        pos.value = { x: e.clientX, y: e.clientY };
      }}
      onMouseLeave$={() => {
        visible.value = false;
      }}
    >
      <Slot />
      {visible.value && (
        <div
          class="fixed z-50 pointer-events-none border border-[var(--accent)]/30 bg-[#0a0e14]/95 backdrop-blur-sm px-3 py-2 max-w-xs text-xs font-mono text-[var(--text)]"
          style={{
            top: `${pos.value.y - 8}px`,
            left: `${pos.value.x + 16}px`,
            transform: 'translateY(-100%)',
          }}
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
