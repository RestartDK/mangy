import { createFileRoute } from "@tanstack/react-router";
import { useTheme } from "next-themes";

import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const AppearanceRouteComponent = () => {
  const { setTheme, theme } = useTheme();

  return (
    <section className="panel">
      <div className="panel-header">
        <h2 className="panel-title">Appearance</h2>
      </div>
      <div className="p-4">
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="theme-preference">Theme</FieldLabel>
            <Select onValueChange={setTheme} value={theme ?? "system"}>
              <SelectTrigger
                className="h-8 w-full sm:w-52"
                id="theme-preference"
              >
                <SelectValue placeholder="Choose a theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="system">System</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="dark">Dark</SelectItem>
              </SelectContent>
            </Select>
            <FieldDescription className="text-xs">
              System follows your OS preference.
            </FieldDescription>
          </Field>
        </FieldGroup>
      </div>
    </section>
  );
};

export const Route = createFileRoute("/settings/appearance")({
  component: AppearanceRouteComponent,
});
