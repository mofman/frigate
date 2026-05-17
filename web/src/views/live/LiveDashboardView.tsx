import { useFrigateReviews } from "@/api/ws";
import { useUserPersistence } from "@/hooks/use-user-persistence";
import {
  AllGroupsStreamingSettings,
  CameraConfig,
  FrigateConfig,
} from "@/types/frigateConfig";
import { ReviewSegment } from "@/types/review";
import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isDesktop, isMobileOnly } from "react-device-detect";
import useSWR from "swr";
import DraggableGridLayout from "./DraggableGridLayout";
import { cn } from "@/lib/utils";
import {
  AudioState,
  LivePlayerError,
  StatsState,
  VolumeState,
} from "@/types/live";
import useCameraLiveMode from "@/hooks/use-camera-live-mode";
import { useStreamingSettings } from "@/context/streaming-settings-provider";
import { useTranslation } from "react-i18next";
import { EmptyCard } from "@/components/card/EmptyCard";
import { BsFillCameraVideoOffFill } from "react-icons/bs";
import { AuthContext } from "@/context/auth-context";
import { useIsAdmin } from "@/hooks/use-is-admin";
import LiveDashboardHeader from "./LiveDashboardHeader";
import LiveDashboardActivityPanel from "./LiveDashboardActivityPanel";
import {
  LiveDashboardBirdseyeTile,
  LiveDashboardCameraTile,
} from "./LiveDashboardCameraTile";

type LiveDashboardViewProps = {
  cameras: CameraConfig[];
  cameraGroup: string;
  includeBirdseye: boolean;
  onSelectCamera: (camera: string) => void;
  supportsFullscreen: boolean;
  fullscreen: boolean;
  toggleFullscreen: () => void;
};
export default function LiveDashboardView({
  cameras,
  cameraGroup,
  includeBirdseye,
  onSelectCamera,
  supportsFullscreen,
  fullscreen,
  toggleFullscreen,
}: LiveDashboardViewProps) {
  const { data: config } = useSWR<FrigateConfig>("config");

  // layout

  const [mobileLayout] = useUserPersistence<"grid" | "list">(
    "live-layout",
    isDesktop ? "grid" : "list",
  );

  const [isEditMode, setIsEditMode] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const birdseyeContainerRef = useRef<HTMLDivElement>(null);

  // recent events

  const eventUpdate = useFrigateReviews();

  const alertCameras = useMemo(() => {
    if (!config) {
      return null;
    }

    if (cameraGroup == "default") {
      return Object.values(config.cameras)
        .filter((cam) => cam.ui.dashboard)
        .map((cam) => cam.name)
        .join(",");
    }

    if (includeBirdseye && cameras.length == 0) {
      return Object.values(config.cameras)
        .filter((cam) => cam.birdseye.enabled)
        .map((cam) => cam.name)
        .join(",");
    }

    return cameras
      .map((cam) => cam.name)
      .filter((cam) => config.camera_groups[cameraGroup]?.cameras.includes(cam))
      .join(",");
  }, [cameras, cameraGroup, config, includeBirdseye]);

  const { data: allEvents, mutate: updateEvents } = useSWR<ReviewSegment[]>([
    "review",
    {
      limit: 10,
      reviewed: 0,
      cameras: alertCameras,
    },
  ]);

  useEffect(() => {
    if (!eventUpdate) {
      return;
    }

    if (
      eventUpdate.type == "end" ||
      eventUpdate.type == "new" ||
      eventUpdate.type == "genai"
    ) {
      setTimeout(() => updateEvents(), eventUpdate.type == "end" ? 1000 : 6000);
    } else if (
      eventUpdate.before.data.objects.length <
      eventUpdate.after.data.objects.length
    ) {
      setTimeout(() => updateEvents(), 5000);
    }
  }, [eventUpdate, updateEvents]);

  const events = useMemo(() => {
    if (!allEvents) {
      return [];
    }

    return allEvents.slice(0, 10);
  }, [allEvents]);

  // camera live views

  const [windowVisible, setWindowVisible] = useState(true);
  const visibilityListener = useCallback(() => {
    setWindowVisible(document.visibilityState == "visible");
  }, []);

  useEffect(() => {
    addEventListener("visibilitychange", visibilityListener);

    return () => {
      removeEventListener("visibilitychange", visibilityListener);
    };
  }, [visibilityListener]);

  const [visibleCameras, setVisibleCameras] = useState<string[]>([]);
  const visibleCameraObserver = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const visibleCameras = new Set<string>();
    visibleCameraObserver.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const camera = (entry.target as HTMLElement).dataset.camera;

          if (!camera) {
            return;
          }

          if (entry.isIntersecting) {
            visibleCameras.add(camera);
          } else {
            visibleCameras.delete(camera);
          }

          setVisibleCameras([...visibleCameras]);
        });
      },
      { threshold: 0.5 },
    );

    return () => {
      visibleCameraObserver.current?.disconnect();
    };
  }, []);

  const [globalAutoLive] = useUserPersistence("autoLiveView", true);
  const [displayCameraNames] = useUserPersistence("displayCameraNames", false);

  const { allGroupsStreamingSettings, setAllGroupsStreamingSettings } =
    useStreamingSettings();

  const currentGroupStreamingSettings = useMemo(() => {
    if (cameraGroup && cameraGroup != "default" && allGroupsStreamingSettings) {
      return allGroupsStreamingSettings[cameraGroup];
    }
  }, [allGroupsStreamingSettings, cameraGroup]);

  const cameraRef = useCallback(
    (node: HTMLElement | null) => {
      if (!visibleCameraObserver.current) {
        return;
      }

      try {
        if (node) visibleCameraObserver.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    // we need to listen on the value of the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleCameraObserver.current],
  );

  const activeStreams = useMemo(() => {
    const streams: { [cameraName: string]: string } = {};
    cameras.forEach((camera) => {
      const availableStreams = camera.live.streams || {};
      const streamNameFromSettings =
        currentGroupStreamingSettings?.[camera.name]?.streamName || "";
      const streamExists =
        streamNameFromSettings &&
        Object.values(availableStreams).includes(streamNameFromSettings);

      const streamName = streamExists
        ? streamNameFromSettings
        : Object.values(availableStreams)[0] || "";

      streams[camera.name] = streamName;
    });
    return streams;
  }, [cameras, currentGroupStreamingSettings]);

  const {
    preferredLiveModes,
    setPreferredLiveModes,
    resetPreferredLiveMode,
    isRestreamedStates,
    supportsAudioOutputStates,
    streamMetadata,
  } = useCameraLiveMode(cameras, windowVisible, activeStreams);

  const birdseyeConfig = useMemo(() => config?.birdseye, [config]);

  const handleError = useCallback(
    (cameraName: string, error: LivePlayerError) => {
      setPreferredLiveModes((prevModes) => {
        const newModes = { ...prevModes };
        if (error === "mse-decode") {
          newModes[cameraName] = "webrtc";
        } else {
          newModes[cameraName] = "jsmpeg";
        }
        return newModes;
      });
    },
    [setPreferredLiveModes],
  );

  // audio states

  const [audioStates, setAudioStates] = useState<AudioState>({});
  const [volumeStates, setVolumeStates] = useState<VolumeState>({});
  const [statsStates, setStatsStates] = useState<StatsState>({});

  const toggleStats = (cameraName: string): void => {
    setStatsStates((prev) => ({
      ...prev,
      [cameraName]: !prev[cameraName],
    }));
  };

  useEffect(() => {
    if (!allGroupsStreamingSettings) {
      return;
    }

    const initialAudioStates: AudioState = {};
    const initialVolumeStates: VolumeState = {};

    Object.entries(allGroupsStreamingSettings).forEach(([_, groupSettings]) => {
      if (groupSettings) {
        Object.entries(groupSettings).forEach(([camera, cameraSettings]) => {
          initialAudioStates[camera] = cameraSettings.playAudio ?? false;
          initialVolumeStates[camera] = cameraSettings.volume ?? 1;
        });
      }
    });

    setAudioStates(initialAudioStates);
    setVolumeStates(initialVolumeStates);
  }, [allGroupsStreamingSettings]);

  const toggleAudio = (cameraName: string): void => {
    setAudioStates((prev) => ({
      ...prev,
      [cameraName]: !prev[cameraName],
    }));
  };

  const onSaveMuting = useCallback(
    (playAudio: boolean) => {
      if (
        !cameraGroup ||
        !allGroupsStreamingSettings ||
        cameraGroup == "default"
      ) {
        return;
      }

      const existingGroupSettings =
        allGroupsStreamingSettings[cameraGroup] || {};

      const updatedSettings: AllGroupsStreamingSettings = {
        ...Object.fromEntries(
          Object.entries(allGroupsStreamingSettings || {}).filter(
            ([key]) => key !== cameraGroup,
          ),
        ),
        [cameraGroup]: {
          ...existingGroupSettings,
          ...Object.fromEntries(
            Object.entries(existingGroupSettings).map(
              ([cameraName, settings]) => [
                cameraName,
                {
                  ...settings,
                  playAudio: playAudio,
                },
              ],
            ),
          ),
        },
      };

      setAllGroupsStreamingSettings?.(updatedSettings);
    },
    [cameraGroup, allGroupsStreamingSettings, setAllGroupsStreamingSettings],
  );

  const muteAll = (): void => {
    const updatedStates: Record<string, boolean> = {};
    visibleCameras.forEach((cameraName) => {
      updatedStates[cameraName] = false;
    });
    setAudioStates(updatedStates);
    onSaveMuting(false);
  };

  const unmuteAll = (): void => {
    const updatedStates: Record<string, boolean> = {};
    visibleCameras.forEach((cameraName) => {
      updatedStates[cameraName] = true;
    });
    setAudioStates(updatedStates);
    onSaveMuting(true);
  };

  return (
    <div
      className="flex size-full select-none flex-col overflow-y-auto overflow-x-hidden pb-16 text-slate-100 md:overflow-hidden md:pb-0"
      ref={containerRef}
      style={{
        background:
          "radial-gradient(circle at 48% -20%, rgba(90, 167, 255, 0.09), transparent 34%), linear-gradient(180deg, rgba(18, 24, 32, 0.98), #08090b 46%), #08090b",
      }}
    >
      {cameras.length == 0 && !includeBirdseye ? (
        <NoCameraView cameraGroup={cameraGroup} />
      ) : !cameraGroup || cameraGroup == "default" || isMobileOnly ? (
        <div className="flex min-h-0 flex-1 flex-col md:overflow-hidden">
          <LiveDashboardHeader
            cameraCount={cameras.length + (includeBirdseye ? 1 : 0)}
            fullscreen={fullscreen}
            supportsFullscreen={supportsFullscreen}
            toggleFullscreen={toggleFullscreen}
          />
          <div
            className={cn(
              "grid min-h-0 flex-1 grid-cols-1 overflow-visible max-[899px]:content-start md:overflow-hidden",
              !fullscreen &&
                "min-[900px]:grid-cols-[minmax(0,1fr)_240px] xl:grid-cols-[minmax(0,1fr)_300px]",
            )}
          >
            {!fullscreen && (
              <LiveDashboardActivityPanel
                events={events}
                selectedGroup={cameraGroup}
              />
            )}
            <div className="scrollbar-container min-h-0 overflow-visible md:overflow-y-auto">
              <div
                className={cn(
                  "grid grid-cols-1 content-start gap-2 p-2.5 md:grid-cols-2 md:gap-3 md:p-3 min-[900px]:p-4",
                )}
              >
                {includeBirdseye && birdseyeConfig?.enabled && (
                  <LiveDashboardBirdseyeTile
                    className={(() => {
                      const aspectRatio =
                        birdseyeConfig.width / birdseyeConfig.height;
                      if (aspectRatio > 2) {
                        return cn(
                          "aspect-video",
                          mobileLayout == "grid" && "md:col-span-2",
                          "md:aspect-wide",
                        );
                      } else if (aspectRatio < 1) {
                        return cn(
                          "aspect-video",
                          mobileLayout == "grid" && "md:row-span-2 md:h-full",
                          "md:aspect-tall",
                        );
                      } else {
                        return "aspect-video";
                      }
                    })()}
                    birdseyeConfig={birdseyeConfig}
                    containerRef={birdseyeContainerRef}
                    onSelectCamera={onSelectCamera}
                  />
                )}
                {cameras.map((camera) => {
                  const aspectRatio =
                    camera.detect.width / camera.detect.height;
                  const tileClass =
                    aspectRatio > 2
                      ? cn(
                          "aspect-video",
                          mobileLayout == "grid" && "md:col-span-2",
                          "md:aspect-wide",
                        )
                      : aspectRatio < 1
                        ? cn(
                            "aspect-video",
                            mobileLayout == "grid" && "md:row-span-2 md:h-full",
                            "md:aspect-tall",
                          )
                        : "aspect-video";

                  return (
                    <LiveDashboardCameraTile
                      key={camera.name}
                      className={tileClass}
                      camera={camera}
                      cameraGroup={cameraGroup}
                      config={config}
                      cameraRef={cameraRef}
                      windowVisible={windowVisible}
                      visible={visibleCameras.includes(camera.name)}
                      preferredLiveMode={
                        preferredLiveModes[camera.name] ?? "mse"
                      }
                      isRestreamed={isRestreamedStates[camera.name]}
                      supportsAudioOutputStates={supportsAudioOutputStates}
                      audioStates={audioStates}
                      volumeStates={volumeStates}
                      statsStates={statsStates}
                      currentGroupStreamingSettings={
                        currentGroupStreamingSettings
                      }
                      globalAutoLive={globalAutoLive ?? true}
                      displayCameraNames={displayCameraNames ?? false}
                      toggleAudio={toggleAudio}
                      toggleStats={toggleStats}
                      setVolumeStates={setVolumeStates}
                      muteAll={muteAll}
                      unmuteAll={unmuteAll}
                      resetPreferredLiveMode={resetPreferredLiveMode}
                      onSelectCamera={onSelectCamera}
                      onError={handleError}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <DraggableGridLayout
          cameras={cameras}
          cameraGroup={cameraGroup}
          containerRef={containerRef}
          cameraRef={cameraRef}
          includeBirdseye={includeBirdseye}
          onSelectCamera={onSelectCamera}
          windowVisible={windowVisible}
          visibleCameras={visibleCameras}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          fullscreen={fullscreen}
          toggleFullscreen={toggleFullscreen}
          preferredLiveModes={preferredLiveModes}
          setPreferredLiveModes={setPreferredLiveModes}
          resetPreferredLiveMode={resetPreferredLiveMode}
          isRestreamedStates={isRestreamedStates}
          supportsAudioOutputStates={supportsAudioOutputStates}
          streamMetadata={streamMetadata}
        />
      )}
    </div>
  );
}

function NoCameraView({ cameraGroup }: { cameraGroup?: string }) {
  const { t } = useTranslation(["views/live"]);
  const { auth } = useContext(AuthContext);
  const isAdmin = useIsAdmin();

  const isDefault = cameraGroup === "default";
  const isRestricted = !isAdmin && auth.isAuthenticated;

  let type: "default" | "group" | "restricted";
  if (isRestricted) {
    type = "restricted";
  } else if (isDefault) {
    type = "default";
  } else {
    type = "group";
  }

  return (
    <div className="flex size-full items-center justify-center">
      <EmptyCard
        icon={<BsFillCameraVideoOffFill className="size-8" />}
        title={t(`noCameras.${type}.title`)}
        description={t(`noCameras.${type}.description`)}
        buttonText={
          type !== "restricted" && isDefault
            ? t(`noCameras.${type}.buttonText`)
            : undefined
        }
        link={
          type !== "restricted" && isDefault
            ? "/settings?page=cameraManagement"
            : undefined
        }
      />
    </div>
  );
}
