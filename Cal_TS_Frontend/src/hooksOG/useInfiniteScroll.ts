import { useEffect, useRef, useCallback } from 'react';

interface UseInfiniteScrollProps {
  onLoadMore: () => void;
  hasMore: boolean;
  isLoading: boolean;
  threshold?: number;
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
      
      // console.log('👁️ Intersection observed:', {
      //   isIntersecting: entry.isIntersecting,
      //   hasMore,
      //   isLoading,
      //   intersectionRatio: entry.intersectionRatio
      // });
      
      if (entry.isIntersecting && hasMore && !isLoading) {
        // console.log('🚀 Triggering load more!');
        onLoadMore();
      }
    },
    [onLoadMore, hasMore, isLoading]
  );

  useEffect(() => {
    // Cleanup previous observer
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Create new intersection observer
    observerRef.current = new IntersectionObserver(handleIntersection, {
      root: null,
      rootMargin: `${threshold}px`,
      threshold: 0.1
    });

    // Observe the sentinel element
    if (sentinelRef.current && observerRef.current) {
      observerRef.current.observe(sentinelRef.current);
      // console.log('👀 Started observing sentinel element');
    }

    // Cleanup on unmount or dependency change
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        // console.log('🛑 Stopped observing sentinel element');
      }
    };
  }, [handleIntersection, threshold]);

  return sentinelRef;
}