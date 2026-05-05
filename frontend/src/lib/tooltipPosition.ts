// Cursor-following tooltip position with viewport edge flipping + clamping.
// We don't measure the tooltip box (cheap path); we use a max-width budget
// (matches `max-w-xs` = 320px) to decide which side of the cursor to anchor
// to, then clamp so the tooltip stays inside the viewport.

const PADDING = 8;
const TOOLTIP_MAX_WIDTH = 320;
const TOOLTIP_HEIGHT_BUDGET = 200;
const CURSOR_OFFSET_X = 16;
const CURSOR_OFFSET_Y = 8;

export type TooltipStyle = {
  top: string;
  left: string;
  transform: string;
};

export function getCursorTooltipStyle(cursorX: number, cursorY: number): TooltipStyle {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768;

  // Horizontal: prefer right of cursor, flip to left if it would overflow
  const rightAnchor = cursorX + CURSOR_OFFSET_X;
  const fitsRight = rightAnchor + TOOLTIP_MAX_WIDTH + PADDING <= vw;
  let left: number;
  if (fitsRight) {
    left = rightAnchor;
  } else {
    // Anchor right edge to (cursorX - offset), so tooltip extends leftward
    left = cursorX - CURSOR_OFFSET_X - TOOLTIP_MAX_WIDTH;
  }
  // Clamp horizontally
  if (left < PADDING) left = PADDING;
  if (left + TOOLTIP_MAX_WIDTH > vw - PADDING) {
    left = Math.max(PADDING, vw - PADDING - TOOLTIP_MAX_WIDTH);
  }

  // Vertical: prefer above cursor (translateY(-100%)), flip below if not enough room
  const topAbove = cursorY - CURSOR_OFFSET_Y;
  const fitsAbove = topAbove - TOOLTIP_HEIGHT_BUDGET >= PADDING;
  let top: number;
  let transform: string;
  if (fitsAbove) {
    top = topAbove;
    transform = 'translateY(-100%)';
  } else {
    top = cursorY + CURSOR_OFFSET_Y;
    transform = 'translateY(0)';
    if (top + TOOLTIP_HEIGHT_BUDGET > vh - PADDING) {
      top = Math.max(PADDING, vh - PADDING - TOOLTIP_HEIGHT_BUDGET);
    }
  }

  return { top: `${top}px`, left: `${left}px`, transform };
}
