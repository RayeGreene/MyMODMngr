import { useCallback, useEffect, useState } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Card, CardContent } from "./ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { Textarea } from "./ui/textarea";
import {
  Layers,
  Plus,
  Play,
  Pencil,
  Trash2,
  Package,
} from "lucide-react";
import {
  listLoadouts,
  createLoadout,
  updateLoadout,
  deleteLoadout,
  subscribe,
  type Loadout,
} from "../lib/loadouts";
import type { Mod } from "./ModCard";

interface LoadoutManagerProps {
  mods: Mod[];
  /** Activate a loadout — caller handles enabling the mod list */
  onActivateLoadout: (modIds: string[]) => void;
}

export function LoadoutManager({
  mods,
  onActivateLoadout,
}: LoadoutManagerProps) {
  const [loadouts, setLoadouts] = useState<Loadout[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const refresh = useCallback(() => setLoadouts(listLoadouts()), []);

  useEffect(() => {
    refresh();
    return subscribe(refresh);
  }, [refresh]);

  const activeMods = mods.filter((m) => m.isActive);

  const handleCreate = () => {
    if (!newName.trim()) return;
    const modIds = activeMods.map((m) => m.id);
    createLoadout(newName.trim(), modIds, {
      description: newDesc.trim() || undefined,
      thumbnail: activeMods[0]?.images[0],
    });
    setNewName("");
    setNewDesc("");
    setCreateOpen(false);
  };

  const handleDelete = () => {
    if (deleteId) deleteLoadout(deleteId);
    setDeleteId(null);
  };

  const handleSaveEdit = () => {
    if (editId && newName.trim()) {
      updateLoadout(editId, {
        name: newName.trim(),
        description: newDesc.trim() || undefined,
      });
    }
    setEditId(null);
    setNewName("");
    setNewDesc("");
  };

  const getModCount = (loadout: Loadout): number => {
    return loadout.modIds.filter((id) =>
      mods.some((m) => m.id === id),
    ).length;
  };

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Layers className="w-6 h-6 text-primary" />
            Loadouts
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Save groups of mods as presets for quick activation
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          New Loadout
        </Button>
      </div>

      {loadouts.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Layers className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-lg font-medium mb-1">No loadouts yet</p>
          <p className="text-sm">
            Create a loadout from your currently active mods
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loadouts.map((loadout) => (
            <Card key={loadout.id} className="card-hover group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{loadout.name}</h3>
                    {loadout.description && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {loadout.description}
                      </p>
                    )}
                  </div>
                  {loadout.thumbnail && (
                    <img
                      src={loadout.thumbnail}
                      alt=""
                      className="w-10 h-10 rounded object-cover ml-3"
                    />
                  )}
                </div>

                <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                  <Package className="w-3 h-3" />
                  <span>
                    {getModCount(loadout)} / {loadout.modIds.length} mods
                    available
                  </span>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1 gap-1.5"
                    onClick={() => onActivateLoadout(loadout.modIds)}
                  >
                    <Play className="w-3.5 h-3.5" />
                    Activate
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditId(loadout.id);
                      setNewName(loadout.name);
                      setNewDesc(loadout.description || "");
                    }}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteId(loadout.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Loadout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Competitive Setup"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="Optional description..."
                className="mt-1"
                rows={2}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              This will save your {activeMods.length} currently active mod
              {activeMods.length !== 1 ? "s" : ""} as a loadout.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={!newName.trim()}>
                Create
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editId}
        onOpenChange={(open) => !open && setEditId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Loadout</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                className="mt-1"
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditId(null)}>
                Cancel
              </Button>
              <Button onClick={handleSaveEdit}>Save</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirm */}
      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete loadout?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The loadout preset will be
              permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
