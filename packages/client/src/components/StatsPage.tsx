import React, { useState, useEffect } from 'react';
import { cardQuery, useStore } from '../store-instance';
import { getParameters } from '../services/SchedulerService';
import { formatDate, ratingLabel } from '../format';

export const StatsPage: React.FC = () => {
  useStore(s => s.version);
  const [stats, setStats] = useState({ total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' });
  const [streak, setStreak] = useState(0);
  const [daily, setDaily] = useState<{ label: string; count: number }[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [ratings, setRatings] = useState<{ label: string; count: number }[]>([]);
  const [recent, setRecent] = useState<{ id: number; rating: number; due: Date; review: Date; question: string }[]>([]);

  useEffect(() => {
    cardQuery.getStats().then(setStats).catch(() => {});
    cardQuery.getStreak().then(setStreak).catch(() => {});
    cardQuery.getDailyCounts().then(setDaily).catch(() => {});
    cardQuery.getCategoryCounts().then(setCategories).catch(() => {});
    cardQuery.getRatingCounts().then(setRatings).catch(() => {});
    cardQuery.getRecentLogs().then(setRecent).catch(() => {});
  }, [useStore(s => s.version)]);

  const maxDaily = Math.max(1, ...daily.map(d => d.count));
  const totalCat = categories.reduce((s, d) => s + d.count, 0);
  const totalRat = ratings.reduce((s, d) => s + d.count, 0);
  const barColors = ['bg-amber-500', 'bg-emerald-500', 'bg-sky-500', 'bg-amber-600', 'bg-red-500', 'bg-zinc-500'];
  const p = getParameters();

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

      {/* Daily Reviews Chart */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Daily Reviews</h3>
        <div className="flex items-end gap-1 h-32">
          {daily.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              <span className="text-xs tabular-nums">{d.count}</span>
              <div
                className={`w-full rounded-t ${i === 6 ? 'bg-primary' : 'bg-muted-foreground/20'}`}
                style={{ height: `${(d.count / maxDaily) * 100}%`, minHeight: d.count > 0 ? 4 : 0 }}
              />
              <span className={`text-xs ${i === 6 ? 'text-primary font-medium' : 'text-muted-foreground'}`}>{d.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By Category */}
      {categories.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-3">By Category</h3>
          <div className="flex flex-col gap-2">
            {categories.map((d, i) => (
              <div key={d.name} className="flex items-center gap-2">
                <span className="text-sm w-24 shrink-0 truncate">{d.name}</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${barColors[i % barColors.length]}`} style={{ width: `${(d.count / totalCat) * 100}%` }} />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-8 text-right">{d.count}</span>
              </div>
            ))}
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
