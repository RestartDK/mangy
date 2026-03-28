import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex h-full items-center justify-center py-10 text-muted-foreground">
      <div className="inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/70 px-4 py-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-sm">Loading the next panel...</span>
      </div>
    </div>
  );
}
