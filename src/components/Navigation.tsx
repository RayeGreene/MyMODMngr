import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { 
  Package, 
  Download, 
  Bell,
  Search,
  Home
} from 'lucide-react';

interface NavigationProps {
  currentPage: 'browse' | 'downloads';
  onPageChange: (page: 'browse' | 'downloads') => void;
  downloadsCount: number;
  updatesCount: number;
}

export function Navigation({ currentPage, onPageChange, downloadsCount, updatesCount }: NavigationProps) {
  return (
    <div className="bg-card border-b border-border">
      <div className="flex items-center gap-1 p-4">
        <div className="flex items-center gap-3 mr-6">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <Package className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-semibold">Marvel Rivals</h1>
            <p className="text-sm text-muted-foreground">Mod Manager</p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <Button
            variant={currentPage === 'browse' ? 'secondary' : 'ghost'}
            onClick={() => onPageChange('browse')}
            className="gap-2"
          >
            <Search className="w-4 h-4" />
            Browse Mods
          </Button>
          
          <Button
            variant={currentPage === 'downloads' ? 'secondary' : 'ghost'}
            onClick={() => onPageChange('downloads')}
            className="gap-2 relative"
          >
            <Download className="w-4 h-4" />
            Downloads
            {downloadsCount > 0 && (
              <Badge variant="secondary" className="ml-1 text-xs">
                {downloadsCount}
              </Badge>
            )}
            {updatesCount > 0 && (
              <div className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full flex items-center justify-center">
                <Bell className="w-2 h-2 text-destructive-foreground" />
              </div>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}