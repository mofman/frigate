import ActivityIndicator from "@/components/indicators/activity-indicator";
import { useCameraPreviews } from "@/hooks/use-camera-previews";
import { useTimezone } from "@/hooks/use-date-utils";
import { FrigateConfig } from "@/types/frigateConfig";
import { ReviewFilter, ReviewSegment, ReviewSummary } from "@/types/review";
import { RecordingView } from "@/views/recording/RecordingView";
import axios from "axios";
import { useCallback, useEffect, useMemo, useState } from "react";
import useSWR from "swr";

type UnifiedCameraViewProps = {
  config?: FrigateConfig;
  camera: string;
  onSelectCamera?: (camera: string) => void;
};

export default function UnifiedCameraView({
  config,
  camera,
  onSelectCamera,
}: UnifiedCameraViewProps) {
  const timezone = useTimezone(config);
  const [beforeTs, setBeforeTs] = useState(Math.ceil(Date.now() / 1000));
  const [reviewFilter, setReviewFilter] = useState<ReviewFilter>({
    cameras: [camera],
  });

  useEffect(() => {
    setReviewFilter((current) => ({
      ...current,
      cameras: current.cameras?.includes(camera) ? current.cameras : [camera],
    }));
  }, [camera]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setBeforeTs(Math.ceil(Date.now() / 1000));
    }, 30000);

    return () => window.clearInterval(timer);
  }, []);

  const selectedTimeRange = useMemo(() => {
    if (reviewFilter.after != undefined && reviewFilter.before != undefined) {
      return {
        after: Math.floor(reviewFilter.after),
        before: Math.ceil(reviewFilter.before),
      };
    }

    return {
      after: getHoursAgo(24),
      before: beforeTs,
    };
  }, [beforeTs, reviewFilter.after, reviewFilter.before]);

  const reviewSegmentFetcher = useCallback((key: Array<string> | string) => {
    const [path, params] = Array.isArray(key) ? key : [key, undefined];
    return axios.get(path, { params }).then((res) => res.data);
  }, []);

  const { data: reviews, mutate: updateSegments } = useSWR<ReviewSegment[]>(
    [
      "review",
      {
        cameras: reviewFilter.cameras,
        labels: reviewFilter.labels,
        zones: reviewFilter.zones,
        reviewed: null,
        before: selectedTimeRange.before,
        after: selectedTimeRange.after,
      },
    ],
    reviewSegmentFetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
    },
  );

  const { data: reviewSummary, mutate: updateSummary } = useSWR<ReviewSummary>(
    [
      "review/summary",
      {
        timezone,
        cameras: reviewFilter.cameras ?? null,
        labels: reviewFilter.labels ?? null,
        zones: reviewFilter.zones ?? null,
      },
    ],
    {
      revalidateOnFocus: true,
      refreshInterval: 30000,
      revalidateOnReconnect: false,
    },
  );

  const previewTimes = useMemo(() => {
    const startDate = new Date(selectedTimeRange.after * 1000);
    startDate.setUTCMinutes(0, 0, 0);

    const endDate = new Date(selectedTimeRange.before * 1000);
    endDate.setHours(endDate.getHours() + 1, 0, 0, 0);

    return {
      after: startDate.getTime() / 1000,
      before: endDate.getTime() / 1000,
    };
  }, [selectedTimeRange]);

  const allPreviews = useCameraPreviews(previewTimes, {});

  const allCameras = useMemo(() => {
    if (!config) {
      return [];
    }

    return Object.values(config.cameras)
      .filter((cam) => cam.enabled_in_config)
      .sort((aConf, bConf) => aConf.ui.order - bConf.ui.order)
      .map((cam) => cam.name);
  }, [config]);

  const reloadData = useCallback(() => {
    setBeforeTs(Math.ceil(Date.now() / 1000));
    updateSegments();
    updateSummary();
  }, [updateSegments, updateSummary]);

  const updateFilter = useCallback(
    (newFilter: ReviewFilter) => {
      setReviewFilter({
        ...newFilter,
        cameras: newFilter.cameras ?? [camera],
      });
    },
    [camera],
  );

  if (!config || !timezone) {
    return <ActivityIndicator />;
  }

  return (
    <RecordingView
      key={camera}
      startCamera={camera}
      startTime={selectedTimeRange.before}
      initialMode="live"
      allCameras={allCameras}
      reviewItems={reviews}
      reviewSummary={reviewSummary}
      allPreviews={allPreviews}
      timeRange={selectedTimeRange}
      filter={reviewFilter}
      updateFilter={updateFilter}
      refreshData={reloadData}
      onSelectCamera={onSelectCamera}
    />
  );
}

function getHoursAgo(hours: number): number {
  const now = new Date();
  now.setHours(now.getHours() - hours);
  return Math.ceil(now.getTime() / 1000);
}
