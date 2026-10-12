import { Switch } from "@/components/ui/switch";

interface ToggleRowProps {
  checked: boolean;
  description: string;
  disabled?: boolean;
  label: string;
  onCheckedChange: (checked: boolean) => void;
}

export const ToggleRow = ({
  checked,
  description,
  disabled,
  label,
  onCheckedChange,
}: ToggleRowProps) => (
  <div className="row">
    <div className="min-w-0 space-y-0.5">
      <p className="text-sm font-medium">{label}</p>
      <p className="meta">{description}</p>
    </div>
    <Switch
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
    />
  </div>
);
