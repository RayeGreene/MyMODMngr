import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

interface TabHeaderProps {
  activeTab: "downloads" | "active";
  onTabChange: (tab: "downloads" | "active") => void;
  downloadsCount: number;
  activeCount: number;
}

export function TabHeader({
  activeTab,
  onTabChange,
  downloadsCount,
  activeCount,
}: TabHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="flex items-center p-4">
        <div className="flex gap-1">
          <Button
            variant={activeTab === "downloads" ? "secondary" : "ghost"}
            onClick={() => onTabChange("downloads")}
            className="gap-2"
          >
            Downloads
            <Badge variant="secondary" className="text-xs">
              {downloadsCount}
            </Badge>
          </Button>

          <Button
            variant={activeTab === "active" ? "secondary" : "ghost"}
            onClick={() => onTabChange("active")}
            className="gap-2"
          >
            Active Mods
            <Badge variant="secondary" className="text-xs">
              {activeCount}
            </Badge>
          </Button>
        </div>
      </div>
    </div>
  );
}
