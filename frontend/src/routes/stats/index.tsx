import { component$ } from '@builder.io/qwik';
import type { DocumentHead } from '@builder.io/qwik-city';

export default component$(() => {
  return (
    <div class="max-w-6xl">
      <p class="text-[#3b8eed] text-xs font-mono tracking-[0.25em] uppercase mb-3">Player Rankings</p>
      <h1 class="text-3xl font-bold mb-3 text-[#c8d1db]">Statistics</h1>
      <p class="text-[#6b7a8d] text-sm mb-8">View player leaderboards and performance analytics.</p>

      {/* Stats Overview */}
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3 mb-8">
        <div class="card">
          <p class="text-[#6b7a8d] text-[10px] uppercase tracking-wider mb-1">Active Players</p>
          <p class="text-2xl font-bold text-[#c8d1db]">2,547</p>
        </div>
        <div class="card">
          <p class="text-[#6b7a8d] text-[10px] uppercase tracking-wider mb-1">Matches Today</p>
          <p class="text-2xl font-bold text-[#c8d1db]">486</p>
        </div>
        <div class="card">
          <p class="text-[#6b7a8d] text-[10px] uppercase tracking-wider mb-1">Avg Rating</p>
          <p class="text-2xl font-bold text-[#c8d1db]">1,240</p>
        </div>
      </div>

      {/* Leaderboard */}
      <div class="card">
        <h2 class="text-sm font-bold mb-4 text-[#c8d1db]">Top Players</h2>
        <table class="w-full text-xs">
          <thead class="border-b border-[#1e2a36]">
            <tr class="text-[#6b7a8d] uppercase tracking-wider text-[10px]">
              <th class="text-left py-2.5 px-3">Rank</th>
              <th class="text-left py-2.5 px-3">Player</th>
              <th class="text-left py-2.5 px-3">Rating</th>
              <th class="text-left py-2.5 px-3">Wins</th>
              <th class="text-left py-2.5 px-3">Losses</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 10 }).map((_, i) => (
              <tr key={i} class="border-b border-[#1e2a36] hover:bg-[#1a222c] transition-colors">
                <td class="py-2.5 px-3 text-[#6b7a8d]">{i + 1}</td>
                <td class="py-2.5 px-3 font-medium text-[#c8d1db]">Player Name {i + 1}</td>
                <td class="py-2.5 px-3 text-[#3b8eed]">{2000 - i * 50}</td>
                <td class="py-2.5 px-3 text-[#3fb950]">{150 - i * 5}</td>
                <td class="py-2.5 px-3 text-[#6b7a8d]">{20 + i * 2}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
});

export const head: DocumentHead = {
  title: 'Statistics - BA Hub',
  meta: [
    {
      name: 'description',
      content: 'View player leaderboards and performance analytics.',
    },
  ],
};
