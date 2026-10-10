import type { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  helper?: string;
  icon?: ReactNode;
  className?: string;
}

export const MetricCard = ({
  className,
  helper,
  icon,
  label,
  value,
}: MetricCardProps) => {
  return (
    <Card className={cn(className)} size="sm">
      <CardHeader className="gap-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
            {label}
          </CardTitle>
          {icon ? <div className="text-muted-foreground">{icon}</div> : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="font-heading text-2xl font-semibold tracking-tight">
          {value}
        </div>
        {helper ? (
          <p className="text-muted-foreground text-sm">{helper}</p>
        ) : null}
      </CardContent>
    </Card>
  );
};
