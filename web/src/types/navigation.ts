import { ComponentType } from "react";

export type NavData = {
  id: number;
  variant?: "primary" | "secondary";
  icon: ComponentType<{ className?: string }>;
  title: string;
  label?: string;
  url: string;
  enabled?: boolean;
  badge?: number;
};
