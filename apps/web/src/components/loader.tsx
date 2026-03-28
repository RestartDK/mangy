import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="flex items-center justify-center py-10 text-muted-foreground">
      <div className="inline-flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading
      </div>
    </div>
  );
}
