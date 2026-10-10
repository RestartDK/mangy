import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="text-muted-foreground flex items-center justify-center py-10">
      <div className="bg-card inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
        <Loader2 className="size-4 animate-spin" />
        Loading
      </div>
    </div>
  );
}
