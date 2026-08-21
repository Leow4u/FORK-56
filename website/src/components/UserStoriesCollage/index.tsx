import React, { useMemo, useState } from 'react';
import stories from '@site/src/data/userStories.json';
import styles from './styles.module.css';

interface Story {
  id: string;
  source: string;
  author: string;
  url: string;
  date: string;
  category: string;
  headline: string;
  quote: string;
  size: 'sm' | 'md' | 'lg';
}

const allStories = stories as Story[];

// Category accents — Brandbook v1 monocrome (Oliva / Sálvia / Grafite). Flat only.
const CATEGORIES: Record<
  string,
  { label: string; solid: string; soft: string; strip: string }
> = {
  'dev-workflow': {
    label: 'Dev Workflow',
    solid: '#4D5943',
    soft: 'rgba(77, 89, 67, 0.12)',
    strip: '#4D5943',
  },
  'personal-assistant': {
    label: 'Personal Assistant',
    solid: '#3A452F',
    soft: 'rgba(58, 69, 47, 0.12)',
    strip: '#3A452F',
  },
  'content-creation': {
    label: 'Content Creation',
    solid: '#5F6C52',
    soft: 'rgba(95, 108, 82, 0.14)',
    strip: '#5F6C52',
  },
  'business-ops': {
    label: 'Business Ops',
    solid: '#4D5943',
    soft: 'rgba(77, 89, 67, 0.12)',
    strip: '#4D5943',
  },
  trading: {
    label: 'Trading & Markets',
    solid: '#6E6E68',
    soft: 'rgba(110, 110, 104, 0.14)',
    strip: '#6E6E68',
  },
  research: {
    label: 'Research',
    solid: '#3A452F',
    soft: 'rgba(58, 69, 47, 0.12)',
    strip: '#3A452F',
  },
  creative: {
    label: 'Creative',
    solid: '#71806E',
    soft: 'rgba(113, 128, 110, 0.14)',
    strip: '#71806E',
  },
  marketing: {
    label: 'Marketing',
    solid: '#5F6C52',
    soft: 'rgba(95, 108, 82, 0.14)',
    strip: '#5F6C52',
  },
  integrations: {
    label: 'Integrations',
    solid: '#4D5943',
    soft: 'rgba(77, 89, 67, 0.12)',
    strip: '#4D5943',
  },
  enterprise: {
    label: 'Enterprise',
    solid: '#6E6E68',
    soft: 'rgba(110, 110, 104, 0.14)',
    strip: '#6E6E68',
  },
  messaging: {
    label: 'Messaging',
    solid: '#3A452F',
    soft: 'rgba(58, 69, 47, 0.12)',
    strip: '#3A452F',
  },
  privacy: {
    label: 'Privacy & Self-Hosted',
    solid: '#4D5943',
    soft: 'rgba(77, 89, 67, 0.12)',
    strip: '#4D5943',
  },
  'cost-optimization': {
    label: 'Cost Optimization',
    solid: '#71806E',
    soft: 'rgba(113, 128, 110, 0.14)',
    strip: '#71806E',
  },
  meta: {
    label: 'Meta & Ecosystem',
    solid: '#5F6C52',
    soft: 'rgba(95, 108, 82, 0.14)',
    strip: '#5F6C52',
  },
  general: {
    label: 'General',
    solid: '#6E6E68',
    soft: 'rgba(110, 110, 104, 0.14)',
    strip: '#6E6E68',
  },
};

// Source → compact label shown in the badge row
const SOURCE_LABELS: Record<string, string> = {
  x: 'X · Twitter',
  hn: 'Hacker News',
  reddit: 'Reddit',
  github: 'GitHub',
  youtube: 'YouTube',
  blog: 'Blog',
  podcast: 'Podcast',
  linkedin: 'LinkedIn',
  gist: 'GitHub Gist',
  producthunt: 'Product Hunt',
  discord: 'Discord',
};

function sourceColor(_source: string): string {
  // Brandbook: no out-of-palette accents on public surfaces.
  return '#6E6E68';
}

export default function UserStoriesCollage(): JSX.Element {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activeSource, setActiveSource] = useState<string>('all');

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allStories) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, []);

  const sourceCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of allStories) counts[s.source] = (counts[s.source] ?? 0) + 1;
    return counts;
  }, []);

  const visible = useMemo(() => {
    return allStories.filter((s) => {
      if (activeCategory !== 'all' && s.category !== activeCategory) return false;
      if (activeSource !== 'all' && s.source !== activeSource) return false;
      return true;
    });
  }, [activeCategory, activeSource]);

  return (
    <div className={styles.wrap}>
      <div className={styles.hero}>
        <h1>User Stories &amp; Use Cases</h1>
        <p>
          What the Work4You community is actually building. Every tile
          below links to a real post, issue, video, or gist where someone
          describes how they use Work4You &mdash; scraped from X, GitHub, Reddit,
          Hacker News, YouTube, blogs, and podcasts.
        </p>
        <div className={styles.meta}>
          <span><strong>{allStories.length}</strong> stories</span>
          <span><strong>{Object.keys(categoryCounts).length}</strong> categories</span>
          <span><strong>{Object.keys(sourceCounts).length}</strong> sources</span>
        </div>
      </div>

      {/* Category filters */}
      <div className={styles.filters}>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeCategory === 'all' ? styles.filterActive : ''}`}
          onClick={() => setActiveCategory('all')}
        >
          All<span className={styles.filterCount}>{allStories.length}</span>
        </button>
        {Object.entries(CATEGORIES)
          .filter(([key]) => categoryCounts[key])
          .sort((a, b) => (categoryCounts[b[0]] ?? 0) - (categoryCounts[a[0]] ?? 0))
          .map(([key, meta]) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterBtn} ${activeCategory === key ? styles.filterActive : ''}`}
              onClick={() => setActiveCategory(key)}
              style={
                activeCategory === key
                  ? { background: meta.solid, borderColor: meta.solid, color: '#0f172a' }
                  : undefined
              }
            >
              {meta.label}
              <span className={styles.filterCount}>{categoryCounts[key]}</span>
            </button>
          ))}
      </div>

      {/* Source filters — smaller, secondary row */}
      <div className={styles.filters} style={{ marginTop: '-0.75rem' }}>
        <button
          type="button"
          className={`${styles.filterBtn} ${activeSource === 'all' ? styles.filterActive : ''}`}
          onClick={() => setActiveSource('all')}
          style={{ fontSize: '0.72rem' }}
        >
          All sources
        </button>
        {Object.entries(SOURCE_LABELS)
          .filter(([key]) => sourceCounts[key])
          .map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`${styles.filterBtn} ${activeSource === key ? styles.filterActive : ''}`}
              onClick={() => setActiveSource(key)}
              style={{
                fontSize: '0.72rem',
                ...(activeSource === key
                  ? { background: sourceColor(key), borderColor: sourceColor(key), color: '#fff' }
                  : {}),
              }}
            >
              {label}
              <span className={styles.filterCount}>{sourceCounts[key]}</span>
            </button>
          ))}
      </div>

      {/* Collage grid */}
      {visible.length === 0 ? (
        <div className={styles.empty}>No stories match that filter.</div>
      ) : (
        <div className={styles.grid}>
          {visible.map((s) => {
            const cat = CATEGORIES[s.category] ?? CATEGORIES.general;
            const sizeClass =
              s.size === 'lg' ? styles.tileLg : s.size === 'sm' ? styles.tileSm : styles.tileMd;
            const srcColor = sourceColor(s.source);
            return (
              <a
                key={s.id}
                className={`${styles.tile} ${sizeClass}`}
                href={s.url}
                target="_blank"
                rel="noopener noreferrer"
                style={
                  {
                    '--tile-accent': cat.strip,
                    '--tile-accent-solid': cat.solid,
                    '--tile-accent-soft': cat.soft,
                  } as React.CSSProperties
                }
              >
                <div className={styles.badgeRow}>
                  <span className={styles.sourceBadge}>
                    <span className={styles.sourceIcon} style={{ background: srcColor }} />
                    {SOURCE_LABELS[s.source] ?? s.source}
                  </span>
                  <span className={styles.catTag}>{cat.label}</span>
                </div>
                <h3 className={styles.headline}>{s.headline}</h3>
                <p className={styles.quote}>&ldquo;{s.quote}&rdquo;</p>
                <span className={styles.author}>
                  {s.author}
                  {s.date ? <> &middot; {s.date}</> : null}
                </span>
                <span className={styles.external} aria-hidden="true">↗</span>
              </a>
            );
          })}
        </div>
      )}

      <div className={styles.footer}>
        Built something with Work4You?{' '}
        <a
          href="https://github.com/Leow4u/FORK-56/edit/main/website/src/data/userStories.json"
          target="_blank"
          rel="noopener noreferrer"
        >
          Add your story to this page
        </a>{' '}
        by editing <code>userStories.json</code>, or post it in the{' '}
        <a href="https://work4you.ai" target="_blank" rel="noopener noreferrer">
          Work4You Discord
        </a>{' '}
        and we&apos;ll pick it up.
      </div>
    </div>
  );
}
