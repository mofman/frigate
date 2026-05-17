import { IconType } from "react-icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isDesktop } from "react-device-detect";
import { cn } from "@/lib/utils";
import ActivityIndicator from "../indicators/activity-indicator";

const variants = {
  primary: {
    active:
      "border border-[#5aa7ff]/35 bg-[#131820] text-[#5aa7ff] hover:border-[#5aa7ff]/50 hover:bg-[#19212b]",
    inactive:
      "border border-[rgba(203,213,225,0.11)] bg-[#131820] text-[#647184] hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100",
    disabled:
      "cursor-not-allowed border border-[rgba(203,213,225,0.08)] bg-[#11161d] text-[#647184] opacity-45",
  },
  overlay: {
    active:
      "border border-[#5aa7ff]/35 bg-[rgba(19,24,32,0.82)] text-[#5aa7ff] backdrop-blur-xl hover:border-[#5aa7ff]/50 hover:bg-[#19212b]",
    inactive:
      "border border-[rgba(203,213,225,0.11)] bg-[rgba(19,24,32,0.82)] text-[#647184] backdrop-blur-xl hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100",
    disabled:
      "cursor-not-allowed border border-[rgba(203,213,225,0.08)] bg-[rgba(17,22,29,0.72)] text-[#647184] opacity-45",
  },
};

type CameraFeatureToggleProps = {
  className?: string;
  variant?: "primary" | "overlay";
  isActive: boolean;
  Icon: IconType;
  title: string;
  onClick?: () => void;
  disabled?: boolean;
  loading?: boolean;
};

export default function CameraFeatureToggle({
  className = "",
  variant = "primary",
  isActive,
  Icon,
  title,
  onClick,
  disabled = false,
  loading = false,
}: CameraFeatureToggleProps) {
  const content = (
    <div
      onClick={disabled ? undefined : onClick}
      className={cn(
        "flex h-[34px] w-[34px] flex-col items-center justify-center rounded-[4px] transition-colors",
        disabled
          ? variants[variant].disabled
          : variants[variant][isActive ? "active" : "inactive"],
        className,
      )}
    >
      {loading ? (
        <ActivityIndicator className="size-5 md:m-[6px]" />
      ) : (
        <Icon
          className={cn(
            "size-4",
            disabled
              ? "text-[#647184]"
              : isActive
                ? "text-current"
                : "text-current",
          )}
        />
      )}
    </div>
  );

  if (isDesktop) {
    return (
      <Tooltip>
        <TooltipTrigger disabled={disabled}>{content}</TooltipTrigger>
        <TooltipContent side="bottom">
          <p>{title}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}
