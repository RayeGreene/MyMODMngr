import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  Download,
  Trash2,
  RefreshCw,
  Heart,
  Layers,
  X,
  CheckSquare,
  Square,
} from "lucide-react";

interface BulkOperationsToolbarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  /** Batch install/activate selected mods */
  onBatchInstall?: () => void;
  /** Batch uninstall selected mods */
  onBatchUninstall?: () => void;
  /** Batch update selected mods */
  onBatchUpdate?: () => void;
  /** Batch favorite selected mods */
  onBatchFavorite?: () => void;
  /** Save selected mods as a loadout */
  onSaveAsLoadout?: () => void;
  /** Exit selection mode */
  onCancel: () => void;
}

export function BulkOperationsToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onDeselectAll,
  onBatchInstall,
  onBatchUninstall,
  onBatchUpdate,
  onBatchFavorite,
  onSaveAsLoadout,
  onCancel,
}: BulkOperationsToolbarProps) {
  if (selectedCount === 0) return null;

  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="animate-slide-up bg-card border border-border rounded-lg shadow-lg p-3 flex items-center gap-3 flex-wrap">
      {/* Selection info */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={allSelected ? onDeselectAll : onSelectAll}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="w-4 h-4 text-primary" />
          ) : (
            <Square className="w-4 h-4" />
          )}
        </button>
        <Badge variant="default" className="text-xs">
          {selectedCount} selected
        </Badge>
      </div>

      <div className="h-4 w-px bg-border" />

      {/* Actions */}
      <div className="flex items-center gap-1 flex-wrap">
        {onBatchInstall && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchInstall}
            className="gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            Install
          </Button>
        )}
        {onBatchUpdate && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchUpdate}
            className="gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Update
          </Button>
        )}
        {onBatchFavorite && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchFavorite}
            className="gap-1.5"
          >
            <Heart className="w-3.5 h-3.5" />
            Favorite
          </Button>
        )}
        {onSaveAsLoadout && (
          <Button
            variant="outline"
            size="sm"
            onClick={onSaveAsLoadout}
            className="gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" />
            Save Loadout
          </Button>
        )}
        {onBatchUninstall && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBatchUninstall}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Remove
          </Button>
        )}
      </div>

      {/* Cancel */}
      <div className="ml-auto">
        <Button variant="ghost" size="sm" onClick={onCancel} className="gap-1">
          <X className="w-3.5 h-3.5" />
          Cancel
        </Button>
      </div>
    </div>
  );
}
