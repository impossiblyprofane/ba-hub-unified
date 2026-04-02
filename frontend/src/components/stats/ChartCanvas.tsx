import {
  component$,
  useSignal,
  useVisibleTask$,
  type NoSerialize,
  noSerialize,
} from '@builder.io/qwik';
import type { ChartConfiguration, Chart as ChartJS } from 'chart.js';

/**
 * Qwik wrapper around Chart.js.
 *
 * Chart.js is a client-only canvas library — it cannot run during SSR.
 * We defer all Chart.js work to `useVisibleTask$()` so the canvas is
 * only touched once visible in the browser.
 *
 * Props:
 *   config   — Serializable Chart.js config (no function callbacks)
 *   height   — Canvas container height in pixels
 *   crosshair — When true, enables index-based tooltip interaction
 *               (hover shows all datasets at that X position) with a
 *               vertical crosshair line. Ideal for multi-dataset line charts.
 */
export const ChartCanvas = component$<{
  config: ChartConfiguration;
  height?: number;
  class?: string;
  crosshair?: boolean;
}>(({ config, height = 300, crosshair }) => {
  const canvasRef = useSignal<HTMLCanvasElement>();
  const chartRef = useSignal<NoSerialize<ChartJS>>();

  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async ({ cleanup }) => {
    const canvas = canvasRef.value;
    if (!canvas) return;

    // Dynamic import — keeps Chart.js out of the SSR bundle
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    // Apply dark-theme defaults
    Chart.defaults.color = 'rgba(255,255,255,0.6)';
    Chart.defaults.borderColor = 'rgba(51,51,51,0.3)';
    Chart.defaults.font.family = 'ui-monospace, monospace';
    Chart.defaults.font.size = 11;

    // Deep-clone config so we can safely mutate options client-side
    const finalConfig = structuredClone(config) as ChartConfiguration;

    if (crosshair) {
      // Enable index interaction mode — hover shows all datasets at X position
      const opts = (finalConfig.options = finalConfig.options ?? {});
      opts.interaction = { mode: 'index', intersect: false };

      // Show vertical crosshair line on hover
      const plugins = (opts.plugins = opts.plugins ?? {});
      const tooltip = (plugins.tooltip = plugins.tooltip ?? {});
      tooltip.mode = 'index';
      tooltip.intersect = false;

      // Add crosshair line via chart plugin (runs client-side, no serialization issue)
      (finalConfig as any).plugins = [
        ...((finalConfig as any).plugins ?? []),
        {
          id: 'crosshairLine',
          afterDraw(chart: any) {
            if (chart.tooltip?._active?.length) {
              const x = chart.tooltip._active[0].element.x;
              const { top, bottom } = chart.chartArea;
              const ctx = chart.ctx;
              ctx.save();
              ctx.beginPath();
              ctx.moveTo(x, top);
              ctx.lineTo(x, bottom);
              ctx.lineWidth = 1;
              ctx.strokeStyle = 'rgba(70, 151, 195, 0.4)';
              ctx.stroke();
              ctx.restore();
            }
          },
        },
      ];
    }

    const instance = new Chart(canvas, finalConfig);
    chartRef.value = noSerialize(instance);

    cleanup(() => {
      instance.destroy();
    });
  });

  return (
    <div class="w-full" style={{ height: `${height}px` }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
});
