// src/components/Thumbnail.jsx
// Simple thumbnail with error fallback.
// Dev: Place a placeholder image at /assets/thumbnail-placeholder.png if desired.
import React from 'react';

export default function Thumbnail({ src, alt, style }) {
  const [failed, setFailed] = React.useState(false);
  const placeholder = '/assets/thumbnail-placeholder.svg';
  const finalSrc = failed || !src ? placeholder : src;
  return (
    <img
      src={finalSrc}
      data-src={src || ''}
      alt={alt || 'thumbnail'}
      onError={() => { if (!failed) { console.debug('[OBJEKTA] Thumbnail failed', src); setFailed(true); } }}
      style={style || { width: '100%', height: '100%', objectFit: 'cover' }}
    />
  );
}