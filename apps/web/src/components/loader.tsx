import { Loader2 } from "lucide-react";

export default function Loader() {
  return (
    <div className="text-muted-foreground flex items-center justify-center py-16">
      <Loader2 className="size-4 animate-spin" />
      <span className="sr-only">Loading</span>
    </div>
  );
}
