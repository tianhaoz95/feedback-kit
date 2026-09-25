import type { FeedbackEnvironment } from "@/lib/types";
import { platformOf } from "@/lib/platform";
import { DeviceIcon, GlobeIcon, MonitorIcon, WatchIcon } from "@/components/icons";

const ICONS = {
  web: GlobeIcon,
  ios: DeviceIcon,
  macos: MonitorIcon,
  watchos: WatchIcon,
  unknown: DeviceIcon,
};

/** Which SDK a report came from — Web, iOS, macOS or watchOS. */
export function PlatformBadge({
  environment,
  className = "",
}: {
  environment: Partial<FeedbackEnvironment> | null | undefined;
  className?: string;
}) {
  const platform = platformOf(environment);
  const Icon = ICONS[platform.id];
  return (
    <span
      title={`Reported from ${platform.label}`}
      className={`inline-flex items-center gap-1 rounded border border-neutral-200 bg-neutral-50 px-1.5 py-0.5 text-[10px] font-medium text-neutral-600 ${className}`}
    >
      <Icon className="h-2.5 w-2.5" />
      {platform.label}
    </span>
  );
}
