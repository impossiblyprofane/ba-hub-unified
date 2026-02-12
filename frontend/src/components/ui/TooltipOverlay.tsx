import { component$ } from '@builder.io/qwik';

export type TooltipOverlayProps = {
  text: string;
  x: number;
  y: number;
  visible: boolean;
};

export const TooltipOverlay = component$((props: TooltipOverlayProps) => {
  if (!props.visible) return null;
  return (
    <div
      class="fixed z-50 pointer-events-none border border-[var(--border)] bg-black/90 px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[var(--text)]"
      style={{ top: `${props.y}px`, left: `${props.x}px` }}
    >
      {props.text}
    </div>
  );
});
