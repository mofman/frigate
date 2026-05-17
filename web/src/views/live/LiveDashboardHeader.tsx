import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { LayoutGrid, Maximize2, Minimize2, Square } from "lucide-react";
import { useTranslation } from "react-i18next";

type LiveDashboardHeaderProps = {
  cameraCount: number;
  fullscreen: boolean;
  supportsFullscreen?: boolean;
  toggleFullscreen: () => void;
  className?: string;
};

export default function LiveDashboardHeader({
  cameraCount,
  fullscreen,
  supportsFullscreen = true,
  toggleFullscreen,
  className,
}: LiveDashboardHeaderProps) {
  const { t } = useTranslation(["common", "views/live"]);

  return (
    <header
      className={cn(
        "flex shrink-0 items-center justify-between border-b border-[rgba(203,213,225,0.11)] bg-[rgba(13,17,20,0.82)] px-4 py-[14px] backdrop-blur-xl md:px-6",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <h1 className="truncate text-lg font-semibold text-slate-100">
          Cameras
        </h1>
        <span className="rounded border border-[#7db7ff]/20 bg-[#7db7ff]/10 px-2 py-0.5 text-xs font-medium text-[#7db7ff]">
          {cameraCount} live
        </span>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#08090b] p-0.5">
          <button
            className="flex h-[26px] w-[30px] items-center justify-center rounded bg-[#19212b] p-0 text-slate-100 transition-colors"
            type="button"
            aria-label="Use grid layout"
          >
            <LayoutGrid className="size-3.5" />
          </button>
          <button
            className="flex h-[26px] w-[30px] items-center justify-center rounded bg-transparent p-0 text-[#647184] transition-colors hover:bg-[#19212b] hover:text-slate-300"
            type="button"
            aria-label="Use single camera layout"
            aria-disabled="true"
          >
            <Square className="size-3.5" />
          </button>
        </div>

        {supportsFullscreen && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                className="flex h-[34px] w-[34px] items-center justify-center rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#131820] p-0 text-[#647184] transition-colors hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100"
                type="button"
                aria-label={
                  fullscreen
                    ? t("button.exitFullscreen", { ns: "common" })
                    : t("button.fullscreen", { ns: "common" })
                }
                onClick={toggleFullscreen}
              >
                {fullscreen ? (
                  <Minimize2 className="size-4" />
                ) : (
                  <Maximize2 className="size-4" />
                )}
              </button>
            </TooltipTrigger>
            <TooltipContent>
              {fullscreen
                ? t("button.exitFullscreen", { ns: "common" })
                : t("button.fullscreen", { ns: "common" })}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </header>
  );
}
