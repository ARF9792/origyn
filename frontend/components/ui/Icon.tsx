/**
 * Origyn — SVG icon system.
 * All paths ported from the Astra Pass 1 reference (ui/icons.js).
 * Add new icons here. Import and use the Icon component everywhere else.
 */

import React from 'react';

const PATHS: Record<string, string> = {
  overview:    '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  sources:     '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/>',
  chat:        '<path d="M4 4h16v13H9l-5 4z"/>',
  claims:      '<path d="m5 7 2 2 4-4M13 7h7M5 15l2 2 4-4M13 15h7"/>',
  graph:       '<circle cx="5" cy="12" r="3"/><circle cx="19" cy="5" r="3"/><circle cx="19" cy="19" r="3"/><path d="m8 11 8-5M8 13l8 5"/>',
  alerts:      '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M9 20h6"/>',
  plus:        '<path d="M12 5v14M5 12h14"/>',
  arrow:       '<path d="M5 12h14m-5-5 5 5-5 5"/>',
  external:    '<path d="M14 3h7v7m0-7-12 12M10 4H4v16h16v-6"/>',
  check:       '<path d="m5 12 4 4L19 6"/>',
  circlecheck: '<circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/>',
  warning:     '<path d="m12 3 10 18H2zM12 9v5m0 3v.1"/>',
  retracted:   '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  unknown:     '<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 5m0 3v.1"/>',
  clock:       '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  search:      '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  filter:      '<path d="M4 6h16M7 12h10M10 18h4"/>',
  chevron:     '<path d="m9 5 7 7-7 7"/>',
  down:        '<path d="m6 9 6 6 6-6"/>',
  upload:      '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  close:       '<path d="m6 6 12 12M6 18 18 6"/>',
  menu:        '<path d="M4 6h16M4 12h16M4 18h16"/>',
  back:        '<path d="M19 12H5m5-5-5 5 5 5"/>',
  refresh:     '<path d="M20 8a8 8 0 1 0 0 8M20 3v6h-6"/>',
  link:        '<path d="m9 15 6-6M8 17l-1 1a4 4 0 0 1-6-6l5-5a4 4 0 0 1 6 0M16 7l1-1a4 4 0 0 1 6 6l-5 5a4 4 0 0 1-6 0"/>',
  logout:      '<path d="M10 17l5-5-5-5M15 12H3"/><path d="M14 4h6v16h-6"/>',
  book:        '<path d="M12 5v15M3 3c5 0 9 2 9 2s4-2 9-2v15c-5 0-9 2-9 2s-4-2-9-2z"/>',
  info:        '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/>',
  retracted_icon: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
  upload_icon: '<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>',
  trash:       '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"/>',
  download:    '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4m4-5 5 5 5-5m-5 5V3"/>',
};

interface IconProps {
  name: string;
  className?: string;
  'aria-hidden'?: boolean;
}

export function Icon({ name, className = '', 'aria-hidden': ariaHidden = true }: IconProps) {
  const d = PATHS[name] ?? PATHS.sources;
  return (
    <svg
      className={`icon ${className}`.trim()}
      viewBox="0 0 24 24"
      aria-hidden={ariaHidden}
      dangerouslySetInnerHTML={{ __html: d }}
    />
  );
}
