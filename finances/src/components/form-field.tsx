import type { ReactNode } from "react";
import { Label } from "@/components/ui/label";

/** The aria-describedby value for a field: its error when shown, else its hint. */
export function describedBy(id: string, error?: string, hint?: boolean): string | undefined {
  if (error) return `${id}-error`;
  return hint ? `${id}-hint` : undefined;
}

/**
 * A label, the control, and either its error or its hint. For a single
 * control, `id` is the control's id. For a group (like radio buttons), pass
 * `group` and point the group's aria-labelledby at `${id}-label`. A field
 * that can be left blank is `optional`, or `recommended` when it should
 * usually be filled in.
 */
export function FormField({
  id,
  label,
  optional,
  recommended,
  hint,
  error,
  group,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  recommended?: boolean;
  hint?: string;
  error?: string;
  group?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0 space-y-2">
      <Label id={`${id}-label`} htmlFor={group ? undefined : id}>
        {label}
        {optional && <span className="font-normal text-muted-foreground">(optional)</span>}
        {recommended && <span className="font-normal text-muted-foreground">(recommended)</span>}
      </Label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
