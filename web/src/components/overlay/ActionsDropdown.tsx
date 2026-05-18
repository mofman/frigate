import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Button } from "../ui/button";
import { useTranslation } from "react-i18next";
import { Film } from "lucide-react";

type ActionsDropdownProps = {
  onDebugReplayClick: () => void;
  onExportClick: () => void;
  onShareTimestampClick: () => void;
  triggerClassName?: string;
};

export default function ActionsDropdown({
  onDebugReplayClick,
  onExportClick,
  onShareTimestampClick,
  triggerClassName,
}: Readonly<ActionsDropdownProps>) {
  const { t } = useTranslation(["components/dialog", "views/replay", "common"]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          className={`flex items-center gap-2 ${triggerClassName ?? ""}`}
          aria-label={t("menu.actions", { ns: "common" })}
          size="sm"
        >
          <Film
            className={`size-4 ${triggerClassName ? "text-[#647184]" : "text-secondary-foreground"}`}
          />
          <div className={triggerClassName ? "text-slate-200" : "text-primary"}>
            {t("menu.actions", { ns: "common" })}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={onExportClick}>
          {t("menu.export", { ns: "common" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onShareTimestampClick}>
          {t("recording.shareTimestamp.label", { ns: "components/dialog" })}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={onDebugReplayClick}>
          {t("title", { ns: "views/replay" })}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
