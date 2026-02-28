import { Navigation } from "@shopify/polaris";
import { useLocation, useNavigate } from "@remix-run/react";
import {
  HomeIcon,
  SearchIcon,
  ClockIcon,
  FileIcon,
  ImageIcon,
  LinkIcon,
  ChartVerticalIcon,
  SettingsIcon,
  AnalyticsIcon,
} from "@shopify/polaris-icons";

export function AppNavigation() {
  const location = useLocation();
  const navigate = useNavigate();

  const isSelected = (path: string) => location.pathname === path;

  return (
    <Navigation location={location.pathname}>
      <Navigation.Section
        items={[
          {
            url: "/app",
            label: "Dashboard",
            icon: HomeIcon,
            selected: isSelected("/app"),
            onClick: () => navigate("/app"),
          },
        ]}
      />
      <Navigation.Section
        title="SEO Tools"
        items={[
          {
            url: "/app/seo-checker",
            label: "SEO Checker",
            icon: SearchIcon,
            selected: isSelected("/app/seo-checker"),
            onClick: () => navigate("/app/seo-checker"),
          },
          {
            url: "/app/speed-optimization",
            label: "Speed Optimization",
            icon: ClockIcon,
            selected: isSelected("/app/speed-optimization"),
            onClick: () => navigate("/app/speed-optimization"),
          },
          {
            url: "/app/content-optimization",
            label: "Content Optimization",
            icon: FileIcon,
            selected: isSelected("/app/content-optimization"),
            onClick: () => navigate("/app/content-optimization"),
          },
          {
            url: "/app/search-appearance",
            label: "Search Appearance",
            icon: AnalyticsIcon,
            selected: location.pathname.startsWith("/app/search-appearance"),
            onClick: () => navigate("/app/search-appearance"),
          },
          {
            url: "/app/link-management",
            label: "Link Management",
            icon: LinkIcon,
            selected: isSelected("/app/link-management"),
            onClick: () => navigate("/app/link-management"),
          },
          {
            url: "/app/keyword-research",
            label: "Keyword Research",
            icon: ChartVerticalIcon,
            selected: isSelected("/app/keyword-research"),
            onClick: () => navigate("/app/keyword-research"),
          },
        ]}
      />
      <Navigation.Section
        title="Configuration"
        items={[
          {
            url: "/app/settings",
            label: "Settings",
            icon: SettingsIcon,
            selected: isSelected("/app/settings"),
            onClick: () => navigate("/app/settings"),
          },
        ]}
      />
    </Navigation>
  );
}
