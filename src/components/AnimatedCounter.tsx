import { useEffect, useRef, useState } from "react";

interface AnimatedCounterProps {
  value: number;
  className?: string;
  /** Duration in ms */
  duration?: number;
}

/**
 * Displays a number that animates (slides up) when the value changes.
 */
export function AnimatedCounter({
  value,
  className = "",
  duration = 300,
}: AnimatedCounterProps) {
  const [displayValue, setDisplayValue] = useState(value);
  const [animating, setAnimating] = useState(false);
  const prevValue = useRef(value);

  useEffect(() => {
    if (value !== prevValue.current) {
      prevValue.current = value;
      setAnimating(true);
      // Swap value after a brief delay so the old one exits
      const swap = setTimeout(() => {
        setDisplayValue(value);
      }, duration * 0.15);
      const done = setTimeout(() => {
        setAnimating(false);
      }, duration);
      return () => {
        clearTimeout(swap);
        clearTimeout(done);
      };
    }
  }, [value, duration]);

  return (
    <span
      className={`inline-block ${animating ? "animate-count-up" : ""} ${className}`}
      key={displayValue}
    >
      {displayValue}
    </span>
  );
}
