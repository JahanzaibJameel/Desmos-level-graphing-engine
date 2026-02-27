/**
 * Slider Parameter System - Desmos-style
 * Automatically detects and manages slider values
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface SliderParameter {
  name: string;
  value: number;
  minValue: number;
  maxValue: number;
  step: number;
  isAnimating: boolean;
  animationSpeed: number; // units per second
}

export interface SlidersStore {
  sliders: Map<string, SliderParameter>;
  
  // Actions
  addSlider: (param: SliderParameter) => void;
  updateSliderValue: (name: string, value: number) => void;
  updateSliderRange: (name: string, min: number, max: number) => void;
  startAnimation: (name: string, speed: number) => void;
  stopAnimation: (name: string) => void;
  setSlider: (name: string, param: Partial<SliderParameter>) => void;
  removeSlider: (name: string) => void;
  getSliders: () => SliderParameter[];
  getSliderValue: (name: string) => number;
  getSliderScope: () => Record<string, number>;
  clearSliders: () => void;
}

/**
 * Slider store using Zustand
 */
const customStorage = {
  getItem: (name: string) => {
    const item = localStorage.getItem(name);
    if (!item) return null;
    try {
      const state = JSON.parse(item);
      // Ensure sliders is stored as plain object (not Map)
      return state;
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    try {
      // Convert sliders Map to plain object before storing
      const stateToStore = {
        ...value,
        sliders: value.sliders instanceof Map
          ? Object.fromEntries(value.sliders)
          : value.sliders,
      };
      localStorage.setItem(name, JSON.stringify(stateToStore));
    } catch (error) {
      console.error('Failed to persist sliders store:', error);
    }
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

export const useSlidersStore = create<SlidersStore>()(
  persist(
    (set, get) => ({
      sliders: new Map(),

      addSlider: (param: SliderParameter) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          sliders.set(param.name, param);
          return { sliders };
        }),

      updateSliderValue: (name: string, value: number) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          const slider = sliders.get(name);
          if (!slider) return state;

          const clampedValue = Math.max(slider.minValue, Math.min(slider.maxValue, value));
          sliders.set(name, { ...slider, value: clampedValue });
          return { sliders };
        }),

      updateSliderRange: (name: string, min: number, max: number) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          const slider = sliders.get(name);
          if (!slider) return state;

          const clampedValue = Math.max(min, Math.min(max, slider.value));
          sliders.set(name, {
            ...slider,
            minValue: min,
            maxValue: max,
            value: clampedValue,
          });
          return { sliders };
        }),

      startAnimation: (name: string, speed: number) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          const slider = sliders.get(name);
          if (!slider) return state;

          sliders.set(name, { ...slider, isAnimating: true, animationSpeed: speed });
          return { sliders };
        }),

      stopAnimation: (name: string) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          const slider = sliders.get(name);
          if (!slider) return state;

          sliders.set(name, { ...slider, isAnimating: false });
          return { sliders };
        }),

      setSlider: (name: string, updates: Partial<SliderParameter>) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          const slider = sliders.get(name);
          if (!slider) {
            // Create new slider if it doesn't exist
            const newSlider: SliderParameter = {
              name,
              value: 5,
              minValue: -10,
              maxValue: 10,
              step: 0.1,
              isAnimating: false,
              animationSpeed: 1,
              ...updates,
            };
            sliders.set(name, newSlider);
            return { sliders };
          }

          sliders.set(name, { ...slider, ...updates });
          return { sliders };
        }),

      removeSlider: (name: string) => 
        set((state) => {
          let sliders = state.sliders;
          // Convert plain object back to Map if needed
          if (!(sliders instanceof Map)) {
            sliders = new Map(Object.entries(sliders as Record<string, SliderParameter>));
          } else {
            sliders = new Map(sliders);
          }
          
          sliders.delete(name);
          return { sliders };
        }),

      getSliders: () => {
        const sliders = get().sliders;
        // Handle both Map and plain object (after deserialization)
        if (sliders instanceof Map) {
          return Array.from(sliders.values());
        }
        // Convert plain object to array
        return Object.values(sliders as Record<string, SliderParameter>);
      },

      getSliderValue: (name: string) => {
        const sliders = get().sliders;
        if (sliders instanceof Map) {
          return sliders.get(name)?.value ?? 0;
        }
        return (sliders as Record<string, SliderParameter>)[name]?.value ?? 0;
      },

      getSliderScope: () => {
        const scope: Record<string, number> = {};
        const sliders = get().sliders;
        if (sliders instanceof Map) {
          for (const [name, slider] of sliders) {
            scope[name] = slider.value;
          }
        } else {
          for (const [name, slider] of Object.entries(sliders as Record<string, SliderParameter>)) {
            scope[name] = slider.value;
          }
        }
        return scope;
      },

      clearSliders: () => set({ sliders: new Map() }),
    }),
    {
      name: 'graphing-sliders',
      version: 1,
      storage: customStorage as any,
    }
  )
);

export function useSliders() {
  const store = useSlidersStore();
  return {
    sliders: store.getSliders(),
    addSlider: store.addSlider,
    updateSliderValue: store.updateSliderValue,
    setSlider: store.setSlider,
    removeSlider: store.removeSlider,
    getSliderScope: store.getSliderScope,
  } as const;
}
