// components/SyncStatusPanel.tsx
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useSyncQueue } from "../hooks/useSyncQueue";

function formatLastSync(iso: string | null): string {
  if (!iso) return "Never";
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  return new Date(iso).toLocaleString();
}

/**
 * A fuller status view than OfflineIndicator — good for a settings page,
 * a reporting page footer, or anywhere users might want to check sync
 * health without it being a persistent banner.
 */
export function SyncStatusPanel() {
  const isOnline = useOnlineStatus();
  const { stats, triggerSync, isSyncing } = useSyncQueue();

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">
            {isOnline ? "🟢 Online" : "🔴 Offline"}
          </span>
          {stats.pendingCount > 0 && (
            <Button size="sm" variant="outline" onClick={triggerSync} disabled={!isOnline || isSyncing}>
              {isSyncing ? "Syncing…" : "Retry now"}
            </Button>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div>
            <p className="text-lg font-bold">{stats.pendingCount}</p>
            <p className="text-muted-foreground">Pending</p>
          </div>
          <div>
            <p className="text-lg font-bold text-red-600">{stats.failedCount}</p>
            <p className="text-muted-foreground">Failed</p>
          </div>
          <div>
            <p className="text-lg font-bold text-green-600">{stats.syncedCount}</p>
            <p className="text-muted-foreground">Synced</p>
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Last successful sync: {formatLastSync(stats.lastSyncedAt)}
        </p>

        {stats.failedCount > 0 && (
          <p className="text-xs text-destructive text-center">
            Some items have not reached the server yet. They will keep retrying automatically; your data remains on this device.
          </p>
        )}
      </CardContent>
    </Card>
  );
}