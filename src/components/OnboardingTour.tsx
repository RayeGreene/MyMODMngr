import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import {
  Rocket,
  ChevronRight,
  ChevronLeft,
  X,
  Download,
  Layers,
  Search,
  Shield,
  Palette,
} from "lucide-react";

const TOUR_STORAGE_KEY = "modmanager:tour-complete";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
}

const TOUR_STEPS: TourStep[] = [
  {
    title: "Welcome to RivalNxt!",
    description:
      "Your all-in-one mod manager for Marvel Rivals. Let's take a quick tour of the key features.",
    icon: <Rocket className="w-8 h-8" />,
  },
  {
    title: "Browse & Install Mods",
    description:
      "The Browse tab shows all your local mods. Use the search bar, filters, and sort options to find what you need. Click any mod card to view details.",
    icon: <Download className="w-8 h-8" />,
  },
  {
    title: "Manage Active Mods",
    description:
      "Switch to the Active tab to see which mods are currently enabled. Toggle mods on and off, or use bulk selection to manage multiple mods at once.",
    icon: <Layers className="w-8 h-8" />,
  },
  {
    title: "Command Palette",
    description:
      "Press Ctrl+K to open the Command Palette. Quickly navigate to any view, search for mods, or trigger actions without touching the mouse.",
    icon: <Search className="w-8 h-8" />,
  },
  {
    title: "Conflict Resolution",
    description:
      "The Conflicts tab helps you identify which mods share the same game assets. Resolve conflicts to ensure your mods work together smoothly.",
    icon: <Shield className="w-8 h-8" />,
  },
  {
    title: "Customize Your Experience",
    description:
      "Open Settings to configure paths, change your accent color, and manage NXM protocol handling. Make the app yours!",
    icon: <Palette className="w-8 h-8" />,
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const done = localStorage.getItem(TOUR_STORAGE_KEY);
    if (done !== "true") {
      // Delay so the main UI loads first
      const timer = setTimeout(() => setVisible(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    onComplete?.();
  }, [onComplete]);

  const next = () => {
    if (step < TOUR_STEPS.length - 1) {
      setStep((s) => s + 1);
    } else {
      dismiss();
    }
  };

  const prev = () => {
    if (step > 0) setStep((s) => s - 1);
  };

  if (!visible) return null;

  const current = TOUR_STEPS[step];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden animate-slide-up">
        {/* Progress bar */}
        <div className="h-1 bg-muted">
          <div
            className="h-full bg-primary transition-all duration-300"
            style={{ width: `${((step + 1) / TOUR_STEPS.length) * 100}%` }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-2">
          <span className="text-xs text-muted-foreground">
            {step + 1} of {TOUR_STEPS.length}
          </span>
          <button
            type="button"
            onClick={dismiss}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 text-center space-y-4">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary/10 text-primary">
            {current.icon}
          </div>
          <h3 className="text-xl font-bold">{current.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {current.description}
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={prev}
            disabled={step === 0}
            className="gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="flex gap-1">
            {TOUR_STEPS.map((_, i) => (
              <div
                key={i}
                className={`w-1.5 h-1.5 rounded-full transition-colors ${
                  i === step ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
            ))}
          </div>
          <Button size="sm" onClick={next} className="gap-1">
            {step === TOUR_STEPS.length - 1 ? "Get Started" : "Next"}
            {step < TOUR_STEPS.length - 1 && <ChevronRight className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
