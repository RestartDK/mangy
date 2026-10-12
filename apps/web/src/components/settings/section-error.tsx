import type { Cause } from "effect";
import { Option } from "effect";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCause } from "@/lib/format";

interface SectionErrorProps {
  cause: Option.Option<Cause.Cause<unknown>>;
  title: string;
}

export const SectionError = ({ cause, title }: SectionErrorProps) => {
  if (Option.isNone(cause)) {
    return null;
  }

  return (
    <Alert variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>
        {formatCause(cause.value, "Try again in a moment.")}
      </AlertDescription>
    </Alert>
  );
};
