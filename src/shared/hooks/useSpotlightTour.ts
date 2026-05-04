import { useState, useCallback, useRef } from 'react';
import { View, ScrollView, InteractionManager } from 'react-native';

export type SpotlightState = 'idle' | 'measuring' | 'ready';

export interface LayoutData {
  x: number;
  y: number;
  w: number;
  h: number;
}

export const isValidLayout = (layout: any): layout is LayoutData => {
  return (
    layout &&
    Number.isFinite(layout.x) &&
    Number.isFinite(layout.y) &&
    layout.w > 0 &&
    layout.h > 0
  );
};

interface UseSpotlightTourProps {
  refs: Record<string, React.RefObject<View | null>>;
  scrollRef: React.RefObject<ScrollView | null>;
  keys: string[];
}

export function useSpotlightTour({
  refs,
  scrollRef,
  keys,
}: UseSpotlightTourProps) {
  const [spotlightState, setSpotlightState] = useState<SpotlightState>('idle');
  const [absoluteLayouts, setAbsoluteLayouts] = useState<Record<string, LayoutData>>({});
  const [relativeLayouts, setRelativeLayouts] = useState<Record<string, LayoutData>>({});
  
  const currentStepId = useRef(0);
  const isScrolling = useRef(false);
  const currentKey = useRef<string | null>(null);

  const measureTarget = useCallback((key: string, stepId: number) => {
    const ref = refs[key];
    if (!ref?.current || isScrolling.current) return;

    let attempts = 0;
    const measureWithRetry = () => {
      // Guard against stale measurements or step changes
      if (stepId !== currentStepId.current) return;
      if (!ref.current) return;

      ref.current.measureInWindow((x, y, width, height) => {
        // Validation: Ensure the layout is non-zero and stable
        const layout = { x, y, w: width, h: height };
        
        if (isValidLayout(layout)) {
          setAbsoluteLayouts(prev => ({ ...prev, [key]: layout }));
          setSpotlightState('ready');
        } else {
          attempts++;
          if (attempts < 20) {
            requestAnimationFrame(measureWithRetry);
          }
        }
      });
    };

    InteractionManager.runAfterInteractions(() => {
      // Start measurement cycle
      requestAnimationFrame(measureWithRetry);
    });
  }, [refs]);

  const handleTourStepChange = useCallback((index: number, scrollOffset = 100) => {
    currentStepId.current++;
    const stepId = currentStepId.current;

    if (index < 0 || index >= keys.length) {
      setSpotlightState('idle');
      currentKey.current = null;
      return;
    }

    const key = keys[index];
    currentKey.current = key;
    setSpotlightState('measuring');

    // High-precision scroll to target
    const rel = relativeLayouts[key];
    if (rel && scrollRef.current) {
      scrollRef.current.scrollTo({
        y: Math.max(0, rel.y - scrollOffset),
        animated: true
      });
    }

    // Measurement will be triggered by onMomentumScrollEnd OR 
    // after a short stabilization window if no scroll is detected
    requestAnimationFrame(() => {
      setTimeout(() => {
        if (!isScrolling.current && stepId === currentStepId.current) {
           measureTarget(key, stepId);
        }
      }, 300); // Guard window for layout settling
    });
  }, [keys, relativeLayouts, scrollRef, measureTarget]);

  const onScrollBeginDrag = useCallback(() => {
    isScrolling.current = true;
  }, []);

  const onMomentumScrollEnd = useCallback(() => {
    isScrolling.current = false;
    if (currentKey.current) {
      measureTarget(currentKey.current, currentStepId.current);
    }
  }, [measureTarget]);

  const onLayoutTarget = useCallback((key: string) => () => {
    const ref = refs[key];
    const scroll = scrollRef.current;
    if (!ref?.current || !scroll) return;

    // Use measureLayout for relative scrolling info
    ref.current.measureLayout(
      scroll as any,
      (x, y, w, h) => {
        if (w > 0) {
          setRelativeLayouts(prev => ({ ...prev, [key]: { x, y, w, h } }));
        }
      },
      () => {}
    );
  }, [refs, scrollRef]);

  return {
    spotlightState,
    setSpotlightState,
    absoluteLayouts,
    handleTourStepChange,
    onLayoutTarget,
    onScrollBeginDrag,
    onMomentumScrollEnd,
    currentStepKey: currentKey.current
  };
}
