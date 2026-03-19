import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number; // pixels from bottom to trigger load
}

export function useInfiniteScroll({
  onLoadMore,
  hasMore,
  isLoading,
  threshold = 500
}: UseInfiniteScrollProps) {
  const observerRef = useRef<IntersectionObserver | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

  const handleIntersection = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      const [entry] = entries;
      
      // If sentinel is visible and we can load more
      if (entry.isIntersecting && hasMore && !isLoading) {
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  useEffect(() => {
    // Create intersection observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null, // viewport
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    // Observe the sentinel element
    if (sentinelRef.current) {
      observerRef.current.observe(sentinelRef.current);
    }

    // Cleanup
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [handleIntersection, threshold]);

  return sentinelRef;
}