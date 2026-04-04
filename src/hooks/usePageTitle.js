import { useEffect } from 'react';

export function usePageTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} | Objekta` : 'Objekta | 3D Design Studio';
  }, [title]);
}
