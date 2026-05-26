import { motion } from 'framer-motion';

const workspacePhotos = [
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1524758631624-e2822e304c36?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1497366412874-3415097a27e7?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1517502884422-41eaead166d4?auto=format&fit=crop&w=1400&q=80',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=80&sat=-10',
  'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1400&q=80'
];

export function getWorkspacePhoto(seed: string | number = 0) {
  const value = typeof seed === 'number' ? seed : Array.from(seed).reduce((total, character) => total + character.charCodeAt(0), 0);
  return workspacePhotos[Math.abs(value) % workspacePhotos.length];
}

type WorkspacePhotoProps = {
  title: string;
  subtitle?: string;
  tag?: string;
  src?: string;
  seed?: string | number;
  className?: string;
  imageClassName?: string;
  compact?: boolean;
};

export default function WorkspacePhoto({ title, subtitle, tag, src, seed = title, className = '', imageClassName = '', compact = false }: WorkspacePhotoProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.45 }}
      className={`relative overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_22px_70px_rgba(15,23,42,0.08)] ${className}`}
    >
      <img
        src={src ?? getWorkspacePhoto(seed)}
        alt={title}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover transition-transform duration-700 hover:scale-[1.04] ${imageClassName}`}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,15,28,0.02)_0%,rgba(8,15,28,0.26)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 p-4 text-white">
        {tag ? <div className="mb-2 inline-flex rounded-full bg-white/20 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] backdrop-blur-md">{tag}</div> : null}
        <div className={`font-semibold ${compact ? 'text-base' : 'text-xl'}`}>{title}</div>
        {subtitle ? <div className={`mt-1 text-white/82 ${compact ? 'text-xs' : 'text-sm'}`}>{subtitle}</div> : null}
      </div>
    </motion.div>
  );
}
