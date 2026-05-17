import NavItem from "./NavItem";
import { Link } from "react-router-dom";
import GeneralSettings from "../menu/GeneralSettings";
import AccountSettings from "../menu/AccountSettings";
import { useMemo } from "react";
import frigateLogo from "../../../frigate-redesign/logo.png";
import useNavigation, {
  ID_EXPLORE,
  ID_EXPORT,
  ID_LIVE,
  ID_REVIEW,
} from "@/hooks/use-navigation";
import { Bell, Tags } from "lucide-react";
import { NavData } from "@/types/navigation";

function Sidebar() {
  const navbarLinks = useNavigation();
  const staticSidebarLinks = useMemo<NavData[]>(() => {
    const linkMap = new Map(navbarLinks.map((item) => [item.id, item]));
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
        variant: "primary",
        icon: Bell,
        title: "Alerts",
        label: "Alerts",
        url: "/review",
      },
      exportLink,
      {
        id: 101,
        variant: "primary",
        icon: Tags,
        title: "Labels",
        label: "Labels",
        url: "/explore",
      },
    ].filter(Boolean) as NavData[];
  }, [navbarLinks]);

  return (
    <aside className="scrollbar-container scrollbar-hidden absolute inset-y-0 left-0 z-10 hidden w-[72px] flex-col justify-between overflow-y-auto border-r border-[rgba(203,213,225,0.11)] bg-[#0d1014] py-5 md:flex">
      <span tabIndex={0} className="sr-only" />
      <div className="flex w-full flex-col items-center gap-3">
        <Link to="/">
          <img
            className="mb-[18px] w-[42px] object-contain"
            src={frigateLogo}
            alt="Frigate"
          />
        </Link>
        {staticSidebarLinks.map((item) => (
          <div className="flex w-full flex-col items-center" key={item.id}>
            <NavItem item={item} Icon={item.icon} />
          </div>
        ))}
      </div>
      <div className="flex flex-col items-center gap-3">
        <GeneralSettings showLabel />
        <AccountSettings showLabel />
      </div>
    </aside>
  );
}

export default Sidebar;
