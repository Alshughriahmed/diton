"use client";

import { useEffect, useRef } from 'react';

/**
 * Hook للتمرير التلقائي للأسفل عند إضافة رسائل جديدة
 * Auto-scroll hook that scrolls to bottom when new messages are added
 * Only scrolls if user hasn't manually scrolled up
 */
export function useAutoScroll<T extends HTMLElement>(): [
  React.RefObject<T | null>, 
  () => void  // Manual scroll to bottom function
] {
  const ref = useRef<T>(null);
  const userInteractedRef = useRef(false);
  const isNearBottomRef = useRef(true);

  const scrollToBottom = () => {
    const element = ref.current;
    if (element) {
      element.scrollTop = element.scrollHeight;
      isNearBottomRef.current = true;
      userInteractedRef.current = false;
    }
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    let scrollTimeout: NodeJS.Timeout;

    const handleScroll = () => {
      clearTimeout(scrollTimeout);
      scrollTimeout = setTimeout(() => {
        if (!element) return;
        
        const { scrollTop, scrollHeight, clientHeight } = element;
        const isNearBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
        
        isNearBottomRef.current = isNearBottom;
        
        // Mark as user-interacted if they scrolled up significantly
        if (!isNearBottom) {
          userInteractedRef.current = true;
        } else {
          userInteractedRef.current = false;
        }
      }, 100);
    };

    // Auto-scroll observer - watches for content changes
    const observer = new MutationObserver(() => {
      // Only auto-scroll if user hasn't manually scrolled up
      if (isNearBottomRef.current && !userInteractedRef.current) {
        setTimeout(scrollToBottom, 10); // Small delay for layout
      }
    });

    observer.observe(element, {
      childList: true,
      subtree: true,
      characterData: true
    });

    element.addEventListener('scroll', handleScroll);

    return () => {
      clearTimeout(scrollTimeout);
      observer.disconnect();
      element.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return [ref, scrollToBottom];
}