import { createRoot, type Root } from "react-dom/client";
import "./index.css";
import { AppErrorBoundary, StartupError } from "@/components/AppFallback";

// Keep this entrypoint in the Cloudflare native Git deployment path so
// production configuration changes in .env.production trigger a fresh build.
const container = document.getElementById("root");

if (!container) {
  throw new Error("Application root element is missing.");
}

const root = createRoot(container);

async function bootstrap(rootInstance: Root) {
  if (
    !import.meta.env.VITE_SUPABASE_URL ||
    !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  ) {
    console.error(
      "[app] Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY.",
    );
    rootInstance.render(
      <StartupError message="The service is not configured. Please contact the administrator." />,
    );
    return;
  }

  try {
    const [{ default: App }, { CommunityIntegrationProvider }] =
      await Promise.all([
        import("./App.tsx"),
        import("@/contexts/CommunityIntegrationContext"),
      ]);

    rootInstance.render(
      <AppErrorBoundary>
        <CommunityIntegrationProvider>
          <App />
        </CommunityIntegrationProvider>
      </AppErrorBoundary>,
    );
  } catch (error) {
    console.error("[app] Bootstrap failed", error);
    rootInstance.render(
      <StartupError message="The application failed to start. Please try again." />,
    );
  }
}

void bootstrap(root);
