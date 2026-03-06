import { useEffect, useRef, useState, type ReactNode } from "react";

interface PageTransitionProps {
  children: ReactNode;
  /** Key that triggers the transition when changed */
  transitionKey: string;
  className?: string;
}

/**
 * Wraps content in a fade+slide transition when `transitionKey` changes.
 * Lightweight alternative to react-transition-group.
 */
export function PageTransition({
  children,
  transitionKey,
  className = "",
}: PageTransitionProps) {
  const [phase, setPhase] = useState<"enter" | "idle">("idle");
  const prevKey = useRef(transitionKey);

  useEffect(() => {
    if (transitionKey !== prevKey.current) {
      prevKey.current = transitionKey;
      setPhase("enter");
      const timer = setTimeout(() => setPhase("idle"), 250);
      return () => clearTimeout(timer);
    }
  }, [transitionKey]);

  return (
    <div
      className={`${className} ${phase === "enter" ? "animate-slide-up" : ""}`}
      style={{ willChange: phase === "enter" ? "opacity, transform" : "auto" }}
    >
      {children}
    </div>
  );
}
