import { useEmbeddingsReindexProgress } from "@/api/ws";
import {
  StatusBarMessagesContext,
  StatusMessage,
} from "@/context/statusbar-provider";
import useStats, { useAutoFrigateStats } from "@/hooks/use-stats";
import { cn } from "@/lib/utils";
import type { ProfilesApiResponse } from "@/types/profile";
import { getProfileColor } from "@/utils/profileColors";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useContext, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";

import { FaCheck } from "react-icons/fa";
import { IoIosWarning } from "react-icons/io";
import { Link } from "react-router-dom";

export default function Statusbar() {
  const { t } = useTranslation(["views/system"]);
  const isAdmin = useIsAdmin();

  const { messages, addMessage, clearMessages } = useContext(
    StatusBarMessagesContext,
  )!;

  const stats = useAutoFrigateStats();

  const cpuPercent = useMemo(() => {
    const systemCpu = stats?.cpu_usages["frigate.full_system"]?.cpu;

    if (!systemCpu || systemCpu == "0.0") {
      return null;
    }

    return parseInt(systemCpu);
  }, [stats]);

  const gpuPercent = useMemo(() => {
    const entries = Object.entries(stats?.gpu_usages || {}).filter(
      ([name]) => name !== "error-gpu",
    );
    const firstGpu = entries
      .map(([_, gpuStats]) => parseInt(gpuStats.gpu))
      .find((gpu) => !isNaN(gpu));

    return firstGpu ?? null;
  }, [stats]);

  const storagePercent = useMemo(() => {
    const storage = stats?.service.storage;
    if (!storage) {
      return null;
    }

    const storageStats =
      storage["/media/frigate"] ??
      Object.entries(storage).find(([path]) => path !== "/dev/shm")?.[1];

    if (!storageStats?.total) {
      return null;
    }

    return Math.round((storageStats.used / storageStats.total) * 100);
  }, [stats]);

  const uptime = useMemo(() => {
    const seconds = stats?.service.uptime;
    if (!seconds) {
      return null;
    }

    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);

    if (days > 0) {
      return `${days}d ${hours}h`;
    }

    return `${hours}h`;
  }, [stats]);

  const statusDate = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date()),
    [],
  );

  const { potentialProblems } = useStats(stats);

  useEffect(() => {
    clearMessages("stats");
    potentialProblems.forEach((problem) => {
      addMessage(
        "stats",
        problem.text,
        problem.color,
        undefined,
        problem.relevantLink,
      );
    });
  }, [potentialProblems, addMessage, clearMessages]);

  const { data: profilesData } = useSWR<ProfilesApiResponse>("profiles");

  const activeProfile = useMemo(() => {
    if (!profilesData?.active_profile || !profilesData.profiles) return null;
    const info = profilesData.profiles.find(
      (p) => p.name === profilesData.active_profile,
    );
    const allNames = profilesData.profiles.map((p) => p.name).sort();
    return {
      name: profilesData.active_profile,
      friendlyName: info?.friendly_name ?? profilesData.active_profile,
      color: getProfileColor(profilesData.active_profile, allNames),
    };
  }, [profilesData]);

  const { payload: reindexState } = useEmbeddingsReindexProgress();

  useEffect(() => {
    if (reindexState) {
      if (reindexState.status == "indexing") {
        clearMessages("embeddings-reindex");
        addMessage(
          "embeddings-reindex",
          t("stats.reindexingEmbeddings", {
            processed: Math.floor(
              (reindexState.processed_objects / reindexState.total_objects) *
                100,
            ),
          }),
        );
      }
      if (reindexState.status === "completed") {
        clearMessages("embeddings-reindex");
      }
    }
  }, [reindexState, addMessage, clearMessages, t]);

  return (
    <div className="absolute bottom-0 left-[72px] right-0 z-10 hidden h-10 items-center justify-between border-t border-white/10 bg-[#0a0e11] px-5 text-slate-400 md:flex">
      <div className="flex h-full min-w-0 items-center gap-2.5">
        {cpuPercent && (
          <Link to="/system#general">
            <StatusChip
              label="CPU"
              value={`${cpuPercent}%`}
              level={cpuPercent}
            />
          </Link>
        )}
        {gpuPercent !== null && (
          <Link to="/system#general">
            <StatusChip
              label="GPU"
              value={`${gpuPercent}%`}
              level={gpuPercent}
            />
          </Link>
        )}
        {storagePercent !== null && (
          <Link to="/system#storage">
            <StatusChip
              label="Storage"
              value={`${storagePercent}%`}
              level={storagePercent}
            />
          </Link>
        )}
        {uptime && <StatusChip label="Uptime" value={uptime} />}
        {activeProfile &&
          (isAdmin ? (
            <Link to="/settings?page=profiles">
              <div className="hidden cursor-pointer items-center gap-1.5 rounded border border-white/10 bg-[#131820] px-2.5 py-[3px] text-[11px] leading-none hover:bg-[#19212b] xl:flex">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    activeProfile.color.dot,
                  )}
                />
                <span className="max-w-[150px] truncate">
                  {activeProfile.friendlyName}
                </span>
              </div>
            </Link>
          ) : (
            <div className="hidden items-center gap-1.5 rounded border border-white/10 bg-[#131820] px-2.5 py-[3px] text-[11px] leading-none xl:flex">
              <span
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  activeProfile.color.dot,
                )}
              />
              <span className="max-w-[150px] truncate">
                {activeProfile.friendlyName}
              </span>
            </div>
          ))}
      </div>
      <div className="no-scrollbar flex h-full max-w-[50%] items-center gap-3 overflow-x-auto">
        {Object.entries(messages).length === 0 ? (
          <div className="flex items-center gap-2 text-xs font-medium text-sky-300">
            <FaCheck className="size-3 drop-shadow" />
            {t("stats.healthy")}
          </div>
        ) : (
          Object.entries(messages).map(([key, messageArray]) => (
            <div key={key} className="flex h-full items-center gap-2">
              {messageArray.map(({ text, color, link }: StatusMessage) => {
                const message = (
                  <div
                    key={text}
                    className={`flex items-center gap-2 whitespace-nowrap text-xs ${link ? "cursor-pointer hover:underline" : ""}`}
                  >
                    <IoIosWarning
                      className={`size-5 ${color || "text-danger"}`}
                    />
                    {text}
                  </div>
                );

                if (link) {
                  return (
                    <Link key={text} to={link}>
                      {message}
                    </Link>
                  );
                } else {
                  return message;
                }
              })}
            </div>
          ))
        )}
        <span className="hidden font-mono text-[11px] text-slate-600 md:block">
          {statusDate}
        </span>
      </div>
    </div>
  );
}

function StatusChip({
  label,
  value,
  level,
}: {
  label: string;
  value: string;
  level?: number;
}) {
  const dotColor =
    level == undefined
      ? "bg-sky-300 shadow-sky-300/30"
      : level < 50
        ? "bg-sky-300 shadow-sky-300/30"
        : level < 80
          ? "bg-amber-400 shadow-amber-400/30"
          : "bg-red-500 shadow-red-500/30";

  return (
    <div className="flex cursor-pointer items-center gap-1.5 rounded border border-white/10 bg-[#131820] px-2.5 py-[3px] leading-none hover:bg-[#19212b]">
      <span className={cn("size-1.5 rounded-full shadow", dotColor)} />
      <span className="hidden text-[10px] font-medium uppercase tracking-[0.04em] text-slate-500 sm:inline">
        {label}
      </span>
      <span className="font-mono text-[11px] font-medium text-slate-300">
        {value}
      </span>
    </div>
  );
}
