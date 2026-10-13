import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BellRing,
  BrainCircuit,
  Building2,
  Camera,
  CircleUserRound,
  ContactRound,
  CreditCard,
  FileWarning,
  LifeBuoy,
  MapPinned,
  Newspaper,
  RadioTower,
  ScanEye,
  ScanFace,
  Server,
  Settings,
  ShieldCheck,
  Users,
  Webhook,
} from "lucide-react";
import type { Permission } from "@/features/access/types";

export const APP_PATHS = {
  home: "/",
  safety: "/safety",
  incidentReport: "/safety/report",
  emergencyContacts: "/safety/contacts",
  emergencyResources: "/safety/resources",
  notifications: "/safety/notifications",
  profile: "/account/profile",
  sites: "/account/sites",
  billing: "/account/billing",
  billingCallback: "/account/billing/callback",
  operations: "/operations",
  cameras: "/operations/cameras",
  sensors: "/operations/sensors",
  householdSensors: "/safety/sensors",
  detection: "/operations/detection",
  faces: "/operations/faces",
  intelligence: "/intelligence/osiris",
  community: "/community/operations",
  communityAlerts: "/community/alerts",
  safeBenue: "/community/safebenue",
  safeBenueDashboard: "/community/safebenue/dashboard",
  safeBenueReports: "/community/safebenue/reports",
  safeBenueResources: "/community/safebenue/resources",
  safeBenueWatch: "/community/safebenue/community-watch",
  safeBenueFamily: "/community/safebenue/family",
  safeBenueAdmin: "/community/safebenue/admin",
  publicInformation: "/community/public-information",
  publicInformationAdmin: "/community/public-information/admin",
  organization: "/organization",
  platform: "/platform",
  webhooks: "/platform/webhooks",
} as const;

export type NavigationDomain =
  | "Personal safety"
  | "Security operations"
  | "Intelligence"
  | "Community safety"
  | "Organization"
  | "Platform"
  | "Account";

export interface NavigationItem {
  title: string;
  path: string;
  icon: LucideIcon;
  anyOf?: Permission[];
  platformOnly?: boolean;
}

export interface NavigationSection {
  domain: NavigationDomain;
  items: NavigationItem[];
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    domain: "Personal safety",
    items: [
      { title: "My Safety", path: APP_PATHS.safety, icon: ShieldCheck },
      {
        title: "Report incident",
        path: APP_PATHS.incidentReport,
        icon: FileWarning,
      },
      {
        title: "Emergency contacts",
        path: APP_PATHS.emergencyContacts,
        icon: ContactRound,
      },
      {
        title: "Emergency resources",
        path: APP_PATHS.emergencyResources,
        icon: MapPinned,
      },
      { title: "Notifications", path: APP_PATHS.notifications, icon: Bell },
      {
        title: "Sensor hub",
        path: APP_PATHS.householdSensors,
        icon: RadioTower,
        anyOf: ["sensors.view", "sensors.manage"],
      },
    ],
  },
  {
    domain: "Security operations",
    items: [
      {
        title: "Operations",
        path: APP_PATHS.operations,
        icon: Settings,
        anyOf: ["cameras.manage"],
      },
      {
        title: "Cameras",
        path: APP_PATHS.cameras,
        icon: Camera,
        anyOf: ["cameras.view", "cameras.manage"],
      },
      {
        title: "Detection",
        path: APP_PATHS.detection,
        icon: ScanEye,
        anyOf: ["cameras.view"],
      },
      {
        title: "Recognized persons",
        path: APP_PATHS.faces,
        icon: ScanFace,
        anyOf: ["cameras.manage"],
      },
    ],
  },
  {
    domain: "Intelligence",
    items: [
      {
        title: "Osiris Intelligence",
        path: APP_PATHS.intelligence,
        icon: BrainCircuit,
        anyOf: ["intelligence.view"],
      },
    ],
  },
  {
    domain: "Community safety",
    items: [
      {
        title: "Community operations",
        path: APP_PATHS.community,
        icon: Users,
        anyOf: ["alerts.dispatch", "incidents.respond", "reports.verify"],
      },
      {
        title: "Community alerts",
        path: APP_PATHS.communityAlerts,
        icon: BellRing,
        anyOf: ["alerts.dispatch"],
      },
      { title: "SafeBenue", path: APP_PATHS.safeBenue, icon: LifeBuoy },
      { title: "Public information", path: APP_PATHS.publicInformation, icon: Newspaper },
      { title: "Information publishing", path: APP_PATHS.publicInformationAdmin, icon: Newspaper, anyOf: ["organization.manage", "reports.verify", "alerts.dispatch"] },
    ],
  },
  {
    domain: "Organization",
    items: [
      {
        title: "Organization administration",
        path: APP_PATHS.organization,
        icon: Building2,
        anyOf: ["organization.manage"],
      },
    ],
  },
  {
    domain: "Platform",
    items: [
      {
        title: "Platform administration",
        path: APP_PATHS.platform,
        icon: ShieldCheck,
        platformOnly: true,
      },
      {
        title: "Webhook observability",
        path: APP_PATHS.webhooks,
        icon: Webhook,
        platformOnly: true,
      },
    ],
  },
  {
    domain: "Account",
    items: [
      { title: "My profile", path: APP_PATHS.profile, icon: CircleUserRound },
      {
        title: "Sites and deployments",
        path: APP_PATHS.sites,
        icon: Server,
        anyOf: ["sites.manage"],
      },
      {
        title: "Plans and billing",
        path: APP_PATHS.billing,
        icon: CreditCard,
        anyOf: ["billing.manage"],
      },
    ],
  },
];

export function canOpenNavigationItem(
  item: NavigationItem,
  platformAdmin: boolean,
  hasPermission: (permission: Permission) => boolean,
) {
  if (platformAdmin) return true;
  if (item.platformOnly) return false;
  return !item.anyOf || item.anyOf.some(hasPermission);
}
