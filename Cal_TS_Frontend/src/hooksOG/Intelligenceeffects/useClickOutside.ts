import { useEffect } from 'react';
import type { RefObject } from 'react';

export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  handler: () => void,
  ignoreClasses: string[] = []  // ← NEW: Classes to ignore

) {
  useEffect(() => {
    const listener = (event: MouseEvent) => {
    const target = event.target as HTMLElement;

      
      if (!ref.current || ref.current.contains(event.target as Node)) {
        return;
      }

      // ← NEW: Don't close if clicking on ignored elements
      if (ignoreClasses.length > 0) {
        const hasIgnoredClass = ignoreClasses.some(className => 
          target.closest(`.${className}`)
        );
        if (hasIgnoredClass) {
          return;
        }
      }

      handler();
    };

    document.addEventListener('mousedown', listener);
    return () => document.removeEventListener('mousedown', listener);
  }, [ref, handler, ignoreClasses]);
}