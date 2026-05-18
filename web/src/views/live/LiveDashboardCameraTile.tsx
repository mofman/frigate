import LiveContextMenu from "@/components/menu/LiveContextMenu";
import BirdseyeLivePlayer from "@/components/player/BirdseyeLivePlayer";
import LivePlayer from "@/components/player/LivePlayer";
import { useRecordingsState } from "@/api/ws";
import { useCameraActivity } from "@/hooks/use-camera-activity";
import { useCameraFriendlyName } from "@/hooks/use-camera-friendly-name";
import {
  useCurrentTimestamp,
  useFormattedTimestamp,
  useTimeFormat,
  useTimezone,
} from "@/hooks/use-date-utils";
import { cn } from "@/lib/utils";
import {
  AllGroupsStreamingSettings,
  BirdseyeConfig,
  CameraConfig,
  FrigateConfig,
} from "@/types/frigateConfig";
import {
  AudioState,
  LivePlayerError,
  LivePlayerMode,
  StatsState,
  VolumeState,
} from "@/types/live";
import {
  downloadSnapshot,
  fetchCameraSnapshot,
  generateSnapshotFilename,
} from "@/utils/snapshotUtil";
import { getIconForLabel } from "@/utils/iconUtil";
import { Camera, CircleDot, Expand, User, Zap } from "lucide-react";
import { MutableRefObject, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

type LiveDashboardCameraTileProps = {
  camera: CameraConfig;
  cameraGroup: string;
  config?: FrigateConfig;
  className?: string;
  cameraRef: (node: HTMLElement | null) => void;
  windowVisible: boolean;
  visible: boolean;
  preferredLiveMode: LivePlayerMode;
  isRestreamed?: boolean;
  supportsAudioOutputStates: Record<
    string,
    { supportsAudio: boolean; cameraName: string }
  >;
  audioStates: AudioState;
  volumeStates: VolumeState;
  statsStates: StatsState;
  currentGroupStreamingSettings?: AllGroupsStreamingSettings[string];
  globalAutoLive: boolean;
  displayCameraNames: boolean;
  toggleAudio: (cameraName: string) => void;
  toggleStats: (cameraName: string) => void;
  setVolumeStates: React.Dispatch<React.SetStateAction<VolumeState>>;
  muteAll: () => void;
  unmuteAll: () => void;
  resetPreferredLiveMode: (cameraName: string) => void;
  onSelectCamera: (cameraName: string) => void;
  onError: (cameraName: string, error: LivePlayerError) => void;
};

export function LiveDashboardCameraTile({
  camera,
  cameraGroup,
  config,
  className,
  cameraRef,
  windowVisible,
  visible,
  preferredLiveMode,
  isRestreamed,
  supportsAudioOutputStates,
  audioStates,
  volumeStates,
  statsStates,
  currentGroupStreamingSettings,
  globalAutoLive,
  displayCameraNames,
  toggleAudio,
  toggleStats,
  setVolumeStates,
  muteAll,
  unmuteAll,
  resetPreferredLiveMode,
  onSelectCamera,
  onError,
}: LiveDashboardCameraTileProps) {
  const { t } = useTranslation(["common"]);
  const availableStreams = camera.live.streams || {};
  const firstStreamEntry = Object.values(availableStreams)[0] || "";
  const streamNameFromSettings =
    currentGroupStreamingSettings?.[camera.name]?.streamName || "";
  const streamExists =
    streamNameFromSettings &&
    Object.values(availableStreams).includes(streamNameFromSettings);
  const streamName = streamExists ? streamNameFromSettings : firstStreamEntry;
  const streamType = currentGroupStreamingSettings?.[camera.name]?.streamType;
  const autoLive =
    streamType !== undefined ? streamType !== "no-streaming" : undefined;
  const showStillWithoutActivity =
    currentGroupStreamingSettings?.[camera.name]?.streamType !== "continuous";
  const useWebGL =
    currentGroupStreamingSettings?.[camera.name]?.compatibilityMode || false;
  const cameraName = useCameraFriendlyName(camera);
  const { activeMotion, activeTracking, objects } = useCameraActivity(camera);
  const { payload: recordState, send: sendRecord } = useRecordingsState(
    camera.name,
  );

  const primaryObject = objects.find((object) => !object.stationary);
  const personCount = objects.filter(
    (object) => !object.stationary && object.label === "person",
  ).length;
  const hasActivity = activeMotion || activeTracking || !!primaryObject;
  const activityType = primaryObject?.label ?? (activeMotion ? "motion" : null);
  const detectionLabel =
    personCount > 0
      ? `${personCount} ${personCount === 1 ? "person" : "people"}`
      : activityType === "motion"
        ? "Motion"
        : activityType
          ? activityType
          : null;
  const activityIsMotion = activityType === "motion";
  const currentTimestamp = useCurrentTimestamp();
  const timeFormat = useTimeFormat(config);
  const timezone = useTimezone(config);
  const now = useFormattedTimestamp(
    currentTimestamp,
    t(`time.formattedTimestampHourMinuteSecond.${timeFormat}`),
    timezone,
  );
  const recordingEnabled = camera.record.enabled_in_config;

  const handleSnapshot = useCallback(async () => {
    const result = await fetchCameraSnapshot(camera.name);

    if (result.success) {
      downloadSnapshot(
        result.data.dataUrl,
        generateSnapshotFilename(camera.name),
      );
      toast.success("Snapshot download started");
    } else {
      toast.error("Snapshot capture failed");
    }
  }, [camera.name]);

  return (
    <LiveContextMenu
      className={cn(
        "group relative overflow-hidden rounded-lg border border-[rgba(203,213,225,0.11)] bg-[#131820] shadow-[0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[rgba(169,182,186,0.26)] hover:shadow-2xl hover:shadow-black/30",
        hasActivity &&
          "border-amber-500/60 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]",
        className,
      )}
      camera={camera.name}
      cameraGroup={cameraGroup}
      streamName={streamName}
      preferredLiveMode={preferredLiveMode}
      isRestreamed={isRestreamed ?? false}
      supportsAudio={
        supportsAudioOutputStates[streamName]?.supportsAudio ?? false
      }
      audioState={audioStates[camera.name]}
      toggleAudio={() => toggleAudio(camera.name)}
      statsState={statsStates[camera.name]}
      toggleStats={() => toggleStats(camera.name)}
      volumeState={volumeStates[camera.name] ?? 1}
      setVolumeState={(value) =>
        setVolumeStates((prev) => ({
          ...prev,
          [camera.name]: value,
        }))
      }
      muteAll={muteAll}
      unmuteAll={unmuteAll}
      resetPreferredLiveMode={() => resetPreferredLiveMode(camera.name)}
      config={config}
    >
      <LivePlayer
        cameraRef={cameraRef}
        key={camera.name}
        className="size-full rounded-none bg-black outline-offset-0 [&_*]:md:rounded-none"
        windowVisible={windowVisible && visible}
        cameraConfig={camera}
        preferredLiveMode={preferredLiveMode}
        autoLive={autoLive ?? globalAutoLive}
        showStillWithoutActivity={showStillWithoutActivity ?? true}
        alwaysShowCameraName={displayCameraNames}
        useWebGL={useWebGL}
        playInBackground={false}
        showStats={statsStates[camera.name]}
        streamName={streamName}
        onClick={() => onSelectCamera(camera.name)}
        onError={(e) => onError(camera.name, e)}
        onResetLiveMode={() => resetPreferredLiveMode(camera.name)}
        playAudio={audioStates[camera.name] ?? false}
        volume={volumeStates[camera.name]}
        hideActivityIndicator
      />
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-[rgba(5,8,10,0.78)] to-transparent px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            className={cn(
              "size-[7px] shrink-0 rounded-full shadow-[0_0_8px_rgba(125,183,255,0.2)]",
              hasActivity ? "bg-[#ffb454]" : "bg-[#7db7ff]",
            )}
          />
          <span className="truncate text-[13px] font-semibold text-white shadow-black drop-shadow">
            {cameraName}
          </span>
        </div>
        <span className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[11px] text-white/60 backdrop-blur">
          {now}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex items-end justify-between bg-gradient-to-t from-[rgba(5,8,10,0.82)] to-transparent px-3 py-2">
        <div className="flex min-w-0 gap-1.5">
          {detectionLabel && (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium backdrop-blur-xl",
                activityIsMotion
                  ? "border-amber-300/25 bg-amber-400/10 text-[#ffb454]"
                  : "border-[#5aa7ff]/25 bg-[#5aa7ff]/10 text-[#b9d8ff]",
              )}
            >
              {activityIsMotion ? (
                <Zap className="size-3" />
              ) : primaryObject ? (
                getIconForLabel(primaryObject.label, "object", "size-3")
              ) : (
                <User className="size-3" />
              )}
              {detectionLabel}
            </span>
          )}
        </div>

        <div className="pointer-events-auto flex gap-1">
          <button
            className="flex size-[30px] items-center justify-center rounded border border-white/10 bg-[rgba(10,15,18,0.72)] text-white/70 backdrop-blur-xl transition-colors hover:bg-[rgba(31,42,48,0.86)] hover:text-white"
            type="button"
            aria-label={`Take snapshot from ${cameraName}`}
            onClick={(event) => {
              event.stopPropagation();
              handleSnapshot();
            }}
          >
            <Camera className="size-3.5" />
          </button>
          <button
            className={cn(
              "flex size-[30px] items-center justify-center rounded border border-white/10 bg-[rgba(10,15,18,0.72)] text-white/70 backdrop-blur-xl transition-colors hover:bg-[rgba(31,42,48,0.86)] hover:text-white disabled:cursor-not-allowed disabled:opacity-45",
              recordState === "ON" && "border-red-400/30 text-red-300",
            )}
            type="button"
            aria-label={`Record ${cameraName}`}
            disabled={!recordingEnabled}
            onClick={(event) => {
              event.stopPropagation();
              sendRecord(recordState === "ON" ? "OFF" : "ON");
            }}
          >
            <CircleDot className="size-3.5" />
          </button>
          <button
            className="flex size-[30px] items-center justify-center rounded border border-white/10 bg-[rgba(10,15,18,0.72)] text-white/70 backdrop-blur-xl transition-colors hover:bg-[rgba(31,42,48,0.86)] hover:text-white"
            type="button"
            aria-label={`Expand ${cameraName}`}
            onClick={(event) => {
              event.stopPropagation();
              onSelectCamera(camera.name);
            }}
          >
            <Expand className="size-3.5" />
          </button>
        </div>
      </div>
    </LiveContextMenu>
  );
}

type LiveDashboardBirdseyeTileProps = {
  birdseyeConfig: BirdseyeConfig;
  className?: string;
  containerRef: MutableRefObject<HTMLDivElement | null>;
  onSelectCamera: (cameraName: string) => void;
};

export function LiveDashboardBirdseyeTile({
  birdseyeConfig,
  className,
  containerRef,
  onSelectCamera,
}: LiveDashboardBirdseyeTileProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border border-[rgba(203,213,225,0.11)] bg-[#131820] shadow-[0_1px_0_rgba(255,255,255,0.03)] transition hover:border-[rgba(169,182,186,0.26)] hover:shadow-2xl hover:shadow-black/30",
        className,
      )}
      ref={containerRef}
    >
      <BirdseyeLivePlayer
        birdseyeConfig={birdseyeConfig}
        liveMode={birdseyeConfig.restream ? "mse" : "jsmpeg"}
        onClick={() => onSelectCamera("birdseye")}
        containerRef={containerRef}
      />
    </div>
  );
}
