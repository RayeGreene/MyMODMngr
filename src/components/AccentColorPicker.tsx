import { useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Palette, RotateCcw, Check } from "lucide-react";
import { useTheme } from "./ThemeProvider";

const PRESET_COLORS = [
  { label: "Royal Blue", value: "#5F85DB" },
  { label: "Soft Blue", value: "#90B8F8" },
  { label: "Violet", value: "#8B5CF6" },
  { label: "Purple", value: "#A855F7" },
  { label: "Rose", value: "#F43F5E" },
  { label: "Emerald", value: "#10B981" },
  { label: "Amber", value: "#F59E0B" },
  { label: "Cyan", value: "#06B6D4" },
  { label: "Pink", value: "#EC4899" },
  { label: "Indigo", value: "#6366F1" },
  { label: "Teal", value: "#14B8A6" },
  { label: "Orange", value: "#F97316" },
];

interface AccentColorPickerProps {
  className?: string;
}

export function AccentColorPicker({ className = "" }: AccentColorPickerProps) {
  const { accentColor, setAccentColor, theme } = useTheme();
  const [customColor, setCustomColor] = useState(accentColor || "");

  const handlePreset = (color: string) => {
    setAccentColor(color);
    setCustomColor(color);
  };

  const handleCustom = () => {
    if (customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
      setAccentColor(customColor);
    }
  };

  const handleReset = () => {
    setAccentColor(null);
    setCustomColor("");
  };

  const defaultColor = theme === "dark" ? "#90B8F8" : "#5F85DB";
  const currentColor = accentColor || defaultColor;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-2">
          <Palette className="w-4 h-4" />
          Accent Color
        </h4>
        {accentColor && (
          <Button variant="ghost" size="sm" onClick={handleReset}>
            <RotateCcw className="w-3.5 h-3.5 mr-1" />
            Reset
          </Button>
        )}
      </div>

      {/* Current color preview */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-lg border-2 border-border shadow-sm"
          style={{ backgroundColor: currentColor }}
        />
        <div className="text-sm">
          <div className="font-medium">Current</div>
          <div className="text-muted-foreground font-mono text-xs">
            {currentColor}
          </div>
        </div>
      </div>

      {/* Presets */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Presets</p>
        <div className="flex flex-wrap gap-2">
          {PRESET_COLORS.map((preset) => (
            <button
              key={preset.value}
              type="button"
              title={preset.label}
              onClick={() => handlePreset(preset.value)}
              className="w-8 h-8 rounded-lg border-2 transition-all relative hover:scale-110"
              style={{
                backgroundColor: preset.value,
                borderColor:
                  accentColor === preset.value
                    ? "var(--foreground)"
                    : "transparent",
              }}
            >
              {accentColor === preset.value && (
                <Check className="w-4 h-4 text-white absolute inset-0 m-auto drop-shadow" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Custom color input */}
      <div>
        <p className="text-xs text-muted-foreground mb-2">Custom Color</p>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type="color"
              value={customColor || currentColor}
              onChange={(e) => {
                setCustomColor(e.target.value);
                setAccentColor(e.target.value);
              }}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            <Input
              value={customColor}
              onChange={(e) => setCustomColor(e.target.value)}
              placeholder="#5F85DB"
              className="font-mono text-xs"
            />
          </div>
          <Button size="sm" onClick={handleCustom}>
            Apply
          </Button>
        </div>
      </div>
    </div>
  );
}
