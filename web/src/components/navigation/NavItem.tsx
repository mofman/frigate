import { useState } from "react";
import { NavLink } from "react-router-dom";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { isDesktop } from "react-device-detect";
import { TooltipPortal } from "@radix-ui/react-tooltip";
import { NavData } from "@/types/navigation";
import { cn } from "@/lib/utils";
import { useTranslation } from "react-i18next";

const variants = {
  primary: {
    active: "",
    inactive: "",
  },
  secondary: {
    active: "",
    inactive: "",
  },
};

type NavItemProps = {
  className?: string;
  item: NavData;
  Icon: NavData["icon"];
  onClick?: () => void;
  disableTooltip?: boolean;
};

export default function NavItem({
  className,
  item,
  Icon,
  onClick,
  disableTooltip = false,
}: NavItemProps) {
  const { t } = useTranslation(["common"]);
  const [isHovered, setIsHovered] = useState(false);

  if (item.enabled == false) {
    return;
  }

  const content = (
    <NavLink
      to={item.url}
      end={item.url === "/"}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={({ isActive }) =>
        cn(
          "relative flex h-[58px] w-[52px] flex-col items-center justify-center gap-1 text-center transition-colors",
          className,
          variants[item.variant ?? "primary"][isActive ? "active" : "inactive"],
        )
      }
    >
      {({ isActive }) => {
        const navColor = isActive
          ? "#5aa7ff"
          : isHovered
            ? "#f1f5f9"
            : "#647184";

        return (
          <div className="relative flex size-full flex-col items-center justify-center gap-1">
            <Icon
              className={cn(
                "size-[22px] shrink-0 stroke-2",
                isActive
                  ? "text-[#5aa7ff]"
                  : isHovered
                    ? "text-[#f1f5f9]"
                    : "text-[#647184]",
              )}
            />
            <span
              className="whitespace-nowrap"
              style={{
                color: navColor,
                fontSize: disableTooltip ? 10 : 12,
                fontFamily: "Inter, sans-serif",
                fontWeight: 500,
                letterSpacing: "0.02em",
                lineHeight: "normal",
              }}
            >
              {item.label ?? t(item.title)}
            </span>
            {!!item.badge && item.badge > 0 && (
              <span className="absolute right-1.5 top-1 z-10 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#ef4444] px-1 text-[10px] font-semibold leading-none text-white shadow-[0_0_8px_rgba(239,68,68,0.2)]">
                {Math.min(item.badge, 9)}
              </span>
            )}
          </div>
        );
      }}
    </NavLink>
  );

  if (isDesktop && !disableTooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipPortal>
          <TooltipContent side="right">
            <p>{t(item.title)}</p>
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>
    );
  }

  return content;
}
