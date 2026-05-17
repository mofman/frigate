import NavItem from "./NavItem";
import { IoIosWarning } from "react-icons/io";
import { Drawer, DrawerContent, DrawerTrigger } from "../ui/drawer";
import useSWR from "swr";
import { FrigateStats } from "@/types/stats";
import { useEmbeddingsReindexProgress, useFrigateStats } from "@/api/ws";
import { useContext, useEffect, useMemo } from "react";
import useStats from "@/hooks/use-stats";
import useNavigation, {
  ID_EXPLORE,
  ID_EXPORT,
  ID_LIVE,
  ID_REVIEW,
} from "@/hooks/use-navigation";
import {
  StatusBarMessagesContext,
  StatusMessage,
} from "@/context/statusbar-provider";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { isIOS, isMobile } from "react-device-detect";
import { isPWA } from "@/utils/isPWA";
import { useTranslation } from "react-i18next";
import { Bell, Tags } from "lucide-react";
import { NavData } from "@/types/navigation";

function Bottombar() {
  const navItems = useNavigation("secondary");
  const staticNavItems = useMemo<NavData[]>(() => {
    const linkMap = new Map(navItems.map((item) => [item.id, item]));
    const live = linkMap.get(ID_LIVE);
    const review = linkMap.get(ID_REVIEW);
    const explore = linkMap.get(ID_EXPLORE);
    const exportLink = linkMap.get(ID_EXPORT);

    return [
      live,
      review,
      explore,
      {
        id: 100,
        variant: "secondary",
        icon: Bell,
        title: "Alerts",
        label: "Alerts",
        url: "/review",
      },
      exportLink,
      {
        id: 101,
        variant: "secondary",
        icon: Tags,
        title: "Labels",
        label: "Labels",
        url: "/explore",
      },
    ].filter(Boolean) as NavData[];
  }, [navItems]);

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 flex h-16 flex-row items-center justify-around border-t border-[rgba(203,213,225,0.11)] bg-[linear-gradient(180deg,rgba(12,12,22,0.58),rgba(12,12,22,0.82))] px-2 shadow-[0_-18px_38px_rgba(18,24,38,0.24)] backdrop-blur-xl md:hidden",
        isPWA && isIOS
          ? "portrait:items-start portrait:pt-1 landscape:items-center"
          : "items-center",
        isMobile && !isPWA && "h-16",
      )}
    >
      {staticNavItems.map((item) => (
        <NavItem
          key={item.id}
          className="h-14 w-14 p-0"
          item={item}
          Icon={item.icon}
          disableTooltip
        />
      ))}
      <StatusAlertNav className="hidden" />
    </div>
  );
}

type StatusAlertNavProps = {
  className?: string;
};
function StatusAlertNav({ className }: StatusAlertNavProps) {
  const { t } = useTranslation(["views/system"]);
  const { data: initialStats } = useSWR<FrigateStats>("stats", {
    revalidateOnFocus: false,
  });
  const latestStats = useFrigateStats();

  const { messages, addMessage, clearMessages } = useContext(
    StatusBarMessagesContext,
  )!;

  const stats = useMemo(() => {
    if (latestStats) {
      return latestStats;
    }

    return initialStats;
  }, [initialStats, latestStats]);
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

  if (!messages || Object.keys(messages).length === 0) {
    return;
  }

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <div className="p-2">
          <IoIosWarning className="size-5 text-danger md:m-[6px]" />
        </div>
      </DrawerTrigger>
      <DrawerContent
        className={cn(
          "mx-1 max-h-[75dvh] overflow-hidden rounded-t-2xl px-2",
          className,
        )}
      >
        <div className="scrollbar-container flex h-auto w-full flex-col items-center gap-2 overflow-y-auto overflow-x-hidden py-4">
          {Object.entries(messages).map(([key, messageArray]) => (
            <div key={key} className="flex w-full items-center gap-2">
              {messageArray.map(({ id, text, color, link }: StatusMessage) => {
                const message = (
                  <div key={id} className="flex items-center gap-2 text-xs">
                    <IoIosWarning
                      className={`size-5 ${color || "text-danger"}`}
                    />
                    {text}
                  </div>
                );

                if (link) {
                  return (
                    <Link key={id} to={link}>
                      {message}
                    </Link>
                  );
                } else {
                  return message;
                }
              })}
            </div>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export default Bottombar;
