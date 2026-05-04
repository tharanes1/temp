import { create } from 'zustand';
import { InteractionManager, View } from 'react-native';

export interface TourStep {
  title: string;
  desc: string;
  icon: string;
  iconType?: 'Ionicons' | 'MaterialCommunityIcons';
  targetPos: { x: number; y: number; w: number; h: number };
}

interface PendingStep {
  title: string;
  desc: string;
  icon: string;
  iconType?: 'Ionicons' | 'MaterialCommunityIcons';
  ref: React.RefObject<View | null>;
}

interface TourState {
  visible: boolean;
  steps: TourStep[];
  startTour: (steps: TourStep[]) => void;
  stopTour: () => void;
  /**
   * Measure all refs via measureInWindow, then start the tour.
   * Only starts if at least one measurement is valid.
   */
  measureAndStart: (pending: PendingStep[]) => void;
}

function measureRef(ref: React.RefObject<View | null>): Promise<{ x: number; y: number; w: number; h: number } | null> {
  return new Promise((resolve) => {
    if (!ref.current) return resolve(null);
    ref.current.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0 && Number.isFinite(x) && Number.isFinite(y)) {
        resolve({ x, y, w, h });
      } else {
        resolve(null);
      }
    });
  });
}

export const useTourStore = create<TourState>((set) => ({
  visible: false,
  steps: [],

  startTour: (steps) => set({ visible: true, steps }),

  stopTour: () => set({ visible: false, steps: [] }),

  measureAndStart: (pending) => {
    InteractionManager.runAfterInteractions(async () => {
      const measured: TourStep[] = [];

      for (const p of pending) {
        const pos = await measureRef(p.ref);
        if (pos) {
          measured.push({
            title: p.title,
            desc: p.desc,
            icon: p.icon,
            iconType: p.iconType,
            targetPos: pos,
          });
        }
      }

      if (measured.length > 0) {
        set({ visible: true, steps: measured });
      }
    });
  },
}));
