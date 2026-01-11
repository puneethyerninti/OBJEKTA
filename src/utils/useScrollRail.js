import { useEffect, useRef } from 'react';

// Simple hook: adds an overlay rail + thumb to a scrollable element and
// keeps the thumb position/size in sync. Thumb is draggable.
export default function useScrollRail() {
  const rootRef = useRef(null);

  useEffect(() => {
    const container = rootRef.current;
    if (!container) return;

    // find the actual scrollable element (could be a descendant)
    function findScrollable(start) {
      if (!start) return null;
      if (start.scrollHeight > start.clientHeight || start.scrollWidth > start.clientWidth) return start;
      const walker = start.querySelectorAll('*');
      for (let i = 0; i < walker.length; i++) {
        const node = walker[i];
        const style = window.getComputedStyle(node);
        if ((style.overflowY === 'auto' || style.overflowY === 'scroll' || style.overflowX === 'auto' || style.overflowX === 'scroll') && (node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth)) return node;
      }
      return start; // fallback to container
    }

    const scrollEl = findScrollable(container);

    // create rail and thumb
    const rail = document.createElement('div');
    rail.className = 'scroll-rail-overlay';
    const thumb = document.createElement('div');
    thumb.className = 'scroll-rail-thumb';
    rail.appendChild(thumb);
    // ensure container positioned for absolute overlay
    if (!container.style.position) container.style.position = 'relative';
    container.appendChild(rail);

    let dragging = false;
    let startPos = 0;
    let startScroll = 0;

    function update() {
      const vertical = scrollEl.scrollHeight > scrollEl.clientHeight;
      const horizontal = scrollEl.scrollWidth > scrollEl.clientWidth;

      if (vertical) {
        const { scrollTop, scrollHeight, clientHeight } = scrollEl;
        const ratio = clientHeight / scrollHeight;
        const thumbH = Math.max(24, clientHeight * ratio);
        const maxScroll = scrollHeight - clientHeight;
        const top = maxScroll > 0 ? (scrollTop / maxScroll) * (clientHeight - thumbH) : 0;
        thumb.style.width = '';
        thumb.style.height = `${thumbH}px`;
        thumb.style.transform = `translateY(${top}px)`;
        thumb.style.left = '';
        thumb.style.right = '0';
      } else if (horizontal) {
        const { scrollLeft, scrollWidth, clientWidth } = scrollEl;
        const ratio = clientWidth / scrollWidth;
        const thumbW = Math.max(24, clientWidth * ratio);
        const maxScroll = scrollWidth - clientWidth;
        const left = maxScroll > 0 ? (scrollLeft / maxScroll) * (clientWidth - thumbW) : 0;
        thumb.style.height = '';
        thumb.style.width = `${thumbW}px`;
        thumb.style.transform = `translateX(${left}px)`;
        thumb.style.left = '0';
        thumb.style.right = '';
      }

      const shows = vertical || horizontal;
      rail.style.opacity = shows ? '1' : '0';
      rail.style.pointerEvents = shows ? 'auto' : 'none';
    }

    function onScroll() { update(); }
    function onResize() { update(); }

    function onThumbDown(e) {
      e.preventDefault();
      dragging = true;
      const vertical = scrollEl.scrollHeight > scrollEl.clientHeight;
      startPos = vertical ? e.clientY : e.clientX;
      startScroll = vertical ? scrollEl.scrollTop : scrollEl.scrollLeft;
      document.body.style.userSelect = 'none';
      window.addEventListener('mousemove', onThumbMove);
      window.addEventListener('mouseup', onThumbUp);
    }

    function onThumbMove(e) {
      if (!dragging) return;
      const vertical = scrollEl.scrollHeight > scrollEl.clientHeight;
      if (vertical) {
        const thumbRect = thumb.getBoundingClientRect();
        const delta = e.clientY - startPos;
        const maxThumbTravel = scrollEl.clientHeight - thumbRect.height;
        const scrollRatio = maxThumbTravel > 0 ? delta / maxThumbTravel : 0;
        scrollEl.scrollTop = startScroll + scrollRatio * (scrollEl.scrollHeight - scrollEl.clientHeight);
      } else {
        const thumbRect = thumb.getBoundingClientRect();
        const delta = e.clientX - startPos;
        const maxThumbTravel = scrollEl.clientWidth - thumbRect.width;
        const scrollRatio = maxThumbTravel > 0 ? delta / maxThumbTravel : 0;
        scrollEl.scrollLeft = startScroll + scrollRatio * (scrollEl.scrollWidth - scrollEl.clientWidth);
      }
    }

    function onThumbUp() {
      dragging = false;
      document.body.style.userSelect = '';
      window.removeEventListener('mousemove', onThumbMove);
      window.removeEventListener('mouseup', onThumbUp);
    }

    thumb.addEventListener('mousedown', onThumbDown);
    scrollEl.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onResize);

    // initial
    update();

    const mo = new MutationObserver(() => update());
    mo.observe(scrollEl, { childList: true, subtree: true, characterData: true });

    return () => {
      thumb.removeEventListener('mousedown', onThumbDown);
      scrollEl.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onResize);
      mo.disconnect();
      if (rail.parentNode === container) container.removeChild(rail);
    };
  }, []);

  return rootRef;
}
