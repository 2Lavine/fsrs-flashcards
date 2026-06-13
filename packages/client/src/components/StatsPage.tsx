import React, { useState, useEffect } from 'react';
import { cardQuery, useStore } from '../store-instance';
import { getParameters } from '../services/SchedulerService';
import { formatDate, ratingLabel } from '../format';

function heatmapColor(count: number, max: number): string {
  if (count === 0) return 'bg-muted';
  const p = count / max;
  if (p <= 0.25) return 'bg-emerald-200/30';
  if (p <= 0.5) return 'bg-emerald-300/50';
  if (p <= 0.75) return 'bg-emerald-400/70';
  return 'bg-emerald-500';
}

function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export const StatsPage: React.FC = () => {
  useStore(s => s.version);
  const [stats, setStats] = useState({ total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' });
  const [streak, setStreak] = useState(0);
  const [daily, setDaily] = useState<{ label: string; date: string; count: number }[]>([]);
  const [decks, setDecks] = useState<{ name: string; cardCount: number; reviewCount: number }[]>([]);
  const [ratings, setRatings] = useState<{ label: string; count: number }[]>([]);
  const [recent, setRecent] = useState<{ id: number; rating: number; due: Date; review: Date; question: string }[]>([]);

  useEffect(() => {
    cardQuery.getStats().then(setStats).catch(() => {});
    cardQuery.getStreak().then(setStreak).catch(() => {});
    cardQuery.getDailyCounts(90).then(setDaily).catch(() => {});
    cardQuery.getDeckCounts().then(setDecks).catch(() => {});
    cardQuery.getRatingCounts().then(setRatings).catch(() => {});
    cardQuery.getRecentLogs().then(setRecent).catch(() => {});
  }, [useStore(s => s.version)]);

  const totalRat = ratings.reduce((s, d) => s + d.count, 0);
  const p = getParameters();

  // ── Heatmap grid ──────────────────────────
  const DAY_LABELS = ['Mon', '', 'Wed', '', 'Fri', '', ''];
  const heatmapMax = Math.max(1, ...daily.map(d => d.count));

  const weeks: { label: string; date: string; count: number }[][] = [];
  if (daily.length > 0) {
    const firstDay = new Date(daily[0].date + 'T00:00:00').getDay();
    const padStart = (firstDay + 6) % 7; // Monday=0

    const padded = [
      ...Array.from({ length: padStart }, () => ({ label: '', date: '', count: -1 })),
      ...daily,
    ];
    while (padded.length % 7 !== 0) padded.push({ label: '', date: '', count: -1 });

    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Stats Bar */}
      <div className="flex justify-between text-center">
        {[
          { num: streak, lbl: 'Day Streak' },
          { num: stats.today, lbl: 'Today' },
          { num: stats.totalReviews, lbl: 'Reviews' },
          { num: stats.total, lbl: 'Cards' },
          { num: stats.avgDifficulty, lbl: 'Avg Difficulty' },
        ].map(s => (
          <div key={s.lbl} className="flex flex-col items-center gap-0.5">
            <span className="text-xl font-bold tabular-nums">{s.num}</span>
            <span className="text-xs text-muted-foreground">{s.lbl}</span>
          </div>
        ))}
      </div>

      {/* Monthly Heatmap */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Quarterly Review Activity</h3>
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 mr-2">
            {DAY_LABELS.map((l, i) => (
              <div key={i} className="h-4 text-xs text-muted-foreground leading-4">{l}</div>
            ))}
          </div>
          {/* Weeks */}
          <div className="flex gap-0.5">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-0.5">
                {week.map((d, di) =>
                  d.count >= 0 ? (
                    <div
                      key={di}
                      className={`w-4 h-4 rounded-sm ${heatmapColor(d.count, heatmapMax)}`}
                      title={`${d.count} reviews on ${formatDateShort(d.date)}`}
                    />
                  ) : (
                    <div key={di} className="w-4 h-4" />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-muted-foreground">
          <span>Less</span>
          <div className="w-3 h-3 rounded-sm bg-muted" />
          <div className="w-3 h-3 rounded-sm bg-emerald-200/30" />
          <div className="w-3 h-3 rounded-sm bg-emerald-300/50" />
          <div className="w-3 h-3 rounded-sm bg-emerald-400/70" />
          <div className="w-3 h-3 rounded-sm bg-emerald-500" />
          <span>More</span>
        </div>
      </div>

      {/* By Deck */}
      {decks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">By Deck</h3>
          <div className="flex flex-col gap-2">
            {decks.map((d, i) => {
              const barColors = ['bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-violet-500', 'bg-rose-500', 'bg-zinc-500'];
              return (
                <div key={d.name} className="flex items-center gap-2">
                  <span className="text-sm w-28 shrink-0 truncate">{d.name || '(uncategorized)'}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${stats.total > 0 ? (d.cardCount / stats.total) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{d.cardCount} cards</span>
                  <span className="text-xs text-muted-foreground tabular-nums w-16 text-right">{d.reviewCount} reviews</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Rating Distribution */}
      {totalRat > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">Rating Distribution</h3>
          <div className="flex flex-col gap-2">
            {ratings.map(d => (
              <div key={d.label} className="flex items-center gap-2">
                <span className="text-sm w-16 shrink-0 font-medium">{d.label}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-muted-foreground/30" style={{ width: `${(d.count / totalRat) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Reviews */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Recent Reviews</h3>
        {recent.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">No review history yet</div>
        ) : (
          <div className="flex flex-col gap-1">
            {recent.map(l => (
              <div key={l.id} className="flex items-center gap-3 py-1.5 text-sm">
                <span className="text-xs font-medium">{ratingLabel(l.rating)}</span>
                <span className="flex-1 text-muted-foreground truncate">{l.question}</span>
                <span className="text-xs text-muted-foreground font-mono">→ {formatDate(l.due)}</span>
                <span className="text-xs text-muted-foreground">{new Date(l.review).toLocaleString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* FSRS Parameters */}
      <div>
        <h3 className="text-sm font-semibold mb-3">FSRS Parameters</h3>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-sm"><span>Retention</span><span>{(p.request_retention * 100).toFixed(0)}%</span></div>
          <div className="flex justify-between text-sm"><span>Max Interval</span><span>{p.maximum_interval} days</span></div>
          <div className="flex justify-between text-sm"><span>Fuzz</span><span>{p.enable_fuzz ? 'On' : 'Off'}</span></div>
          <div className="flex justify-between text-sm"><span>Short Term</span><span>{p.enable_short_term ? 'On' : 'Off'}</span></div>
          <div className="flex justify-between text-sm"><span>Learning Steps</span><span className="font-mono text-xs">{p.learning_steps.join(', ')}</span></div>
          <div className="flex justify-between text-sm"><span>Relearning Steps</span><span className="font-mono text-xs">{p.relearning_steps.join(', ')}</span></div>
        </div>
      </div>
    </div>
  );
};
