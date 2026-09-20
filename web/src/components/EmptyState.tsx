import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-neutral-200 bg-white px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400">
        {icon}
      </div>
      <p className="mt-4 text-sm font-medium text-neutral-900">{title}</p>
      {description ? <p className="mt-1 max-w-sm text-sm text-neutral-500">{description}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
