import React, { useState, useEffect } from 'react';
import { cardQuery, useStore } from '../store-instance';
import { getParameters } from '../services/SchedulerService';
import { formatDate, ratingLabel, ratingClass } from '../format';

export const StatsPage: React.FC = () => {
  useStore(s => s.version);
  const [stats, setStats] = useState({ total: 0, due: 0, new: 0, learning: 0, review: 0, totalReviews: 0, today: 0, avgDifficulty: '-' });
  const [streak, setStreak] = useState(0);
  const [daily, setDaily] = useState<{ label: string; count: number }[]>([]);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [ratings, setRatings] = useState<{ label: string; count: number }[]>([]);
  const [recent, setRecent] = useState<{ id: number; rating: number; due: Date; review: Date; question: string }[]>([]);

  useEffect(() => { cardQuery.getStats().then(setStats); cardQuery.getStreak().then(setStreak); cardQuery.getDailyCounts(7).then(setDaily); cardQuery.getCategoryCounts().then(setCategories); cardQuery.getRatingCounts().then(setRatings); cardQuery.getRecentLogs(20).then(setRecent); }, [useStore(s => s.version)]);

  const maxDaily = Math.max(1, ...daily.map(d => d.count));
  const totalCat = categories.reduce((s, d) => s + d.count, 0);
  const totalRat = ratings.reduce((s, d) => s + d.count, 0);
  const colors = ['var(--accent)', 'var(--good)', 'var(--easy)', 'var(--hard)', 'var(--again)', 'var(--text2)'];
  const p = getParameters();

  return (
    <>
      <div className="stats-bar">
        <div className="stat"><div className="num">{streak}</div><div className="lbl">Day Streak</div></div>
        <div className="stat"><div className="num">{stats.today}</div><div className="lbl">Today</div></div>
        <div className="stat"><div className="num">{stats.totalReviews}</div><div className="lbl">Reviews</div></div>
        <div className="stat"><div className="num">{stats.total}</div><div className="lbl">Cards</div></div>
        <div className="stat"><div className="num">{stats.avgDifficulty}</div><div className="lbl">Avg Difficulty</div></div>
      </div>

      <div className="stats-section-title">Daily Reviews</div>
      <div className="chart-bar-container">
        {daily.map((d, i) => (
          <div key={i} className="chart-bar-col">
            <div className="chart-bar-value">{d.count}</div>
            <div className="chart-bar-wrapper"><div className={`chart-bar ${i === 6 ? 'today' : ''}`} style={{ height: `${(d.count / maxDaily) * 100}%` }} /></div>
            <div className={`chart-bar-label ${i === 6 ? 'today' : ''}`}>{d.label}</div>
          </div>
        ))}
      </div>

      {categories.length > 0 && <>
        <div className="stats-section-title">By Category</div>
        <div className="distribution-list">
          {categories.map((d, i) => (
            <div key={d.name} className="distribution-row">
              <span className="dist-label">{d.name}</span>
              <div className="dist-bar-track"><div className="dist-bar" style={{ width: `${(d.count / totalCat) * 100}%`, background: colors[i % colors.length] }} /></div>
              <span className="dist-value">{d.count}</span>
            </div>
          ))}
        </div>
      </>}

      {totalRat > 0 && <>
        <div className="stats-section-title">Rating Distribution</div>
        <div className="distribution-list">
          {ratings.map(d => (
            <div key={d.label} className="distribution-row">
              <span className="dist-label" style={{ color: `var(--${d.label.toLowerCase()})` }}>{d.label}</span>
              <div className="dist-bar-track"><div className="dist-bar" style={{ width: `${(d.count / totalRat) * 100}%`, background: `var(--${d.label.toLowerCase()})` }} /></div>
              <span className="dist-value">{d.count}</span>
            </div>
          ))}
        </div>
      </>}

      <div className="stats-section-title">Recent Reviews</div>
      {recent.length === 0 ? <div className="empty-state" style={{ padding: 20 }}><div>No review history yet</div></div> : (
        <div className="card-list">
          {recent.map(l => (
            <div key={l.id} className="log-row">
              <span className={`log-rating ${ratingClass(l.rating)}`}>{ratingLabel(l.rating)}</span>
              <span style={{ color: 'var(--text2)', flex: 1, margin: '0 12px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.question}</span>
              <span style={{ color: 'var(--text3)', fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>→ {formatDate(l.due)}</span>
              <span style={{ color: 'var(--text3)', fontSize: '0.7rem' }}>{l.review.toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}

      <div className="stats-section-title">FSRS Parameters</div>
      <div className="card-list">
        <div className="distribution-row"><span className="dist-label">Retention</span><span className="dist-value">{(p.request_retention * 100).toFixed(0)}%</span></div>
        <div className="distribution-row"><span className="dist-label">Max Interval</span><span className="dist-value">{p.maximum_interval} days</span></div>
        <div className="distribution-row"><span className="dist-label">Fuzz</span><span className="dist-value">{p.enable_fuzz ? 'On' : 'Off'}</span></div>
        <div className="distribution-row"><span className="dist-label">Short Term</span><span className="dist-value">{p.enable_short_term ? 'On' : 'Off'}</span></div>
        <div className="distribution-row"><span className="dist-label">Learning Steps</span><span className="dist-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{p.learning_steps.join(', ')}</span></div>
        <div className="distribution-row"><span className="dist-label">Relearning Steps</span><span className="dist-value" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem' }}>{p.relearning_steps.join(', ')}</span></div>
      </div>
    </>
  );
};
