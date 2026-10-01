import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

/** Friendly empty state with an optional primary action. */
export function EmptyState({
  icon = "info",
  title,
  description,
  action,
}: {
  icon?: IconName;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-card px-6 py-10 text-center">
      <span className="mx-auto grid size-12 place-items-center rounded-md bg-page text-ink-3">
        <Icon name={icon} size={24} />
      </span>
      <h3 className="mt-3 text-base font-bold">{title}</h3>
      {description && <p className="mx-auto mt-1 max-w-md text-sm text-ink-2">{description}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
