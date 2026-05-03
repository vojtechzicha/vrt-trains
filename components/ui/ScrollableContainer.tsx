'use client';

import { useRef, useState, useEffect, ReactNode, useCallback } from 'react';

interface ScrollableContainerProps {
  children: ReactNode;
  className?: string;
}

export function ScrollableContainer({ children, className = '' }: ScrollableContainerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [hasOverflow, setHasOverflow] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const hasScroll = maxScroll > 1;

    setHasOverflow(hasScroll);
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft < maxScroll - 1);
    setScrollProgress(hasScroll ? (el.scrollLeft / maxScroll) * 100 : 0);
  }, []);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    const contentEl = contentRef.current;
    if (!scrollEl || !contentEl) return;

    // Check immediately
    updateScrollState();

    // Check again after short delays to catch late renders
    const timer1 = setTimeout(updateScrollState, 50);
    const timer2 = setTimeout(updateScrollState, 200);
    const timer3 = setTimeout(updateScrollState, 500);

    // Listen to scroll events
    scrollEl.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    // Observe both container and content for size changes
    const resizeObserver = new ResizeObserver(() => {
      updateScrollState();
    });
    resizeObserver.observe(scrollEl);
    resizeObserver.observe(contentEl);

    // Also observe first child (e.g., the table) if it exists
    const firstChild = contentEl.firstElementChild;
    if (firstChild) {
      resizeObserver.observe(firstChild);
    }

    // Also observe children of content for mutations
    const mutationObserver = new MutationObserver(() => {
      setTimeout(updateScrollState, 10);
    });
    mutationObserver.observe(contentEl, { childList: true, subtree: true });

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      scrollEl.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, [updateScrollState]);

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current;
    if (!el) return;

    const scrollAmount = el.clientWidth * 0.75;
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth',
    });
  }

  return (
    <div className={className}>
      {/* Top scroll bar with buttons - always render but hide when not needed */}
      <div
        className={`flex items-center gap-2 px-4 py-2 bg-gray-50 dark:bg-gray-950 border-b border-gray-200 dark:border-gray-700 transition-all ${
          hasOverflow ? 'opacity-100' : 'opacity-0 h-0 py-0 overflow-hidden'
        }`}
      >
        <button
          onClick={() => scroll('left')}
          disabled={!canScrollLeft}
          className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
            canScrollLeft
              ? 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          ← Left
        </button>

        {/* Progress bar */}
        <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 rounded-full transition-all duration-150"
            style={{
              width: '20%',
              marginLeft: `${scrollProgress * 0.8}%`
            }}
          />
        </div>

        <button
          onClick={() => scroll('right')}
          disabled={!canScrollRight}
          className={`px-3 py-1.5 text-sm font-medium rounded border transition-colors ${
            canScrollRight
              ? 'bg-white dark:bg-gray-900 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
              : 'bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
          }`}
        >
          Right →
        </button>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        className="overflow-x-auto"
        style={{
          scrollbarWidth: 'auto',
          scrollbarColor: '#9ca3af #f3f4f6',
        }}
      >
        <div ref={contentRef} className="[&>table]:min-w-max">
          {children}
        </div>
      </div>

      {/* Bottom scrollbar styles */}
      <style jsx>{`
        div::-webkit-scrollbar {
          height: 10px;
        }
        div::-webkit-scrollbar-track {
          background: #f3f4f6;
        }
        div::-webkit-scrollbar-thumb {
          background: #9ca3af;
          border-radius: 5px;
        }
        div::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
      `}</style>
    </div>
  );
}
