import { ENV } from "@/env";
import { FrigateConfig } from "@/types/frigateConfig";
import { NavData } from "@/types/navigation";
import { useMemo } from "react";
import { isDesktop } from "react-device-detect";
import {
  Clock3,
  Construction,
  Download,
  MessageSquare,
  Monitor,
  ScanFace,
  Search,
  Shapes,
} from "lucide-react";
import useSWR from "swr";
import { useIsAdmin } from "./use-is-admin";
import { ReviewSegment } from "@/types/review";

export const ID_LIVE = 1;
export const ID_REVIEW = 2;
export const ID_EXPLORE = 3;
export const ID_EXPORT = 4;
export const ID_PLAYGROUND = 5;
export const ID_FACE_LIBRARY = 6;
export const ID_CLASSIFICATION = 7;
export const ID_CHAT = 8;

export default function useNavigation(
  variant: "primary" | "secondary" = "primary",
) {
  const { data: config } = useSWR<FrigateConfig>("config", {
    revalidateOnFocus: false,
  });
  const { data: unreviewedAlerts } = useSWR<ReviewSegment[]>([
    "review",
    {
      limit: 10,
      severity: "alert",
      reviewed: 0,
    },
  ]);
  const isAdmin = useIsAdmin();

  const hasChatAgent = useMemo(
    () =>
      Object.values(config?.genai ?? {}).some((agent) =>
        agent?.roles?.includes("chat"),
      ),
    [config?.genai],
  );

  return useMemo(
    () =>
      [
        {
          id: ID_LIVE,
          variant,
          icon: Monitor,
          title: "menu.live.title",
          label: "Cameras",
          url: "/",
        },
        {
          id: ID_REVIEW,
          variant,
          icon: Clock3,
          title: "menu.review",
          label: "Events",
          url: "/review",
          badge: unreviewedAlerts?.length,
        },
        {
          id: ID_EXPLORE,
          variant,
          icon: Search,
          title: "menu.explore",
          label: "Search",
          url: "/explore",
        },
        {
          id: ID_EXPORT,
          variant,
          icon: Download,
          title: "menu.export",
          label: "Exports",
          url: "/export",
        },
        {
          id: ID_PLAYGROUND,
          variant,
          icon: Construction,
          title: "menu.uiPlayground",
          url: "/playground",
          enabled: ENV !== "production",
        },
        {
          id: ID_FACE_LIBRARY,
          variant,
          icon: ScanFace,
          title: "menu.faceLibrary",
          url: "/faces",
          enabled: isDesktop && config?.face_recognition.enabled && isAdmin,
        },
        {
          id: ID_CLASSIFICATION,
          variant,
          icon: Shapes,
          title: "menu.classification",
          url: "/classification",
          enabled: isDesktop && isAdmin,
        },
        {
          id: ID_CHAT,
          variant,
          icon: MessageSquare,
          title: "menu.chat",
          url: "/chat",
          enabled: isDesktop && isAdmin && hasChatAgent,
        },
      ] as NavData[],
    [
      config?.face_recognition?.enabled,
      hasChatAgent,
      variant,
      isAdmin,
      unreviewedAlerts?.length,
    ],
  );
}
