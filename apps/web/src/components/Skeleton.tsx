import React from 'react';

export default function Skeleton({ className = '', style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse bg-slate-200/70 dark:bg-slate-700/40 ${className}`}
      style={style}
    />
  );
}
