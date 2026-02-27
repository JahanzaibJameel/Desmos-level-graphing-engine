import React, { useState, useCallback, useMemo } from 'react';
import { useSlidersStore, SliderParameter } from '../store/sliders.store';

interface SliderUIProps {
  slider: SliderParameter;
  onChange: (value: number) => void;
  onAnimationToggle?: (isAnimating: boolean) => void;
}

/**
 * Single slider UI component
 */
export const SliderControl: React.FC<SliderUIProps> = ({
  slider,
  onChange,
  onAnimationToggle,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [inputValue, setInputValue] = useState(slider.value.toString());

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value)) {
      setInputValue(e.target.value);
      onChange(value);
    }
  }, [onChange]);

  const handleInputBlur = () => {
    setIsEditing(false);
    setInputValue(slider.value.toString());
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleInputBlur();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const handleMinChange = () => {
    onChange(slider.minValue);
  };

  

  const handleAnimationToggle = () => {
    onAnimationToggle?.(!slider.isAnimating);
  };

  return (
    <div className="space-y-2 p-4 bg-gray-50 rounded-lg border-2 border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <label htmlFor={`slider-${slider.name}`} className="text-sm font-bold text-gray-800">
            {slider.name}
          </label>
          {isEditing ? (
            <input
              id={`slider-${slider.name}-input`}
              type="number"
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              autoFocus
              className="mt-1 w-full px-2 py-1 border-2 border-blue-500 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition"
              step={slider.step}
              aria-label={`Value for parameter ${slider.name}`}
            />
          ) : (
            <button
              onClick={() => setIsEditing(true)}
              className="mt-1 w-full px-2 py-1 bg-white border-2 border-gray-300 rounded text-sm cursor-pointer hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 transition text-left"
              aria-label={`Edit ${slider.name}: ${slider.value.toFixed(2)} (click to edit or press Enter)`}
            >
              {slider.value.toFixed(2)}
            </button>
          )}
        </div>

        {/* Animation button */}
        <button
          onClick={handleAnimationToggle}
          className={`ml-2 px-3 py-1 rounded text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-offset-1 ${
            slider.isAnimating
              ? 'bg-blue-500 text-white ring-blue-500'
              : 'bg-gray-300 text-gray-700 hover:bg-gray-400 ring-gray-500'
          }`}
          aria-label={slider.isAnimating ? `Stop animating ${slider.name}` : `Start animating ${slider.name}`}
          aria-pressed={slider.isAnimating}
        >
          {slider.isAnimating ? '⏸' : '▶'}
        </button>
      </div>

      {/* Slider */}
      <input
        id={`slider-${slider.name}`}
        type="range"
        min={slider.minValue}
        max={slider.maxValue}
        step={slider.step}
        value={slider.value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
        aria-label={`${slider.name} slider: Current value ${slider.value.toFixed(2)}`}
        aria-valuemin={slider.minValue}
        aria-valuemax={slider.maxValue}
        aria-valuenow={slider.value}
        aria-valuetext={`${slider.value.toFixed(2)}`}
      />

      {/* Min/Max */}
      <div className="flex items-center justify-between text-xs text-gray-700 font-medium">
        <button
          onClick={handleMinChange}
          className="px-2 py-1 bg-gray-300 hover:bg-gray-400 rounded transition focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-gray-500"
          aria-label={`Set ${slider.name} to minimum: ${slider.minValue.toFixed(2)}`}
        >
          {slider.minValue.toFixed(2)}
        </button>
        <span aria-hidden="true">→</span>
        <span>{slider.maxValue.toFixed(2)}</span>
      </div>

      {/* Animation speed */}
      {slider.isAnimating && (
        <div className="flex items-center gap-2 pt-2 border-t-2 border-gray-300">
          <label htmlFor={`speed-${slider.name}`} className="text-xs text-gray-700 font-medium whitespace-nowrap">
            Speed:
          </label>
          <input
            id={`speed-${slider.name}`}
            type="range"
            min="0.1"
            max="5"
            step="0.1"
            defaultValue={slider.animationSpeed}
            className="flex-1 h-2 bg-gray-400 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
            aria-label={`Animation speed for ${slider.name}`}
          />
        </div>
      )}
    </div>
  );
};

/**
 * Slider panel component
 */
export const SliderPanel: React.FC = () => {
  const rawSliders = useSlidersStore((s) => s.sliders);
  // Memoize to prevent infinite loops - only update when actual data changes
  const sliders: SliderParameter[] = useMemo(() => {
    if (rawSliders instanceof Map) {
      return Array.from(rawSliders.values());
    }
    return Object.values(rawSliders);
  }, [rawSliders]);
  
  const updateSliderValue = useSlidersStore((s) => s.updateSliderValue);
  const addSlider = useSlidersStore((s) => s.addSlider);
  const removeSlider = useSlidersStore((s) => s.removeSlider);

  const [showAddSlider, setShowAddSlider] = useState(false);
  const [newSliderName, setNewSliderName] = useState('');

  const handleAddSlider = (e: React.FormEvent) => {
    e.preventDefault();
    if (newSliderName.trim()) {
      addSlider({
        name: newSliderName.trim().toLowerCase(),
        value: 5,
        minValue: 0,
        maxValue: 10,
        step: 0.1,
        isAnimating: false,
        animationSpeed: 1,
      });
      setNewSliderName('');
      setShowAddSlider(false);
    }
  };

  if (sliders.length === 0 && !showAddSlider) {
    return null;
  }

  return (
    <section className="bg-white rounded-lg shadow-lg p-6 space-y-4" aria-labelledby="slider-title">
      <div className="flex items-center justify-between">
        <h3 id="slider-title" className="text-lg font-bold text-gray-800">
          🎚️ Parameters
        </h3>
        <button
          onClick={() => setShowAddSlider(!showAddSlider)}
          className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
          aria-label={showAddSlider ? 'Cancel adding new parameter' : 'Add new parameter'}
          aria-expanded={showAddSlider}
        >
          {showAddSlider ? '✕ Cancel' : '➕ Add'}
        </button>
      </div>

      {/* Add slider form */}
      {showAddSlider && (
        <form onSubmit={handleAddSlider} className="flex gap-2 pb-4 border-b-2 border-gray-200">
          <div className="flex-1">
            <label htmlFor="param-name-input" className="text-xs font-medium text-gray-700 block mb-1">
              Parameter name
            </label>
            <input
              id="param-name-input"
              type="text"
              placeholder="e.g., a, m, k"
              value={newSliderName}
              onChange={(e) => setNewSliderName(e.target.value)}
              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
              autoFocus
              aria-label="New parameter name"
              autoComplete="off"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-500 text-white font-medium rounded-lg hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition self-end"
            aria-label="Create new parameter"
          >
            Create
          </button>
        </form>
      )}

      {/* Slider list */}
      <div className="space-y-3 max-h-96 overflow-y-auto" role="list">
        {sliders.map((slider) => (
          <div key={slider.name} className="relative" role="listitem">
            <SliderControl
              slider={slider}
              onChange={(value) => updateSliderValue(slider.name, value)}
            />
            <button
              onClick={() => removeSlider(slider.name)}
              className="absolute top-4 right-3 p-1 text-gray-400 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-red-500 rounded transition"
              aria-label={`Remove parameter ${slider.name}`}
            >
              <span aria-hidden="true">✕</span>
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};

/**
 * Slider hook for animations
 */
export function useSliderAnimation(sliderName: string) {
  const slider = useSlidersStore((s) => s.sliders.get(sliderName));
  const updateValue = useSlidersStore((s) => s.updateSliderValue);

  React.useEffect(() => {
    if (!slider?.isAnimating) return;

    let animationId: number;
    let lastTime = performance.now();

    const animate = (now: number) => {
      const dt = (now - lastTime) / 1000; // Delta time in seconds
      lastTime = now;

      const newValue = slider.value + slider.animationSpeed * dt;

      // Loop animation
      if (newValue > slider.maxValue) {
        updateValue(sliderName, slider.minValue);
      } else {
        updateValue(sliderName, newValue);
      }

      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(animationId);
  }, [slider?.isAnimating, slider?.animationSpeed, slider?.value, updateValue, sliderName]);
}
