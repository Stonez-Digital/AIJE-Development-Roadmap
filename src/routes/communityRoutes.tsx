import { lazy } from "react";
import { Route } from "react-router-dom";
import { PermissionRoute } from "@/features/access/PermissionRoute";
import { ProtectedRoute } from "./routeGuards";
import { APP_PATHS } from "@/features/navigation/navigationConfig";
const CommunityOperations = lazy(() => import("@/features/community-operations/pages/CommunityOperationsPage"));
const CommunityAlerts = lazy(() => import("@/pages/CommunityAlerts"));
const SafeBenueLanding = lazy(() => import("@/pages/safebenue/SafeBenueLanding"));
const SafeBenueDashboard = lazy(() => import("@/pages/safebenue/SafeBenueDashboard"));
const SafeBenueReports = lazy(() => import("@/pages/safebenue/SafeBenueReports"));
const SafeBenueResources = lazy(() => import("@/pages/safebenue/SafeBenueResources"));
const SafeBenueWatch = lazy(() => import("@/pages/safebenue/SafeBenueCommunityWatch"));
const SafeBenueFamily = lazy(() => import("@/pages/safebenue/SafeBenueFamily"));
const SafeBenueAdmin = lazy(() => import("@/pages/safebenue/SafeBenueAdmin"));
const PublicInformationCenter = lazy(() => import("@/pages/PublicInformationCenter"));
const PublicInformationAdmin = lazy(() => import("@/pages/PublicInformationAdmin"));
const operationsPermissions = ["alerts.dispatch", "incidents.respond", "reports.verify"] as const;
export function CommunityRoutes() { return <><Route path={APP_PATHS.publicInformation} element={<PublicInformationCenter />} /><Route path={APP_PATHS.publicInformationAdmin} element={<PermissionRoute anyOf={["organization.manage", "reports.verify", "alerts.dispatch"]}><PublicInformationAdmin /></PermissionRoute>} /><Route path={APP_PATHS.community} element={<PermissionRoute anyOf={[...operationsPermissions]}><CommunityOperations /></PermissionRoute>} /><Route path={APP_PATHS.communityAlerts} element={<PermissionRoute anyOf={["alerts.dispatch"]}><CommunityAlerts /></PermissionRoute>} /><Route path={APP_PATHS.safeBenue} element={<ProtectedRoute><SafeBenueLanding /></ProtectedRoute>} /><Route path={APP_PATHS.safeBenueDashboard} element={<PermissionRoute anyOf={[...operationsPermissions]}><SafeBenueDashboard /></PermissionRoute>} /><Route path={APP_PATHS.safeBenueReports} element={<ProtectedRoute><SafeBenueReports /></ProtectedRoute>} /><Route path={APP_PATHS.safeBenueResources} element={<ProtectedRoute><SafeBenueResources /></ProtectedRoute>} /><Route path={APP_PATHS.safeBenueWatch} element={<PermissionRoute anyOf={["alerts.dispatch"]}><SafeBenueWatch /></PermissionRoute>} /><Route path={APP_PATHS.safeBenueFamily} element={<ProtectedRoute><SafeBenueFamily /></ProtectedRoute>} /><Route path={APP_PATHS.safeBenueAdmin} element={<PermissionRoute anyOf={["organization.manage", "reports.verify"]}><SafeBenueAdmin /></PermissionRoute>} /></>; }
