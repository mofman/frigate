import ReviewCard from "@/components/card/ReviewCard";
import ReviewFilterGroup from "@/components/filter/ReviewFilterGroup";
import {
  useAudioState,
  useAudioTranscriptionState,
  useAutotrackingState,
  useDetectState,
  useEnabledState,
  useRecordingsState,
  useSnapshotsState,
} from "@/api/ws";
import CameraFeatureToggle from "@/components/dynamic/CameraFeatureToggle";
import DebugReplayDialog from "@/components/overlay/DebugReplayDialog";
import ExportDialog from "@/components/overlay/ExportDialog";
import ActionsDropdown from "@/components/overlay/ActionsDropdown";
import PreviewPlayer, {
  PreviewController,
} from "@/components/player/PreviewPlayer";
import { DynamicVideoController } from "@/components/player/dynamic/DynamicVideoController";
import DynamicVideoPlayer from "@/components/player/dynamic/DynamicVideoPlayer";
import LivePlayer from "@/components/player/LivePlayer";
import MotionReviewTimeline from "@/components/timeline/MotionReviewTimeline";
import DetailStream from "@/components/timeline/DetailStream";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useOverlayState } from "@/hooks/use-overlay-state";
import { useResizeObserver } from "@/hooks/resize-observer";
import { ExportMode } from "@/types/filter";
import { CameraConfig, FrigateConfig } from "@/types/frigateConfig";
import { Preview } from "@/types/preview";
import {
  MotionData,
  RecordingsSummary,
  REVIEW_PADDING,
  ReviewFilter,
  ReviewSegment,
  ReviewSummary,
  ZoomLevel,
} from "@/types/review";
import { findChunkIndex, getChunkedTimeDay } from "@/utils/timelineUtil";
import {
  MutableRefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  isDesktop,
  isFirefox,
  isIOS,
  isMobile,
  isMobileOnly,
  isTablet,
} from "react-device-detect";
import { IoMdArrowRoundBack } from "react-icons/io";
import {
  FaCog,
  FaCompress,
  FaExpand,
  FaMicrophone,
  FaMicrophoneSlash,
} from "react-icons/fa";
import { GiSpeaker, GiSpeakerOff } from "react-icons/gi";
import { LuPictureInPicture } from "react-icons/lu";
import { TbCameraDown, TbRecordMail, TbRecordMailOff } from "react-icons/tb";
import { useLocation, useNavigate } from "react-router-dom";
import { TransformComponent, TransformWrapper } from "react-zoom-pan-pinch";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import useSWR from "swr";
import { TimeRange, TimelineType } from "@/types/timeline";
import MobileCameraDrawer from "@/components/overlay/MobileCameraDrawer";
import MobileTimelineDrawer from "@/components/overlay/MobileTimelineDrawer";
import MobileReviewSettingsDrawer from "@/components/overlay/MobileReviewSettingsDrawer";
import Logo from "@/components/Logo";
import { Skeleton } from "@/components/ui/skeleton";
import { FaVideo } from "react-icons/fa";
import {
  LivePlayerError,
  LivePlayerMode,
  LiveStreamMetadata,
  VideoResolutionType,
} from "@/types/live";
import {
  ASPECT_VERTICAL_LAYOUT,
  ASPECT_WIDE_LAYOUT,
  RecordingSegment,
  RecordingStartingPoint,
} from "@/types/record";
import { cn } from "@/lib/utils";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useIsAdmin } from "@/hooks/use-is-admin";
import { useSessionPersistence } from "@/hooks/use-session-persistence";
import { useTimezone } from "@/hooks/use-date-utils";
import { useTimelineZoom } from "@/hooks/use-timeline-zoom";
import { useUserPersistence } from "@/hooks/use-user-persistence";
import { useTranslation } from "react-i18next";
import { useTimelineUtils } from "@/hooks/use-timeline-utils";
import { useCameraActivity } from "@/hooks/use-camera-activity";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { CameraNameLabel } from "@/components/camera/FriendlyNameLabel";
import { useAllowedCameras } from "@/hooks/use-allowed-cameras";
import { DetailStreamProvider } from "@/context/detail-stream-context";
import {
  GenAISummaryDialog,
  GenAISummaryChip,
} from "@/components/overlay/chip/GenAISummaryChip";
import ShareTimestampDialog from "@/components/overlay/ShareTimestampDialog";
import { shareOrCopy } from "@/utils/browserUtil";
import { detectCameraAudioFeatures } from "@/utils/cameraUtil";
import { createRecordingReviewUrl } from "@/utils/recordingReviewUrl";
import { getIconForLabel } from "@/utils/iconUtil";
import {
  downloadSnapshot,
  fetchCameraSnapshot,
  generateSnapshotFilename,
  grabVideoSnapshot,
  SnapshotResult,
} from "@/utils/snapshotUtil";
import { User, Zap } from "lucide-react";
import axios from "axios";

const DATA_REFRESH_TIME = 600000; // 10 minutes
const LIVE_EDGE_THRESHOLD = 5; // seconds

type RecordingViewProps = {
  startCamera: string;
  startTime: number;
  initialMode?: "live" | "recording";
  reviewItems?: ReviewSegment[];
  reviewSummary?: ReviewSummary;
  timeRange: TimeRange;
  allCameras: string[];
  allPreviews?: Preview[];
  filter?: ReviewFilter;
  updateFilter: (newFilter: ReviewFilter) => void;
  refreshData?: () => void;
  onSelectCamera?: (camera: string) => void;
};
export function RecordingView({
  startCamera,
  startTime,
  initialMode = "recording",
  reviewItems,
  reviewSummary,
  timeRange,
  allCameras,
  allPreviews,
  filter,
  updateFilter,
  refreshData,
  onSelectCamera: onSelectCameraProp,
}: RecordingViewProps) {
  const { t } = useTranslation(["views/events", "components/dialog"]);
  const { data: config } = useSWR<FrigateConfig>("config");
  const navigate = useNavigate();
  const location = useLocation();
  const contentRef = useRef<HTMLDivElement | null>(null);

  // recordings summary

  const timezone = useTimezone(config);

  const allowedCameras = useAllowedCameras();
  const effectiveCameras = useMemo(
    () => allCameras.filter((camera) => allowedCameras.includes(camera)),
    [allCameras, allowedCameras],
  );
  const [mainCamera, setMainCamera] = useState(startCamera);
  const [playbackMode, setPlaybackMode] = useState<"live" | "recording">(
    initialMode,
  );

  const { data: recordingsSummary } = useSWR<RecordingsSummary>([
    "recordings/summary",
    {
      timezone: timezone,
      cameras: mainCamera ?? null,
    },
  ]);

  // controller state

  const mainControllerRef = useRef<DynamicVideoController | null>(null);
  const mainLayoutRef = useRef<HTMLDivElement | null>(null);
  const cameraLayoutRef = useRef<HTMLDivElement | null>(null);
  const previewRowRef = useRef<HTMLDivElement | null>(null);
  const previewRefs = useRef<{ [camera: string]: PreviewController }>({});

  const [playbackStart, setPlaybackStart] = useState(
    initialMode == "live"
      ? timeRange.before - 30
      : startTime >= timeRange.after && startTime <= timeRange.before
        ? startTime
        : timeRange.before - 60,
  );

  const mainCameraReviewItems = useMemo(
    () => reviewItems?.filter((cam) => cam.camera == mainCamera) ?? [],
    [reviewItems, mainCamera],
  );

  // timeline

  const [recording] = useOverlayState<RecordingStartingPoint>(
    "recording",
    undefined,
    false,
  );

  const [timelineType, setTimelineType] = useOverlayState<TimelineType>(
    "timelineType",
    recording?.timelineType ?? "timeline",
  );

  const chunkedTimeRange = useMemo(
    () => getChunkedTimeDay(timeRange),
    [timeRange],
  );
  const [selectedRangeIdx, setSelectedRangeIdx] = useState(
    findChunkIndex(chunkedTimeRange, startTime),
  );
  const currentTimeRange = useMemo<TimeRange>(
    () =>
      chunkedTimeRange[selectedRangeIdx] ??
      chunkedTimeRange[chunkedTimeRange.length - 1],
    [selectedRangeIdx, chunkedTimeRange],
  );

  const reviewFilterList = useMemo(() => {
    const uniqueLabels = new Set<string>();

    reviewItems?.forEach((rev) => {
      rev.data.objects.forEach((obj) =>
        uniqueLabels.add(obj.replace("-verified", "")),
      );
      rev.data.audio.forEach((aud) => uniqueLabels.add(aud));
    });

    const uniqueZones = new Set<string>();

    reviewItems?.forEach((rev) => {
      rev.data.zones.forEach((zone) => uniqueZones.add(zone));
    });

    return { labels: [...uniqueLabels], zones: [...uniqueZones] };
  }, [reviewItems]);

  // export

  const [exportMode, setExportMode] = useState<ExportMode>("none");
  const [exportRange, setExportRange] = useState<TimeRange>();
  const [showExportPreview, setShowExportPreview] = useState(false);

  // debug replay

  const [debugReplayMode, setDebugReplayMode] = useState<ExportMode>("none");
  const [debugReplayRange, setDebugReplayRange] = useState<TimeRange>();
  const [shareTimestampOpen, setShareTimestampOpen] = useState(false);
  const [shareTimestampAtOpen, setShareTimestampAtOpen] = useState(
    Math.floor(startTime),
  );
  const [shareTimestampOption, setShareTimestampOption] = useState<
    "current" | "custom"
  >("current");
  const [customShareTimestamp, setCustomShareTimestamp] = useState(
    Math.floor(startTime),
  );

  // move to next clip

  const onClipEnded = useCallback(() => {
    if (!mainControllerRef.current) {
      return;
    }

    if (selectedRangeIdx < chunkedTimeRange.length - 1) {
      setSelectedRangeIdx(selectedRangeIdx + 1);
    }
  }, [selectedRangeIdx, chunkedTimeRange]);

  // visibility tracking for refreshing stale data

  const lastVisibilityTime = useRef<number>(Date.now());

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        const now = Date.now();
        const timeSinceLastVisible = now - lastVisibilityTime.current;

        // Only refresh if user was away for a while
        // and the video is not currently playing
        if (
          timeSinceLastVisible >= DATA_REFRESH_TIME &&
          refreshData &&
          mainControllerRef.current &&
          !mainControllerRef.current.isPlaying()
        ) {
          refreshData();
        }

        lastVisibilityTime.current = now;
      } else {
        lastVisibilityTime.current = Date.now();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshData]);

  // scrubbing and timeline state

  const [scrubbing, setScrubbing] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(
    initialMode == "live" ? timeRange.before : startTime,
  );
  const setCurrentTimeAndMode = useCallback(
    (time: number | ((previous: number) => number)) => {
      setCurrentTime((previous) => {
        const nextTime = typeof time == "function" ? time(previous) : time;
        const nextMode =
          timeRange.before - nextTime <= LIVE_EDGE_THRESHOLD
            ? "live"
            : "recording";

        setPlaybackMode(nextMode);
        setPlaybackStart(nextMode == "live" ? timeRange.before - 30 : nextTime);

        return nextTime;
      });
    },
    [timeRange.before],
  );
  const [playerTime, setPlayerTime] = useState(startTime);

  const updateSelectedSegment = useCallback(
    (currentTime: number, updateStartTime: boolean) => {
      const index = findChunkIndex(chunkedTimeRange, currentTime);

      if (index != -1) {
        if (updateStartTime) {
          setPlaybackStart(currentTime);
        }

        setSelectedRangeIdx(index);
      }
    },
    [chunkedTimeRange],
  );

  useEffect(() => {
    if (scrubbing || exportRange || debugReplayRange) {
      if (
        currentTime > currentTimeRange.before + 60 ||
        currentTime < currentTimeRange.after - 60
      ) {
        updateSelectedSegment(currentTime, false);
        return;
      }

      mainControllerRef.current?.scrubToTimestamp(currentTime);

      Object.values(previewRefs.current).forEach((controller) => {
        controller.scrubToTimestamp(currentTime);
      });
    }
    // we only want to seek when current time updates
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    currentTime,
    scrubbing,
    timeRange,
    currentTimeRange,
    updateSelectedSegment,
  ]);

  const manuallySetCurrentTime = useCallback(
    (time: number, play: boolean = false) => {
      if (!currentTimeRange) {
        return;
      }
      const nextPlaybackMode =
        timeRange.before - time <= LIVE_EDGE_THRESHOLD ? "live" : "recording";

      setPlaybackMode(nextPlaybackMode);
      setCurrentTime(time);
      setPlaybackStart(
        nextPlaybackMode == "live" ? timeRange.before - 30 : time,
      );

      if (nextPlaybackMode == "live") {
        mainControllerRef.current = null;
        return;
      }

      if (currentTimeRange.after <= time && currentTimeRange.before >= time) {
        mainControllerRef.current?.seekToTimestamp(time, play);
      } else {
        updateSelectedSegment(time, true);
      }
    },
    [currentTimeRange, timeRange.before, updateSelectedSegment],
  );

  const goLive = useCallback(() => {
    setPlaybackMode("live");
    mainControllerRef.current = null;
    setCurrentTime(timeRange.before);
    setPlaybackStart(timeRange.before - 30);
    updateSelectedSegment(timeRange.before, true);
  }, [timeRange.before, updateSelectedSegment]);

  const onShareReviewLink = useCallback(
    (timestamp: number) => {
      const reviewUrl = createRecordingReviewUrl(location.pathname, {
        camera: mainCamera,
        timestamp: Math.floor(timestamp),
      });

      shareOrCopy(
        reviewUrl,
        t("recording.shareTimestamp.shareTitle", {
          ns: "components/dialog",
          camera: mainCamera,
        }),
      );
    },
    [location.pathname, mainCamera, t],
  );

  const handleBack = useCallback(() => {
    // if we came from a direct share link, there is no history to go back to, so navigate to the homepage instead
    if (recording?.navigationSource === "shared-link") {
      navigate("/");
      return;
    }

    navigate(-1);
  }, [navigate, recording?.navigationSource]);

  useEffect(() => {
    if (playbackMode == "live") {
      return;
    }

    if (!scrubbing) {
      if (Math.abs(currentTime - playerTime) > 10) {
        if (
          currentTimeRange.after <= currentTime &&
          currentTimeRange.before >= currentTime
        ) {
          if (mainControllerRef.current != undefined) {
            let shouldPlayback = true;

            if (timelineType == "detail") {
              shouldPlayback = mainControllerRef.current.isPlaying();
            }

            mainControllerRef.current.seekToTimestamp(
              currentTime,
              shouldPlayback,
            );
          }
        } else {
          updateSelectedSegment(currentTime, true);
        }
      } else if (playerTime != currentTime && timelineType != "detail") {
        mainControllerRef.current?.play();
      }
    }
    // we only want to seek when current time doesn't match the player update time
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentTime, scrubbing]);

  const [fullResolution, setFullResolution] = useState<VideoResolutionType>({
    width: 0,
    height: 0,
  });

  const onSelectCamera = useCallback(
    (newCam: string) => {
      if (allowedCameras.includes(newCam)) {
        setMainCamera(newCam);
        onSelectCameraProp?.(newCam);
        setFullResolution({
          width: 0,
          height: 0,
        });
        setPlaybackStart(
          playbackMode == "live" ? timeRange.before - 30 : currentTime,
        );
      }
    },
    [
      currentTime,
      allowedCameras,
      onSelectCameraProp,
      playbackMode,
      timeRange.before,
    ],
  );

  useEffect(() => {
    if (playbackMode != "live") {
      return;
    }

    setCurrentTime(timeRange.before);
    setPlaybackStart(timeRange.before - 30);
    updateSelectedSegment(timeRange.before, true);
  }, [playbackMode, timeRange.before, updateSelectedSegment]);

  // fullscreen

  const { fullscreen, toggleFullscreen, supportsFullScreen } =
    useFullscreen(mainLayoutRef);

  // layout

  const getCameraAspect = useCallback(
    (cam: string) => {
      if (!config) {
        return undefined;
      }

      if (cam == mainCamera && fullResolution.width && fullResolution.height) {
        return fullResolution.width / fullResolution.height;
      }

      const camera = config.cameras[cam];

      if (!camera) {
        return undefined;
      }

      return camera.detect.width / camera.detect.height;
    },
    [config, fullResolution, mainCamera],
  );

  const mainCameraAspect = useMemo(() => {
    const aspectRatio = getCameraAspect(mainCamera);

    if (!aspectRatio) {
      return "normal";
    } else if (aspectRatio > ASPECT_WIDE_LAYOUT) {
      return "wide";
    } else if (aspectRatio < ASPECT_VERTICAL_LAYOUT) {
      return "tall";
    } else {
      return "normal";
    }
  }, [getCameraAspect, mainCamera]);

  const getLiveStreamName = useCallback(
    (camera: string) =>
      config?.cameras[camera]?.live.streams
        ? Object.values(config.cameras[camera].live.streams)[0]
        : "",
    [config],
  );

  const getPreferredLiveMode = useCallback(
    (camera: string): LivePlayerMode => {
      const streamName = getLiveStreamName(camera);
      const isRestreamed =
        streamName &&
        Object.keys(config?.go2rtc.streams || {}).includes(streamName);

      if (!("MediaSource" in window || "ManagedMediaSource" in window)) {
        return "webrtc";
      }

      return isRestreamed ? "mse" : "jsmpeg";
    },
    [config?.go2rtc.streams, getLiveStreamName],
  );

  const liveStreamName = useMemo(
    () => getLiveStreamName(mainCamera),
    [getLiveStreamName, mainCamera],
  );

  const mainCameraConfig = config?.cameras[mainCamera];

  const [streamName, setStreamName, streamNameLoaded] =
    useUserPersistence<string>(`${mainCamera}-stream`, liveStreamName);

  useEffect(() => {
    if (!streamNameLoaded || !mainCameraConfig) {
      return;
    }

    const availableStreams = Object.values(mainCameraConfig.live.streams || {});
    if (availableStreams.length === 0) {
      return;
    }

    if (streamName == null || !availableStreams.includes(streamName)) {
      setStreamName(availableStreams[0]);
    }
  }, [mainCameraConfig, setStreamName, streamName, streamNameLoaded]);

  const selectedLiveStreamName = useMemo(() => {
    if (!mainCameraConfig) {
      return "";
    }

    const availableStreams = Object.values(mainCameraConfig.live.streams || {});

    if (streamName && availableStreams.includes(streamName)) {
      return streamName;
    }

    return liveStreamName;
  }, [liveStreamName, mainCameraConfig, streamName]);

  const isRestreamed = useMemo(
    () =>
      !!selectedLiveStreamName &&
      Object.keys(config?.go2rtc.streams || {}).includes(
        selectedLiveStreamName,
      ),
    [config?.go2rtc.streams, selectedLiveStreamName],
  );

  const { data: cameraMetadata } = useSWR<LiveStreamMetadata>(
    isRestreamed ? `go2rtc/streams/${selectedLiveStreamName}` : null,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      revalidateIfStale: false,
      dedupingInterval: 60000,
    },
  );

  const { twoWayAudio: supports2WayTalk, audioOutput: supportsAudioOutput } =
    useMemo(() => detectCameraAudioFeatures(cameraMetadata), [cameraMetadata]);

  const [audio, setAudio] = useSessionPersistence("liveAudio", false);
  const [mic, setMic] = useState(false);
  const [pip, setPip] = useState(false);
  const [webRTC, setWebRTC] = useState(false);
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [playInBackground, setPlayInBackground] = useUserPersistence<boolean>(
    `${mainCamera}-background-play`,
    false,
  );
  const [showStats, setShowStats] = useState(false);

  useEffect(() => {
    const updatePip = () => setPip(document.pictureInPictureElement != null);

    updatePip();
    document.addEventListener("enterpictureinpicture", updatePip);
    document.addEventListener("leavepictureinpicture", updatePip);

    return () => {
      document.removeEventListener("enterpictureinpicture", updatePip);
      document.removeEventListener("leavepictureinpicture", updatePip);
    };
  }, []);

  const handleLivePlayerError = useCallback(
    (error: LivePlayerError) => {
      if (!error) {
        return;
      }

      if (!webRTC && config && config.go2rtc?.webrtc?.candidates?.length > 0) {
        setWebRTC(true);
      } else {
        setWebRTC(false);
        setLowBandwidth(true);
      }
    },
    [config, webRTC],
  );

  const preferredLiveMode = useMemo<LivePlayerMode>(() => {
    if (mic) {
      return "webrtc";
    }

    if (webRTC && isRestreamed) {
      return "webrtc";
    }

    if (webRTC && !isRestreamed) {
      return "jsmpeg";
    }

    if (lowBandwidth) {
      return "jsmpeg";
    }

    if (!("MediaSource" in window || "ManagedMediaSource" in window)) {
      return "webrtc";
    }

    return isRestreamed ? "mse" : "jsmpeg";
  }, [isRestreamed, lowBandwidth, mic, webRTC]);

  const preferredPreviewLiveModes = useMemo(() => {
    const modes: Record<string, LivePlayerMode> = {};

    effectiveCameras.forEach((camera) => {
      modes[camera] = getPreferredLiveMode(camera);
    });

    return modes;
  }, [effectiveCameras, getPreferredLiveMode]);

  const previewLiveStreamNames = useMemo(() => {
    const streamNames: Record<string, string> = {};

    effectiveCameras.forEach((camera) => {
      streamNames[camera] = getLiveStreamName(camera);
    });

    return streamNames;
  }, [effectiveCameras, getLiveStreamName]);

  const { activeMotion, activeTracking, objects } =
    useCameraActivity(mainCameraConfig);
  const primaryObject = objects.find((object) => !object.stationary);
  const personCount = objects.filter(
    (object) => !object.stationary && object.label === "person",
  ).length;
  const hasLiveActivity = activeMotion || activeTracking || !!primaryObject;
  const liveActivityType =
    primaryObject?.label ?? (activeMotion ? "motion" : null);
  const liveActivityLabel =
    personCount > 0
      ? `${personCount} ${personCount === 1 ? "person" : "people"}`
      : liveActivityType === "motion"
        ? "Motion"
        : liveActivityType;
  const liveActivityIsMotion = liveActivityType === "motion";

  const grow = useMemo(() => {
    if (mainCameraAspect == "wide") {
      return "w-full aspect-wide";
    } else if (mainCameraAspect == "tall") {
      if (isDesktop) {
        return "size-full aspect-tall flex flex-col justify-center";
      } else {
        return "size-full";
      }
    } else {
      return "w-full aspect-video";
    }
  }, [mainCameraAspect]);

  // use a resize observer to determine whether to use w-full or h-full based on container aspect ratio
  const [{ width: containerWidth, height: containerHeight }] =
    useResizeObserver(cameraLayoutRef);
  const [{ width: previewRowWidth, height: previewRowHeight }] =
    useResizeObserver(previewRowRef);

  const useHeightBased = useMemo(() => {
    if (!containerWidth || !containerHeight) {
      return false;
    }

    const cameraAspectRatio = getCameraAspect(mainCamera);
    if (!cameraAspectRatio) {
      return false;
    }

    // Calculate available space for camera after accounting for preview row
    // For tall cameras: preview row is side-by-side (takes width)
    // For wide/normal cameras: preview row is stacked (takes height)
    const availableWidth =
      mainCameraAspect == "tall" && previewRowWidth
        ? containerWidth - previewRowWidth
        : containerWidth;
    const availableHeight =
      mainCameraAspect != "tall" && previewRowHeight
        ? containerHeight - previewRowHeight
        : containerHeight;

    const availableAspectRatio = availableWidth / availableHeight;

    // If available space is wider than camera aspect, constrain by height (h-full)
    // If available space is taller than camera aspect, constrain by width (w-full)
    return availableAspectRatio >= cameraAspectRatio;
  }, [
    containerWidth,
    containerHeight,
    previewRowWidth,
    previewRowHeight,
    getCameraAspect,
    mainCamera,
    mainCameraAspect,
  ]);

  const previewRowOverflows = useMemo(() => {
    if (!previewRowRef.current) {
      return false;
    }

    return (
      previewRowRef.current.scrollWidth > previewRowRef.current.clientWidth ||
      previewRowRef.current.scrollHeight > previewRowRef.current.clientHeight
    );
    // we only want to update when the scroll size changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewRowRef.current?.scrollWidth, previewRowRef.current?.scrollHeight]);

  // visibility listener for lazy loading

  const [visiblePreviews, setVisiblePreviews] = useState<string[]>([]);
  const visiblePreviewObserver = useRef<IntersectionObserver | null>(null);
  useEffect(() => {
    const visibleCameras = new Set<string>();
    visiblePreviewObserver.current = new IntersectionObserver(
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

          setVisiblePreviews([...visibleCameras]);
        });
      },
      { threshold: 0.1 },
    );

    return () => {
      visiblePreviewObserver.current?.disconnect();
    };
  }, []);

  const previewRef = useCallback(
    (node: HTMLElement | null) => {
      if (!visiblePreviewObserver.current) {
        return;
      }

      try {
        if (node) visiblePreviewObserver.current.observe(node);
      } catch (e) {
        // no op
      }
    },
    // we need to listen on the value of the ref
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visiblePreviewObserver.current],
  );

  const activeReviewItem = useMemo(() => {
    if (!config?.cameras?.[mainCamera].review.genai?.enabled_in_config) {
      return undefined;
    }

    return mainCameraReviewItems.find(
      (rev) =>
        rev.start_time - REVIEW_PADDING < currentTime &&
        rev.end_time &&
        currentTime < rev.end_time + REVIEW_PADDING,
    );
  }, [config, currentTime, mainCameraReviewItems, mainCamera]);
  const onAnalysisOpen = useCallback(
    (open: boolean) => {
      if (open) {
        mainControllerRef.current?.pause();
      } else {
        mainControllerRef.current?.play();
      }
    },
    [mainControllerRef],
  );

  const toolbarButtonClass =
    "h-[34px] rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#131820] px-3 text-sm font-medium text-slate-200 transition-colors hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100";
  const toolbarIconClass = "size-4 text-[#647184]";
  const toolbarActiveClass =
    "border-[rgba(92,120,255,0.55)] bg-[#1a2540] text-slate-100 hover:border-[rgba(117,143,255,0.72)] hover:bg-[#202e52]";
  const toolbarToggleGroupClass =
    "*:h-[34px] *:rounded-[4px] *:border *:border-[rgba(203,213,225,0.11)] *:bg-[#131820] *:px-3 *:py-0 *:text-sm *:font-medium *:text-slate-500 *:transition-colors hover:*:border-[rgba(169,182,186,0.28)] hover:*:bg-[#222c38] hover:*:text-slate-100";
  const toolbarToggleActiveClass =
    "data-[state=on]:border-[rgba(92,120,255,0.55)] data-[state=on]:bg-[#1a2540] data-[state=on]:text-slate-100 data-[state=on]:hover:border-[rgba(117,143,255,0.72)] data-[state=on]:hover:bg-[#202e52]";

  return (
    <DetailStreamProvider
      isDetailMode={timelineType === "detail"}
      currentTime={currentTime}
      camera={mainCamera}
    >
      <div ref={contentRef} className="flex size-full flex-col bg-[#050607]">
        <Toaster closeButton={true} />
        <div className="relative flex w-full shrink-0 items-center justify-between border-b border-[rgba(203,213,225,0.11)] bg-[rgba(13,17,20,0.82)] px-4 py-[14px] backdrop-blur-xl md:px-6">
          {isMobile && (
            <Logo className="absolute inset-x-1/2 h-8 -translate-x-1/2" />
          )}
          <div className={cn("flex items-center gap-2")}>
            <Button
              className={`flex items-center gap-2 ${toolbarButtonClass}`}
              aria-label={t("label.back", { ns: "common" })}
              size="sm"
              onClick={handleBack}
            >
              <IoMdArrowRoundBack className={toolbarIconClass} />
              {isDesktop && (
                <div className="text-slate-200">
                  {t("button.back", { ns: "common" })}
                </div>
              )}
            </Button>
            <Button
              className={cn(
                "flex items-center gap-2",
                toolbarButtonClass,
                playbackMode == "live" && toolbarActiveClass,
              )}
              aria-label={t("menu.live.title", { ns: "common" })}
              size="sm"
              onClick={goLive}
            >
              <FaVideo
                className={cn(
                  toolbarIconClass,
                  playbackMode == "live" && "text-slate-100",
                )}
              />
              {isDesktop && (
                <div className="text-slate-200">
                  {t("menu.live.title", { ns: "common" })}
                </div>
              )}
            </Button>
          </div>
          <div className="flex items-center justify-end gap-2">
            <MobileCameraDrawer
              allCameras={effectiveCameras}
              selected={mainCamera}
              onSelectCamera={onSelectCamera}
            />
            {isDesktop && (
              <DebugReplayDialog
                camera={mainCamera}
                currentTime={currentTime}
                latestTime={timeRange.before}
                mode={debugReplayMode}
                range={debugReplayRange}
                setRange={(range: TimeRange | undefined) => {
                  setDebugReplayRange(range);

                  if (range != undefined) {
                    mainControllerRef.current?.pause();
                  }
                }}
                setMode={setDebugReplayMode}
              />
            )}
            {isDesktop && (
              <ExportDialog
                camera={mainCamera}
                currentTime={currentTime}
                latestTime={timeRange.before}
                mode={exportMode}
                range={exportRange}
                showPreview={showExportPreview}
                setRange={(range) => {
                  setExportRange(range);

                  if (range != undefined) {
                    mainControllerRef.current?.pause();
                  }
                }}
                setMode={setExportMode}
                setShowPreview={setShowExportPreview}
              />
            )}
            {isDesktop && (
              <ReviewFilterGroup
                filters={["cameras", "date", "general"]}
                reviewSummary={reviewSummary}
                recordingsSummary={recordingsSummary}
                filter={filter}
                motionOnly={false}
                filterList={reviewFilterList}
                showReviewed
                setShowReviewed={() => {}}
                mainCamera={mainCamera}
                triggerClassName={toolbarButtonClass}
                onUpdateFilter={(newFilter: ReviewFilter) => {
                  const updatedCameras =
                    newFilter.cameras === undefined
                      ? undefined // Respect undefined as "all cameras"
                      : newFilter.cameras
                        ? Array.from(
                            new Set([mainCamera, ...(newFilter.cameras || [])]),
                          ) // Include mainCamera if specific cameras are selected
                        : [mainCamera];
                  const adjustedFilter: ReviewFilter = {
                    ...newFilter,
                    cameras: updatedCameras,
                  };
                  updateFilter(adjustedFilter);
                }}
                setMotionOnly={() => {}}
              />
            )}
            {isDesktop && (
              <ShareTimestampDialog
                currentTime={shareTimestampAtOpen}
                open={shareTimestampOpen}
                onOpenChange={setShareTimestampOpen}
                selectedOption={shareTimestampOption}
                setSelectedOption={setShareTimestampOption}
                customTimestamp={customShareTimestamp}
                setCustomTimestamp={setCustomShareTimestamp}
                onShareTimestamp={onShareReviewLink}
              />
            )}
            {isDesktop && (
              <ActionsDropdown
                triggerClassName={toolbarButtonClass}
                onShareTimestampClick={() => {
                  const initialTimestamp = Math.floor(currentTime);

                  setShareTimestampAtOpen(initialTimestamp);
                  setShareTimestampOption("current");
                  setCustomShareTimestamp(initialTimestamp);
                  setShareTimestampOpen(true);
                }}
                onDebugReplayClick={() => {
                  setDebugReplayRange({
                    after: timeRange.before - 60,
                    before: timeRange.before,
                  });
                  setDebugReplayMode("select");
                }}
                onExportClick={() => {
                  const now = new Date(timeRange.before * 1000);
                  now.setHours(now.getHours() - 1);
                  setExportRange({
                    before: timeRange.before,
                    after: now.getTime() / 1000,
                  });
                  setExportMode("select");
                }}
              />
            )}
            {isDesktop ? (
              <ToggleGroup
                className={toolbarToggleGroupClass}
                type="single"
                size="sm"
                value={timelineType}
                onValueChange={(value: TimelineType) =>
                  value ? setTimelineType(value, true) : null
                } // don't allow the severity to be unselected
              >
                <ToggleGroupItem
                  className={toolbarToggleActiveClass}
                  value="timeline"
                  aria-label={t("timeline.aria")}
                >
                  <div className="">{t("timeline.label")}</div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  className={toolbarToggleActiveClass}
                  value="events"
                  aria-label={t("events.aria")}
                >
                  <div className="">{t("events.label")}</div>
                </ToggleGroupItem>
                <ToggleGroupItem
                  className={toolbarToggleActiveClass}
                  value="detail"
                  aria-label="Detail Stream"
                >
                  <div className="">{t("detail.label")}</div>
                </ToggleGroupItem>
              </ToggleGroup>
            ) : (
              <MobileTimelineDrawer
                selected={timelineType ?? "timeline"}
                onSelect={setTimelineType}
              />
            )}
            <MobileReviewSettingsDrawer
              camera={mainCamera}
              filter={filter}
              currentTime={currentTime}
              latestTime={timeRange.before}
              recordingsSummary={recordingsSummary}
              mode={exportMode}
              range={exportRange}
              showExportPreview={showExportPreview}
              allLabels={reviewFilterList.labels}
              allZones={reviewFilterList.zones}
              debugReplayMode={debugReplayMode}
              debugReplayRange={debugReplayRange}
              setDebugReplayMode={setDebugReplayMode}
              setDebugReplayRange={(range: TimeRange | undefined) => {
                setDebugReplayRange(range);

                if (range != undefined) {
                  mainControllerRef.current?.pause();
                }
              }}
              onShareTimestamp={onShareReviewLink}
              onUpdateFilter={updateFilter}
              setRange={setExportRange}
              setMode={setExportMode}
              setShowExportPreview={setShowExportPreview}
            />
          </div>
        </div>

        <div
          ref={mainLayoutRef}
          className={cn(
            "flex flex-1 overflow-hidden",
            isDesktop ? "flex-row" : "flex-col gap-2 landscape:flex-row",
          )}
        >
          <div
            ref={cameraLayoutRef}
            className={cn(
              "relative flex flex-1 flex-wrap overflow-hidden",
              isDesktop
                ? "min-w-0 px-4 py-4"
                : "portrait:max-h-[50dvh] portrait:flex-shrink-0 portrait:flex-grow-0 portrait:basis-auto",
            )}
          >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_34%,rgba(90,167,255,0.22),rgba(90,167,255,0.08)_34%,transparent_62%),radial-gradient(ellipse_at_50%_82%,rgba(15,23,42,0.88),transparent_54%),linear-gradient(90deg,rgba(5,6,7,0.98),rgba(13,17,20,0.18)_22%,rgba(13,17,20,0.18)_78%,rgba(5,6,7,0.98)),linear-gradient(180deg,rgba(19,24,32,0.64),rgba(5,6,7,0.98))]" />
            <div
              className={cn(
                "relative z-10 flex size-full items-center",
                mainCameraAspect == "tall"
                  ? "flex-row justify-evenly"
                  : "flex-col justify-center gap-2",
              )}
            >
              <div
                key={mainCamera}
                id="player-container"
                className={cn(
                  "relative flex max-h-full min-h-0 min-w-0 max-w-full items-center justify-center overflow-hidden rounded-lg border border-[rgba(203,213,225,0.11)] bg-[#131820] shadow-[0_1px_0_rgba(255,255,255,0.03)] transition",
                  playbackMode == "live" &&
                    hasLiveActivity &&
                    "border-amber-500/60 shadow-[inset_0_0_0_1px_rgba(245,158,11,0.14)]",
                  isDesktop
                    ? // Desktop: dynamically switch between w-full and h-full based on
                      // container vs camera aspect ratio to ensure proper fitting
                      useHeightBased
                      ? "h-full"
                      : "w-full"
                    : cn(
                        "flex-shrink-0 portrait:w-full landscape:h-full",
                        mainCameraAspect == "wide"
                          ? "aspect-wide"
                          : mainCameraAspect == "tall"
                            ? "aspect-tall portrait:h-full"
                            : "aspect-video",
                      ),
                )}
                style={{
                  aspectRatio: getCameraAspect(mainCamera),
                }}
              >
                {(isDesktop || isTablet) && (
                  <GenAISummaryDialog
                    review={activeReviewItem}
                    onOpen={onAnalysisOpen}
                  >
                    <GenAISummaryChip review={activeReviewItem} />
                  </GenAISummaryDialog>
                )}

                {playbackMode == "live" && config?.cameras[mainCamera] ? (
                  <>
                    <div className="pointer-events-none absolute left-3 top-3 z-30 flex items-center gap-2 rounded-[4px] border border-emerald-400/35 bg-emerald-500 px-2.5 py-1 text-[11px] font-semibold uppercase leading-none text-[#04140c] shadow-[0_0_24px_rgba(16,185,129,0.28)]">
                      <span className="size-1.5 animate-pulse rounded-full bg-[#04140c]" />
                      <span>Live Feed</span>
                    </div>
                    <TransformWrapper
                      minScale={1.0}
                      wheel={{ smoothStep: 0.005 }}
                    >
                      <TransformComponent
                        wrapperStyle={{
                          width: "100%",
                          height: "100%",
                        }}
                        contentStyle={{
                          position: "relative",
                          width: "100%",
                          height: "100%",
                        }}
                      >
                        <LivePlayer
                          key={`${mainCamera}-live`}
                          className="size-full rounded-none bg-black outline-offset-0 [&_*]:rounded-none"
                          windowVisible
                          showStillWithoutActivity={false}
                          alwaysShowCameraName={false}
                          cameraConfig={config.cameras[mainCamera]}
                          playAudio={audio}
                          playInBackground={playInBackground ?? false}
                          showStats={showStats}
                          micEnabled={mic}
                          preferredLiveMode={preferredLiveMode}
                          useWebGL={true}
                          streamName={selectedLiveStreamName}
                          pip={pip}
                          containerRef={mainLayoutRef}
                          setFullResolution={setFullResolution}
                          onError={handleLivePlayerError}
                          hideActivityIndicator
                        />
                      </TransformComponent>
                    </TransformWrapper>
                    {mainCameraConfig && (
                      <UnifiedLiveControls
                        camera={mainCameraConfig}
                        fullscreen={fullscreen}
                        supportsFullscreen={supportsFullScreen}
                        toggleFullscreen={toggleFullscreen}
                        preferredLiveMode={preferredLiveMode}
                        streamName={selectedLiveStreamName}
                        setStreamName={setStreamName}
                        isRestreamed={isRestreamed}
                        supportsAudioOutput={supportsAudioOutput}
                        supports2WayTalk={supports2WayTalk}
                        audio={audio ?? false}
                        setAudio={setAudio}
                        mic={mic}
                        setMic={setMic}
                        pip={pip}
                        setPip={setPip}
                        playInBackground={playInBackground ?? false}
                        setPlayInBackground={setPlayInBackground}
                        showStats={showStats}
                        setShowStats={setShowStats}
                        setLowBandwidth={setLowBandwidth}
                      />
                    )}
                    {hasLiveActivity && liveActivityLabel && (
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-end justify-between bg-gradient-to-t from-[rgba(5,8,10,0.82)] to-transparent px-3 py-2">
                        <div className="flex min-w-0 gap-1.5">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium backdrop-blur-xl",
                              liveActivityIsMotion
                                ? "border-amber-300/25 bg-amber-400/10 text-[#ffb454]"
                                : "border-[#5aa7ff]/25 bg-[#5aa7ff]/10 text-[#b9d8ff]",
                            )}
                          >
                            {liveActivityIsMotion ? (
                              <Zap className="size-3" />
                            ) : primaryObject ? (
                              getIconForLabel(
                                primaryObject.label,
                                "object",
                                "size-3",
                              )
                            ) : (
                              <User className="size-3" />
                            )}
                            {liveActivityLabel}
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <DynamicVideoPlayer
                    className={`${grow} rounded-none bg-black outline-offset-0 md:rounded-none`}
                    videoClassName="rounded-none md:rounded-none"
                    camera={mainCamera}
                    timeRange={currentTimeRange}
                    cameraPreviews={allPreviews ?? []}
                    startTimestamp={playbackStart}
                    hotKeys={
                      exportMode != "select" && debugReplayMode != "select"
                    }
                    fullscreen={fullscreen}
                    onTimestampUpdate={(timestamp) => {
                      setPlayerTime(timestamp);
                      setCurrentTime(timestamp);
                      Object.values(previewRefs.current ?? {}).forEach((prev) =>
                        prev.scrubToTimestamp(Math.floor(timestamp)),
                      );
                    }}
                    onClipEnded={onClipEnded}
                    onSeekToTime={manuallySetCurrentTime}
                    onControllerReady={(controller) => {
                      mainControllerRef.current = controller;
                    }}
                    isScrubbing={
                      scrubbing ||
                      exportMode == "timeline" ||
                      exportMode == "timeline_multi" ||
                      debugReplayMode == "timeline"
                    }
                    supportsFullscreen={supportsFullScreen}
                    setFullResolution={setFullResolution}
                    toggleFullscreen={toggleFullscreen}
                    containerRef={mainLayoutRef}
                  />
                )}
              </div>
              {isDesktop && effectiveCameras.length > 1 && (
                <div
                  ref={previewRowRef}
                  className={cn(
                    "scrollbar-container flex flex-shrink-0 gap-2 overflow-auto",
                    mainCameraAspect == "tall"
                      ? "ml-2 h-full w-72 min-w-72 flex-col"
                      : "h-28 min-h-28 w-full",
                    previewRowOverflows ? "" : "items-center justify-center",
                    timelineType == "detail" && isDesktop && "mt-4",
                  )}
                >
                  <div className="w-2" />
                  {effectiveCameras.map((cam) => {
                    if (cam == mainCamera || cam == "birdseye") {
                      return;
                    }

                    return (
                      <Tooltip key={cam}>
                        <TooltipTrigger asChild>
                          <div
                            ref={previewRef}
                            data-camera={cam}
                            className={
                              mainCameraAspect == "tall"
                                ? "w-full overflow-hidden rounded-lg border border-[rgba(203,213,225,0.11)] bg-[#131820]"
                                : "h-full overflow-hidden rounded-lg border border-[rgba(203,213,225,0.11)] bg-[#131820]"
                            }
                            style={{
                              aspectRatio: getCameraAspect(cam),
                            }}
                            onClick={() => onSelectCamera(cam)}
                          >
                            {playbackMode == "live" && config?.cameras[cam] ? (
                              <LivePlayer
                                key={`${cam}-live-preview`}
                                className="size-full cursor-pointer rounded-none bg-black outline-offset-0 [&_*]:rounded-none"
                                windowVisible={visiblePreviews.includes(cam)}
                                showStillWithoutActivity={false}
                                alwaysShowCameraName={false}
                                cameraConfig={config.cameras[cam]}
                                playAudio={false}
                                playInBackground={false}
                                preferredLiveMode={
                                  preferredPreviewLiveModes[cam] ?? "jsmpeg"
                                }
                                useWebGL={true}
                                streamName={previewLiveStreamNames[cam] ?? ""}
                                hideActivityIndicator
                              />
                            ) : (
                              <PreviewPlayer
                                className="size-full rounded-none bg-black outline-offset-0 md:rounded-none [&_*]:rounded-none"
                                camera={cam}
                                timeRange={currentTimeRange}
                                cameraPreviews={allPreviews ?? []}
                                startTime={currentTime}
                                isScrubbing={scrubbing}
                                isVisible
                                onControllerReady={(controller) => {
                                  previewRefs.current[cam] = controller;
                                  controller.scrubToTimestamp(currentTime);
                                }}
                              />
                            )}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent className="smart-capitalize">
                          <CameraNameLabel camera={cam} />
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                  <div className="w-2" />
                </div>
              )}
            </div>
          </div>
          <Timeline
            contentRef={contentRef}
            mainCamera={mainCamera}
            isLive={playbackMode == "live"}
            timelineType={
              (exportRange == undefined && debugReplayRange == undefined
                ? timelineType
                : "timeline") ?? "timeline"
            }
            timeRange={timeRange}
            mainCameraReviewItems={mainCameraReviewItems}
            activeReviewItem={activeReviewItem}
            currentTime={currentTime}
            exportRange={
              exportMode == "timeline" || exportMode == "timeline_multi"
                ? exportRange
                : debugReplayMode == "timeline"
                  ? debugReplayRange
                  : undefined
            }
            setCurrentTime={setCurrentTime}
            setCurrentTimeAndMode={setCurrentTimeAndMode}
            manuallySetCurrentTime={manuallySetCurrentTime}
            setScrubbing={setScrubbing}
            setExportRange={
              debugReplayMode == "timeline"
                ? setDebugReplayRange
                : setExportRange
            }
            onAnalysisOpen={onAnalysisOpen}
            isPlaying={mainControllerRef?.current?.isPlaying() ?? false}
          />
        </div>
      </div>
    </DetailStreamProvider>
  );
}

type UnifiedLiveControlsProps = {
  camera: CameraConfig;
  fullscreen: boolean;
  supportsFullscreen: boolean;
  toggleFullscreen: () => void;
  preferredLiveMode: LivePlayerMode;
  streamName: string;
  setStreamName: (value: string | undefined) => void;
  isRestreamed: boolean;
  supportsAudioOutput: boolean;
  supports2WayTalk: boolean;
  audio: boolean;
  setAudio: (value: boolean) => void;
  mic: boolean;
  setMic: (value: boolean) => void;
  pip: boolean;
  setPip: (value: boolean) => void;
  playInBackground: boolean;
  setPlayInBackground: (value: boolean | undefined) => void;
  showStats: boolean;
  setShowStats: (value: boolean) => void;
  setLowBandwidth: React.Dispatch<React.SetStateAction<boolean>>;
};

function UnifiedLiveControls({
  camera,
  fullscreen,
  supportsFullscreen,
  toggleFullscreen,
  preferredLiveMode,
  streamName,
  setStreamName,
  isRestreamed,
  supportsAudioOutput,
  supports2WayTalk,
  audio,
  setAudio,
  mic,
  setMic,
  pip,
  setPip,
  playInBackground,
  setPlayInBackground,
  showStats,
  setShowStats,
  setLowBandwidth,
}: UnifiedLiveControlsProps) {
  const { t } = useTranslation(["views/live", "components/dialog", "common"]);
  const { payload: enabledState } = useEnabledState(camera.name);
  const cameraEnabled = enabledState == "ON";
  const [isSnapshotLoading, setIsSnapshotLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const recordingEventIdRef = useRef<string | null>(null);
  const activeToastIdRef = useRef<string | number | null>(null);

  const createEvent = useCallback(async () => {
    try {
      const response = await axios.post(
        `events/${camera.name}/on_demand/create`,
        {
          include_recording: true,
          duration: null,
        },
      );

      if (response.data.success) {
        recordingEventIdRef.current = response.data.event_id;
        setIsRecording(true);
        activeToastIdRef.current = toast.success(t("manualRecording.started"), {
          position: "top-center",
          duration: 10000,
        });
      }
    } catch {
      toast.error(t("manualRecording.failedToStart"), {
        position: "top-center",
      });
    }
  }, [camera.name, t]);

  const endEvent = useCallback(() => {
    if (activeToastIdRef.current) {
      toast.dismiss(activeToastIdRef.current);
      activeToastIdRef.current = null;
    }

    try {
      if (recordingEventIdRef.current) {
        axios.put(`events/${recordingEventIdRef.current}/end`, {
          end_time: Math.ceil(Date.now() / 1000),
        });
        recordingEventIdRef.current = null;
        setIsRecording(false);
        toast.success(t("manualRecording.ended"), {
          position: "top-center",
        });
      }
    } catch {
      toast.error(t("manualRecording.failedToEnd"), {
        position: "top-center",
      });
    }
  }, [t]);

  useEffect(() => {
    return () => {
      if (recordingEventIdRef.current) {
        endEvent();
      }
    };
  }, [endEvent]);

  const handleEventButtonClick = useCallback(() => {
    if (isRecording) {
      endEvent();
    } else {
      createEvent();
    }
  }, [createEvent, endEvent, isRecording]);

  const handleSnapshotClick = useCallback(async () => {
    setIsSnapshotLoading(true);

    try {
      let result: SnapshotResult;

      if (isRestreamed && preferredLiveMode !== "jsmpeg") {
        result = await grabVideoSnapshot();
      } else {
        result = await fetchCameraSnapshot(camera.name);
      }

      if (result.success) {
        const filename = generateSnapshotFilename(camera.name);
        downloadSnapshot(result.data.dataUrl, filename);
        toast.success(t("snapshot.downloadStarted"));
      } else {
        toast.error(t("snapshot.captureFailed"));
      }
    } finally {
      setIsSnapshotLoading(false);
    }
  }, [camera.name, isRestreamed, preferredLiveMode, t]);

  return (
    <div className="absolute right-3 top-3 z-40 flex max-w-[calc(100%-8rem)] flex-wrap justify-end gap-2">
      {supportsFullscreen && (
        <CameraFeatureToggle
          variant={fullscreen ? "overlay" : "primary"}
          Icon={fullscreen ? FaCompress : FaExpand}
          isActive={fullscreen}
          title={
            fullscreen
              ? t("button.close", { ns: "common" })
              : t("button.fullscreen", { ns: "common" })
          }
          onClick={toggleFullscreen}
        />
      )}
      {!isIOS && !isFirefox && preferredLiveMode != "jsmpeg" && (
        <CameraFeatureToggle
          variant={fullscreen ? "overlay" : "primary"}
          Icon={LuPictureInPicture}
          isActive={pip}
          title={
            pip
              ? t("button.close", { ns: "common" })
              : t("button.pictureInPicture", { ns: "common" })
          }
          onClick={() => {
            if (pip) {
              document.exitPictureInPicture();
              setPip(false);
            } else {
              setPip(true);
            }
          }}
          disabled={!cameraEnabled}
        />
      )}
      {supports2WayTalk && (
        <CameraFeatureToggle
          variant={fullscreen ? "overlay" : "primary"}
          Icon={mic ? FaMicrophone : FaMicrophoneSlash}
          isActive={mic}
          title={
            mic
              ? t("twoWayTalk.disable", { ns: "views/live" })
              : t("twoWayTalk.enable", { ns: "views/live" })
          }
          onClick={() => {
            setMic(!mic);
            if (!mic && !audio) {
              setAudio(true);
            }
          }}
          disabled={!cameraEnabled}
        />
      )}
      {supportsAudioOutput && preferredLiveMode != "jsmpeg" && (
        <CameraFeatureToggle
          variant={fullscreen ? "overlay" : "primary"}
          Icon={audio ? GiSpeaker : GiSpeakerOff}
          isActive={audio}
          title={
            audio
              ? t("cameraAudio.disable", { ns: "views/live" })
              : t("cameraAudio.enable", { ns: "views/live" })
          }
          onClick={() => setAudio(!audio)}
          disabled={!cameraEnabled}
        />
      )}
      <CameraFeatureToggle
        className={cn(
          isRecording && "animate-pulse bg-red-500 hover:bg-red-600",
        )}
        variant={fullscreen ? "overlay" : "primary"}
        Icon={isRecording ? TbRecordMail : TbRecordMailOff}
        isActive={isRecording}
        title={t("manualRecording." + (isRecording ? "stop" : "start"))}
        onClick={handleEventButtonClick}
        disabled={!cameraEnabled}
      />
      <CameraFeatureToggle
        variant={fullscreen ? "overlay" : "primary"}
        Icon={TbCameraDown}
        isActive={false}
        title={t("snapshot.takeSnapshot")}
        onClick={handleSnapshotClick}
        disabled={!cameraEnabled || isSnapshotLoading}
        loading={isSnapshotLoading}
      />
      <UnifiedLiveSettingsMenu
        camera={camera}
        fullscreen={fullscreen}
        streamName={streamName}
        setStreamName={setStreamName}
        isRestreamed={isRestreamed}
        cameraEnabled={cameraEnabled}
        playInBackground={playInBackground}
        setPlayInBackground={setPlayInBackground}
        showStats={showStats}
        setShowStats={setShowStats}
        setLowBandwidth={setLowBandwidth}
      />
    </div>
  );
}

type UnifiedLiveSettingsMenuProps = {
  camera: CameraConfig;
  fullscreen: boolean;
  streamName: string;
  setStreamName: (value: string | undefined) => void;
  isRestreamed: boolean;
  cameraEnabled: boolean;
  playInBackground: boolean;
  setPlayInBackground: (value: boolean | undefined) => void;
  showStats: boolean;
  setShowStats: (value: boolean) => void;
  setLowBandwidth: React.Dispatch<React.SetStateAction<boolean>>;
};

function UnifiedLiveSettingsMenu({
  camera,
  fullscreen,
  streamName,
  setStreamName,
  isRestreamed,
  cameraEnabled,
  playInBackground,
  setPlayInBackground,
  showStats,
  setShowStats,
  setLowBandwidth,
}: UnifiedLiveSettingsMenuProps) {
  const { t } = useTranslation(["views/live", "components/dialog"]);
  const isAdmin = useIsAdmin();
  const { payload: detectState, send: sendDetect } = useDetectState(
    camera.name,
  );
  const { payload: enabledState, send: sendEnabled } = useEnabledState(
    camera.name,
  );
  const { payload: recordState, send: sendRecord } = useRecordingsState(
    camera.name,
  );
  const { payload: snapshotState, send: sendSnapshot } = useSnapshotsState(
    camera.name,
  );
  const { payload: audioState, send: sendAudio } = useAudioState(camera.name);
  const { payload: autotrackingState, send: sendAutotracking } =
    useAutotrackingState(camera.name);
  const { payload: transcriptionState, send: sendTranscription } =
    useAudioTranscriptionState(camera.name);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger>
        <div
          className={cn(
            "flex h-[34px] w-[34px] flex-col items-center justify-center rounded-[4px] transition-colors",
            fullscreen
              ? "border border-[rgba(203,213,225,0.11)] bg-[rgba(19,24,32,0.82)] text-[#647184] backdrop-blur-xl hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100"
              : "border border-[rgba(203,213,225,0.11)] bg-[#131820] text-[#647184] hover:border-[rgba(169,182,186,0.28)] hover:bg-[#222c38] hover:text-slate-100",
          )}
        >
          <FaCog className="size-4 text-current" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-96">
        <div className="flex flex-col gap-5 p-4">
          {isAdmin && (
            <div className="flex flex-col gap-3">
              <Label>
                {t("cameraSettings.title", { camera: camera.name })}
              </Label>
              <SettingSwitch
                label={t("cameraSettings.cameraEnabled")}
                checked={enabledState == "ON"}
                onChange={() =>
                  sendEnabled(enabledState == "ON" ? "OFF" : "ON")
                }
              />
              <SettingSwitch
                label={t("cameraSettings.objectDetection")}
                checked={detectState == "ON"}
                onChange={() => sendDetect(detectState == "ON" ? "OFF" : "ON")}
                disabled={!cameraEnabled}
              />
              <SettingSwitch
                label={t("cameraSettings.recording")}
                checked={recordState == "ON"}
                onChange={() => sendRecord(recordState == "ON" ? "OFF" : "ON")}
                disabled={!cameraEnabled || !camera.record.enabled_in_config}
              />
              <SettingSwitch
                label={t("cameraSettings.snapshots")}
                checked={snapshotState == "ON"}
                onChange={() =>
                  sendSnapshot(snapshotState == "ON" ? "OFF" : "ON")
                }
                disabled={!cameraEnabled}
              />
              {camera.audio.enabled_in_config && (
                <SettingSwitch
                  label={t("cameraSettings.audioDetection")}
                  checked={audioState == "ON"}
                  onChange={() => sendAudio(audioState == "ON" ? "OFF" : "ON")}
                  disabled={!cameraEnabled}
                />
              )}
              {camera.audio.enabled_in_config &&
                camera.audio_transcription.enabled_in_config && (
                  <SettingSwitch
                    label={t("cameraSettings.transcription")}
                    checked={transcriptionState == "ON"}
                    onChange={() =>
                      sendTranscription(
                        transcriptionState == "ON" ? "OFF" : "ON",
                      )
                    }
                    disabled={!cameraEnabled || audioState == "OFF"}
                  />
                )}
              {camera.onvif.autotracking.enabled_in_config && (
                <SettingSwitch
                  label={t("cameraSettings.autotracking")}
                  checked={autotrackingState == "ON"}
                  onChange={() =>
                    sendAutotracking(autotrackingState == "ON" ? "OFF" : "ON")
                  }
                  disabled={!cameraEnabled}
                />
              )}
            </div>
          )}
          {isRestreamed && Object.values(camera.live.streams).length > 0 && (
            <div className="flex flex-col gap-2">
              <Label>{t("stream.title")}</Label>
              <Select value={streamName} onValueChange={setStreamName}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {Object.keys(camera.live.streams).find(
                      (key) => camera.live.streams[key] === streamName,
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {Object.entries(camera.live.streams).map(
                      ([stream, name]) => (
                        <SelectItem
                          key={stream}
                          className="cursor-pointer"
                          value={name}
                        >
                          {stream}
                        </SelectItem>
                      ),
                    )}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          )}
          {isRestreamed && (
            <SettingSwitch
              label={t("stream.playInBackground.label")}
              checked={playInBackground}
              onChange={setPlayInBackground}
            />
          )}
          <SettingSwitch
            label={t("streaming.showStats.label", {
              ns: "components/dialog",
            })}
            checked={showStats}
            onChange={setShowStats}
          />
          <Button
            className="w-full"
            variant="outline"
            size="sm"
            onClick={() => setLowBandwidth(false)}
          >
            {t("stream.lowBandwidth.resetStream")}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

type SettingSwitchProps = {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
};

function SettingSwitch({
  label,
  checked,
  onChange,
  disabled = false,
}: SettingSwitchProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label className="mx-0 text-sm text-primary">{label}</Label>
      <Switch
        disabled={disabled}
        checked={checked}
        onCheckedChange={onChange}
      />
    </div>
  );
}

type TimelineProps = {
  contentRef: MutableRefObject<HTMLDivElement | null>;
  timelineRef?: MutableRefObject<HTMLDivElement | null>;
  mainCamera: string;
  isLive: boolean;
  timelineType: TimelineType;
  timeRange: TimeRange;
  mainCameraReviewItems: ReviewSegment[];
  activeReviewItem?: ReviewSegment;
  currentTime: number;
  exportRange?: TimeRange;
  isPlaying?: boolean;
  setCurrentTime: React.Dispatch<React.SetStateAction<number>>;
  setCurrentTimeAndMode: React.Dispatch<React.SetStateAction<number>>;
  manuallySetCurrentTime: (time: number, force: boolean) => void;
  setScrubbing: React.Dispatch<React.SetStateAction<boolean>>;
  setExportRange: (range: TimeRange) => void;
  onAnalysisOpen: (open: boolean) => void;
};
function Timeline({
  contentRef,
  timelineRef,
  mainCamera,
  isLive,
  timelineType,
  timeRange,
  mainCameraReviewItems,
  activeReviewItem,
  currentTime,
  exportRange,
  isPlaying,
  setCurrentTime,
  setCurrentTimeAndMode,
  manuallySetCurrentTime,
  setScrubbing,
  setExportRange,
  onAnalysisOpen,
}: TimelineProps) {
  const { t } = useTranslation(["views/events"]);
  const internalTimelineRef = useRef<HTMLDivElement>(null);
  const selectedTimelineRef = timelineRef || internalTimelineRef;

  // timeline interaction

  const [zoomSettings, setZoomSettings] = useState({
    segmentDuration: 30,
    timestampSpread: 15,
  });

  const possibleZoomLevels: ZoomLevel[] = useMemo(
    () => [
      { segmentDuration: 30, timestampSpread: 15 },
      { segmentDuration: 15, timestampSpread: 5 },
      { segmentDuration: 5, timestampSpread: 1 },
    ],
    [],
  );

  const handleZoomChange = useCallback(
    (newZoomLevel: number) => {
      setZoomSettings(possibleZoomLevels[newZoomLevel]);
    },
    [possibleZoomLevels],
  );

  const currentZoomLevel = useMemo(
    () =>
      possibleZoomLevels.findIndex(
        (level) => level.segmentDuration === zoomSettings.segmentDuration,
      ),
    [possibleZoomLevels, zoomSettings.segmentDuration],
  );

  const { isZooming, zoomDirection } = useTimelineZoom({
    zoomSettings,
    zoomLevels: possibleZoomLevels,
    onZoomChange: handleZoomChange,
    timelineRef: selectedTimelineRef,
    timelineDuration: timeRange.after - timeRange.before,
  });

  // motion data
  const { alignStartDateToTimeline, alignEndDateToTimeline } = useTimelineUtils(
    {
      segmentDuration: zoomSettings.segmentDuration,
    },
  );

  const alignedAfter = alignStartDateToTimeline(timeRange.after);
  const alignedBefore = alignEndDateToTimeline(timeRange.before);

  const { data: motionData, isLoading } = useSWR<MotionData[]>([
    "review/activity/motion",
    {
      before: alignedBefore,
      after: alignedAfter,
      scale: Math.round(zoomSettings.segmentDuration / 2),
      cameras: mainCamera,
    },
  ]);

  const { data: noRecordings } = useSWR<RecordingSegment[]>([
    "recordings/unavailable",
    {
      before: alignedBefore,
      after: alignedAfter,
      scale: Math.round(zoomSettings.segmentDuration),
      cameras: mainCamera,
    },
  ]);

  const [exportStart, setExportStartTime] = useState<number>(0);
  const [exportEnd, setExportEndTime] = useState<number>(0);

  useEffect(() => {
    if (exportRange && exportStart != 0 && exportEnd != 0) {
      if (exportRange.after != exportStart) {
        setCurrentTime(exportStart);
      } else if (exportRange?.before != exportEnd) {
        setCurrentTime(exportEnd);
      }

      setExportRange({ after: exportStart, before: exportEnd });
    }
    // we only want to update when the export parts change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exportStart, exportEnd, setExportRange, setCurrentTime]);

  return (
    <div
      className={cn(
        "relative overflow-hidden",
        isDesktop
          ? cn(
              timelineType == "timeline"
                ? "w-[100px] flex-shrink-0"
                : timelineType == "detail"
                  ? "min-w-[20rem] max-w-[30%] flex-shrink-0 flex-grow-0 basis-[30rem] md:min-w-[20rem] md:max-w-[25%] lg:min-w-[30rem] lg:max-w-[33%]"
                  : "w-80 flex-shrink-0",
            )
          : cn(
              timelineType == "timeline"
                ? "portrait:flex-grow landscape:w-[100px] landscape:flex-shrink-0"
                : timelineType == "detail"
                  ? "portrait:flex-grow landscape:w-[19rem] landscape:flex-shrink-0"
                  : "portrait:flex-grow landscape:w-[19rem] landscape:flex-shrink-0",
            ),
      )}
    >
      {isMobileOnly && timelineType == "timeline" && (
        <GenAISummaryDialog review={activeReviewItem} onOpen={onAnalysisOpen}>
          <GenAISummaryChip review={activeReviewItem} />
        </GenAISummaryDialog>
      )}

      {timelineType != "detail" && timelineType != "events" && (
        <>
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 h-[30px] w-full bg-gradient-to-b from-secondary to-transparent"></div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-[30px] w-full bg-gradient-to-t from-secondary to-transparent"></div>
        </>
      )}
      {timelineType == "timeline" ? (
        !isLoading ? (
          <MotionReviewTimeline
            timelineRef={selectedTimelineRef}
            segmentDuration={zoomSettings.segmentDuration}
            timestampSpread={zoomSettings.timestampSpread}
            timelineStart={timeRange.before}
            timelineEnd={timeRange.after}
            showHandlebar={exportRange == undefined}
            showExportHandles={exportRange != undefined}
            exportStartTime={exportRange?.after}
            exportEndTime={exportRange?.before}
            setExportStartTime={setExportStartTime}
            setExportEndTime={setExportEndTime}
            handlebarTime={currentTime}
            setHandlebarTime={setCurrentTimeAndMode}
            events={mainCameraReviewItems}
            motion_events={motionData ?? []}
            noRecordingRanges={noRecordings ?? []}
            contentRef={contentRef}
            onHandlebarDraggingChange={(scrubbing) => setScrubbing(scrubbing)}
            isZooming={isZooming}
            zoomDirection={zoomDirection}
            onZoomChange={handleZoomChange}
            possibleZoomLevels={possibleZoomLevels}
            currentZoomLevel={currentZoomLevel}
            isLive={isLive}
          />
        ) : (
          <Skeleton className="size-full" />
        )
      ) : timelineType == "detail" ? (
        <DetailStream
          currentTime={currentTime}
          onSeek={(timestamp, play) =>
            manuallySetCurrentTime(timestamp, play ?? true)
          }
          reviewItems={mainCameraReviewItems}
          isPlaying={isPlaying}
        />
      ) : (
        <div className="scrollbar-container h-full overflow-auto border-l border-[rgba(203,213,225,0.11)] bg-[rgba(13,17,20,0.92)]">
          <div
            className={cn(
              "scrollbar-container grid h-auto grid-cols-1 gap-3 overflow-auto p-3",
              isMobile && "sm:portrait:grid-cols-2",
            )}
          >
            {mainCameraReviewItems.length === 0 ? (
              <div className="mt-5 rounded-[4px] border border-[rgba(203,213,225,0.11)] bg-[#131820] px-4 py-8 text-center text-sm text-slate-500">
                {t("events.noFoundForTimePeriod")}
              </div>
            ) : (
              mainCameraReviewItems.map((review) => {
                if (review.severity === "significant_motion") {
                  return;
                }

                return (
                  <ReviewCard
                    key={review.id}
                    event={review}
                    activeReviewItem={activeReviewItem}
                    onClick={() => {
                      manuallySetCurrentTime(
                        review.start_time - REVIEW_PADDING,
                        true,
                      );
                    }}
                  />
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
