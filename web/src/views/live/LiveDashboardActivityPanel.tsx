import { useApiHost } from "@/api";
import { baseUrl } from "@/api/baseUrl";
import TimeAgo from "@/components/dynamic/TimeAgo";
import { useCameraPreviews } from "@/hooks/use-camera-previews";
import { cn } from "@/lib/utils";
import { REVIEW_PADDING, ReviewSegment, ThreatLevel } from "@/types/review";
import { getTranslatedLabel } from "@/utils/i18n";
import { getIconForLabel } from "@/utils/iconUtil";
import { formatList } from "@/utils/stringUtil";
import axios from "axios";
import { ArrowRight, Filter, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";

type LiveDashboardActivityPanelProps = {
  events: ReviewSegment[];
  selectedGroup?: string;
  className?: string;
};

export default function LiveDashboardActivityPanel({
  events,
  selectedGroup,
  className,
}: LiveDashboardActivityPanelProps) {
  const { t } = useTranslation(["views/events"]);

  return (
    <aside
      className={cn(
        "flex min-h-0 flex-col overflow-hidden border-[rgba(203,213,225,0.11)] bg-[#050607] max-[899px]:order-first max-[899px]:h-auto max-[899px]:self-start max-[899px]:border-b min-[900px]:order-last min-[900px]:w-[240px] min-[900px]:border-l min-[900px]:bg-[rgba(13,17,20,0.92)] xl:w-[300px]",
        className,
      )}
    >
      <div className="hidden h-[57px] shrink-0 items-center justify-between border-b border-[rgba(203,213,225,0.11)] px-4 min-[900px]:flex">
        <div className="flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold uppercase tracking-wide text-slate-100">
            Recent Activity
          </h2>
          <span className="font-mono text-[11px] text-slate-500">
            {events.length}
          </span>
        </div>
        <button
          className="flex h-7 w-7 items-center justify-center rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#131820] p-0 text-[#647184] transition-colors hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100"
          type="button"
          aria-label={t("filter", { ns: "common", defaultValue: "Filter" })}
          aria-disabled="true"
        >
          <Filter className="size-3.5" />
        </button>
      </div>

      <div className="scrollbar-container flex flex-none gap-3 overflow-x-auto overflow-y-hidden px-3 py-2.5 min-[900px]:min-h-0 min-[900px]:flex-1 min-[900px]:flex-col min-[900px]:gap-2.5 min-[900px]:overflow-y-auto min-[900px]:overflow-x-hidden min-[900px]:p-3">
        {events.length === 0 ? (
          <div className="flex h-24 shrink-0 items-center justify-center rounded-md border border-white/10 px-4 text-center text-xs text-slate-500 min-[900px]:h-full">
            {t("noRecordingsFoundForThisTime", {
              defaultValue: "No recent activity",
            })}
          </div>
        ) : (
          events.map((event) => (
            <ActivityItem
              key={event.id}
              event={event}
              selectedGroup={selectedGroup}
            />
          ))
        )}
      </div>

      <Link
        className="hidden shrink-0 items-center justify-center gap-2 border-t border-[rgba(203,213,225,0.11)] px-4 py-3 text-xs font-medium text-[#5aa7ff] transition hover:bg-[#5aa7ff]/10 hover:text-sky-100 min-[900px]:flex"
        to={
          selectedGroup && selectedGroup !== "default"
            ? `/review?group=${selectedGroup}`
            : "/review"
        }
      >
        View all events
        <ArrowRight className="size-3.5" />
      </Link>
    </aside>
  );
}

type ActivityItemProps = {
  event: ReviewSegment;
  selectedGroup?: string;
};

function ActivityItem({ event, selectedGroup }: ActivityItemProps) {
  const { t } = useTranslation(["views/events"]);
  const apiHost = useApiHost();
  const navigate = useNavigate();

  const label = useMemo(() => {
    if (event.data.metadata?.title) {
      return event.data.metadata.title;
    }

    const labels = [
      ...new Set([
        ...(event.data.objects || []),
        ...(event.data.sub_labels || []),
        ...(event.data.audio || []),
      ]),
    ].filter((item) => item !== undefined && !item.includes("-verified"));

    if (labels.length === 0) {
      return t("motionOnly", { defaultValue: "Motion detected" });
    }

    return `${formatList(
      labels.map((text) => getTranslatedLabel(text, "object")).sort(),
    )} ${t("detected")}`;
  }, [event, t]);

  const primaryLabel =
    event.data.objects?.[0] ||
    event.data.audio?.[0] ||
    event.data.sub_labels?.[0];
  const thumbPath = event.thumb_path?.replace("/media/frigate/", "");
  const isAlert =
    event.severity === "alert" ||
    event.data.metadata?.potential_threat_level ===
      ThreatLevel.SECURITY_CONCERN;

  const onOpenReview = () => {
    const url =
      selectedGroup && selectedGroup !== "default"
        ? `review?group=${selectedGroup}`
        : "review";
    navigate(url, {
      state: {
        severity: event.severity,
        recording: {
          camera: event.camera,
          startTime: event.start_time - REVIEW_PADDING,
          severity: event.severity,
        },
      },
    });
    axios.post(`reviews/viewed`, { ids: [event.id] });
  };

  return (
    <button
      className={cn(
        "group relative flex aspect-video w-[clamp(150px,22vw,220px)] shrink-0 overflow-hidden rounded-md border border-[rgba(203,213,225,0.11)] bg-[#111] text-left transition hover:border-[rgba(203,213,225,0.11)] hover:bg-[#111] min-[900px]:aspect-auto min-[900px]:w-full min-[900px]:gap-2 min-[900px]:border-transparent min-[900px]:bg-transparent min-[900px]:p-1.5 min-[900px]:hover:bg-[#19212b] xl:gap-3 xl:p-2",
        isAlert && "border-amber-400/20 bg-amber-400/5 hover:bg-amber-400/10",
      )}
      onClick={onOpenReview}
      onAuxClick={(e) => {
        if (e.button === 1) {
          window.open(`${baseUrl}review?id=${event.id}`, "_blank")?.focus();
        }
      }}
    >
      <div className="relative size-full overflow-hidden rounded-lg bg-black min-[900px]:h-[72px] min-[900px]:w-[112px] min-[900px]:shrink-0 min-[900px]:border min-[900px]:border-[rgba(203,213,225,0.11)] xl:h-[86px] xl:w-[138px]">
        <ActivityPreview
          event={event}
          thumbnailUrl={thumbPath ? `${apiHost}${thumbPath}` : undefined}
        />
        <span
          className={cn(
            "absolute left-2 top-2 flex size-5 items-center justify-center rounded bg-[#647184]/70 text-white shadow backdrop-blur min-[900px]:left-auto min-[900px]:right-1 min-[900px]:top-1",
            event.severity === "alert" &&
              "min-[900px]:bg-amber-400 min-[900px]:text-white",
            event.severity === "detection" &&
              "min-[900px]:bg-sky-500 min-[900px]:text-white",
          )}
        >
          {primaryLabel ? (
            getIconForLabel(primaryLabel, "object", "size-3")
          ) : (
            <Zap className="size-3" />
          )}
        </span>
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent p-2 min-[900px]:hidden">
          <span className="text-xs font-semibold text-white">
            <TimeAgo time={event.start_time * 1000} dense />
          </span>
        </div>
      </div>

      <div className="hidden min-w-0 flex-col justify-center gap-0.5 min-[900px]:flex">
        <span className="line-clamp-2 text-xs font-semibold leading-snug text-slate-100 xl:text-[13px]">
          {label}
        </span>
        <span className="truncate text-[11px] text-slate-300">
          {event.camera.replaceAll("_", " ")}
        </span>
        <span className="font-mono text-[10px] text-slate-500">
          <TimeAgo time={event.start_time * 1000} dense />
        </span>
      </div>
    </button>
  );
}

type ActivityPreviewProps = {
  event: ReviewSegment;
  thumbnailUrl?: string;
};

function ActivityPreview({ event, thumbnailUrl }: ActivityPreviewProps) {
  const [windowVisible, setWindowVisible] = useState(true);
  const [videoFailed, setVideoFailed] = useState(false);
  const previewRange = useMemo(
    () => ({
      after: Math.round(event.start_time),
      before: Math.round(event.end_time || event.start_time + 20),
    }),
    [event.end_time, event.start_time],
  );
  const previews = useCameraPreviews(previewRange, {
    camera: event.camera,
    autoRefresh: false,
  });
  const preview = previews?.[previews.length - 1];

  useEffect(() => {
    setVideoFailed(false);
  }, [event.id]);

  useEffect(() => {
    const visibilityListener = () => {
      setWindowVisible(document.visibilityState == "visible");
    };

    addEventListener("visibilitychange", visibilityListener);

    return () => removeEventListener("visibilitychange", visibilityListener);
  }, []);

  if (windowVisible && !videoFailed && preview) {
    return (
      <video
        className="size-full rounded-lg object-contain"
        preload="metadata"
        autoPlay
        playsInline
        muted
        loop
        onError={() => setVideoFailed(true)}
      >
        <source
          src={`${baseUrl}${preview.src.substring(1)}`}
          type={preview.type}
        />
      </video>
    );
  }

  if (windowVisible && !videoFailed) {
    return (
      <video
        className="size-full rounded-lg object-contain"
        preload="metadata"
        autoPlay
        playsInline
        muted
        loop
        poster={thumbnailUrl}
        onError={() => setVideoFailed(true)}
      >
        <source
          src={`${baseUrl}api/review/${event.id}/preview?format=mp4`}
          type="video/mp4"
        />
      </video>
    );
  }

  return thumbnailUrl ? (
    <img
      className="size-full rounded-lg object-contain"
      src={thumbnailUrl}
      loading="lazy"
      alt=""
    />
  ) : null;
}
