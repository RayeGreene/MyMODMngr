import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Keyboard } from "lucide-react";
import { Separator } from "./ui/separator";

interface ShortcutsHelpDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const shortcuts = [
  {
    category: "Navigation",
    items: [
      { keys: "Ctrl + K", label: "Open command palette" },
      { keys: "Ctrl + 1", label: "Go to Downloads" },
      { keys: "Ctrl + 2", label: "Go to Active Mods" },
      { keys: "Ctrl + 3", label: "Go to Characters" },
      { keys: "Ctrl + 4", label: "Go to Loadouts" },
      { keys: "Ctrl + 5", label: "Go to Update Center" },
    ],
  },
  {
    category: "Actions",
    items: [
      { keys: "Ctrl + R", label: "Refresh mods" },
      { keys: "Ctrl + F", label: "Focus search" },
      { keys: "Ctrl + Shift + F", label: "Open advanced filters" },
      { keys: "Escape", label: "Close dialog / deselect" },
    ],
  },
  {
    category: "View",
    items: [
      { keys: "Ctrl + G", label: "Toggle grid/list view" },
      { keys: "Ctrl + D", label: "Toggle dark/light mode" },
      { keys: "?", label: "Show this help" },
    ],
  },
];

export function ShortcutsHelpDialog({
  open,
  onOpenChange,
}: ShortcutsHelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="w-5 h-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {shortcuts.map((group, i) => (
            <div key={group.category}>
              {i > 0 && <Separator className="mb-4" />}
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {group.category}
              </h4>
              <div className="space-y-2">
                {group.items.map((item) => (
                  <div
                    key={item.keys}
                    className="flex items-center justify-between"
                  >
                    <span className="text-sm">{item.label}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.split(" + ").map((key, j) => (
                        <span key={j}>
                          {j > 0 && (
                            <span className="text-muted-foreground mx-0.5 text-xs">
                              +
                            </span>
                          )}
                          <kbd className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 bg-muted text-muted-foreground rounded text-[11px] font-mono font-medium border border-border/50">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
