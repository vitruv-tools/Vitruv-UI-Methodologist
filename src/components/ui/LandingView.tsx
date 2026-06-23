import React, { useState } from 'react';
import { SidebarView } from '../layout/AppSidebar';

interface LandingViewProps {
  userName?: string;
  onNavigate: (view: SidebarView) => void;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const ArrowRightIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

const SyncIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

const ViewIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

// ── FeaturePill ───────────────────────────────────────────────────────────────

const FeaturePill: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: 7,
    padding: '7px 14px',
    background: '#ffffff',
    border: '1px solid rgba(0,0,0,0.10)',
    borderRadius: 20,
    fontSize: 13, fontWeight: 500, color: '#1f2937',
  }}>
    <span style={{ color: '#049484', display: 'flex' }}>{icon}</span>
    {label}
  </div>
);

// ── ProjectCard ───────────────────────────────────────────────────────────────

interface ProjectCardProps {
  title: string;
  subtitle: string;
  items: Array<{ name: string; meta: string }>;
  cta: string;
  footerLink: string;
  onNavigate: () => void;
  accent: string;
}

const ProjectCard: React.FC<ProjectCardProps> = ({ title, subtitle, items, cta, footerLink, onNavigate, accent }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <button
      onClick={onNavigate}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'rgba(255,255,255,0.88)',
        border: `1.5px solid ${hovered ? accent : 'rgba(0,0,0,0.07)'}`,
        borderRadius: 14,
        padding: '22px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        transition: 'border-color 0.18s, box-shadow 0.18s, transform 0.18s',
        boxShadow: hovered ? `0 6px 28px rgba(0,0,0,0.09)` : '0 2px 8px rgba(0,0,0,0.05)',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
      }}
    >
      {/* Header */}
      <div>
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>{subtitle}</div>
      </div>

      {/* Preview items */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {items.map((item) => (
          <div
            key={item.name}
            style={{
              flex: '1 1 140px',
              background: '#f8f9fb',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 10,
              padding: '12px 14px',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            {/* Placeholder diagram lines */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {[60, 90, 50, 70].map((w) => (
                <div key={w} style={{
                  height: 5, borderRadius: 3,
                  background: w === 60 ? `${accent}55` : 'rgba(0,0,0,0.08)',
                  width: `${w}%`,
                }} />
              ))}
            </div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{item.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>{item.meta}</div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 4,
              fontSize: 12, fontWeight: 600, color: accent,
              marginTop: 2, pointerEvents: 'none',
            }}>
              {cta} <ArrowRightIcon />
            </div>
          </div>
        ))}
      </div>

      {/* Footer link */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          fontSize: 13, fontWeight: 600, color: accent,
          pointerEvents: 'none',
        }}
      >
        {footerLink} <ArrowRightIcon />
      </div>
    </button>
  );
};

// ── LandingView ───────────────────────────────────────────────────────────────

export const LandingView: React.FC<LandingViewProps> = ({ userName, onNavigate }) => {
  const firstName = userName && userName !== 'User' ? userName.split(' ')[0] : null;

  return (
    <div style={{
      flex: 1,
      overflowY: 'auto',
      padding: '44px 48px 48px',
    }}>
      {/*
        Two-column grid:
          left  = hero text + Projects card
          right = vitruvius image + Model Library card   (same column width → flush)
      */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 420px',
        gridTemplateRows: 'auto auto',
        columnGap: 24,
        rowGap: 20,
        maxWidth: 1200,
      }}>

        {/* ── LEFT / TOP: hero text ─────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* Badge */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(4,148,132,0.10)',
            border: '1px solid rgba(4,148,132,0.25)',
            borderRadius: 20, padding: '5px 14px',
            fontSize: 11, fontWeight: 700, color: '#049484',
            letterSpacing: '0.06em', width: 'fit-content',
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#049484',
              boxShadow: '0 0 0 3px rgba(4,148,132,0.25)',
              display: 'inline-block',
            }} aria-hidden="true" />
            <span>VITRUVIUS MODELER · KIT DSiS</span>
          </div>

          {/* Title */}
          <h1 style={{
            margin: 0,
            fontSize: 'clamp(24px, 2.6vw, 36px)',
            fontWeight: 800,
            color: '#0f172a',
            lineHeight: 1.18,
            letterSpacing: '-0.02em',
          }}>
            {firstName ? `Welcome back, ${firstName}:` : 'Welcome to Vitruvius:'}{' '}
            <span style={{ color: '#0f172a' }}>View-based Software Development</span>
          </h1>

          {/* Description */}
          <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.75 }}>
            Vitruvius is a framework for{' '}
            <strong style={{ color: '#111827', fontWeight: 600 }}>view-based software development</strong>.
            It maintains a Virtual Single Underlying Model (V-SUM) — a set of heterogeneous models kept automatically
            consistent through defined consistency rules. Models are never edited directly; all changes flow through
            typed <em>views</em> that project the relevant parts of the V-SUM.
          </p>

          <p style={{ margin: 0, fontSize: 14, color: '#4b5563', lineHeight: 1.75 }}>
            The name stands for <strong style={{ color: '#111827' }}>VI</strong>ew-cen<strong style={{ color: '#111827' }}>TR</strong>ic engineering Us<strong style={{ color: '#111827' }}>I</strong>ng a <strong style={{ color: '#111827' }}>V</strong>irtual <strong style={{ color: '#111827' }}>U</strong>nderlying <strong style={{ color: '#111827' }}>S</strong>ingle model. Developed at the <strong style={{ color: '#111827' }}>Dependability of Software-intensive Systems (DSiS)</strong> at the <strong style={{ color: '#111827' }}>Karlsruhe Institute of Technology (KIT)</strong>. V-SUM extends the classical Single Underlying Model concept by tolerating redundancy across models and enforcing consistency through explicit propagation rules rather than a single shared representation.
          </p>

          {/* Feature pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
            <FeaturePill icon={<SyncIcon />} label="Automatic model synchronisation" />
            <FeaturePill icon={<ViewIcon />} label="View-centric editing" />
          </div>
        </div>

        {/* ── RIGHT / TOP: vitruvius1 image ────────────────────────────── */}
        <div style={{
          background: 'rgba(255,255,255,0.88)',
          border: '1.5px solid rgba(0,0,0,0.07)',
          borderRadius: 14,
          overflow: 'hidden',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <img
            src="/assets/vitruvius1.png"
            alt="Vitruvius"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              objectPosition: 'center',
              display: 'block',
            }}
          />
        </div>

        {/* ── LEFT / BOTTOM: GET STARTED label + Projects card ─────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: '#9ca3af',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            Get Started
          </div>
          <ProjectCard
            title="Projects"
            subtitle="Your V-SUM workspaces"
            items={[
              { name: 'V-SUM', meta: 'Last edited 13.08.2023' },
              { name: 'V-SUM projektarno2', meta: 'Last edited 13.08.2023' },
            ]}
            cta="Open"
            footerLink="Create new project..."
            onNavigate={() => onNavigate('projects')}
            accent="#049484"
          />
        </div>

        {/* ── RIGHT / BOTTOM: Model Library card (same column = flush) ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* empty label spacer so cards align with the left column */}
          <div style={{ fontSize: 11, fontWeight: 700, color: 'transparent', letterSpacing: '0.08em' }}>
            &nbsp;
          </div>
          <ProjectCard
            title="Model Library"
            subtitle="Metamodels &amp; reusable fragments"
            items={[
              { name: 'Tiny schema metamodel', meta: 'Last edited 12 min' },
              { name: 'Tiny schema metamodel', meta: 'Last edited 12 min' },
            ]}
            cta="Browse"
            footerLink="Browse all models"
            onNavigate={() => onNavigate('library')}
            accent="#6366f1"
          />
        </div>

      </div>

      {/* ── About strip ───────────────────────────────────────────────────── */}
      <div style={{
        marginTop: 28,
        background: '#ffffff',
        border: '1px solid rgba(0,0,0,0.08)',
        borderRadius: 14,
        padding: '22px 28px',
        maxWidth: 1200,
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: '#6b7280',
          letterSpacing: '0.08em', marginBottom: 10, textTransform: 'uppercase',
        }}>
          About the Framework
        </div>
        <p style={{ margin: 0, fontSize: 14, color: '#1e293b', lineHeight: 1.8 }}>
          Vitruvius is developed at the{' '}
          <strong style={{ color: '#0f172a' }}>Dependability of Software-intensive Systems (DSiS)</strong> group
          at KIT. It is built on the idea of a Virtual Single Underlying Model (V-SUM) which behaves like a
          consistent SUM without being free of redundancies — instead, explicit consistency rules propagate changes
          between heterogeneous models automatically whenever a view is modified.
        </p>
      </div>
    </div>
  );
};
