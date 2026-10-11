import { Loader2 } from "lucide-react";

const Loader = () => (
  <div className="text-muted-foreground flex items-center justify-center py-16">
    <Loader2 className="size-4 animate-spin" />
    <span className="sr-only">Loading</span>
  </div>
);

export default Loader;
