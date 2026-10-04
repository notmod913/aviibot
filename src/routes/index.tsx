import { createFileRoute } from "@tanstack/react-router";
import { PortalRoleLoginPage } from "@/components/satark/auth-login";
import { getStoredSession } from "@/lib/auth";
import { DashboardPage } from "@/pages/satark-pages";

function AuthorityGate() {
  const session = getStoredSession();

  if (!session) {
    return <PortalRoleLoginPage />;
  }

  if (session.role !== "authority") {
    return <PortalRoleLoginPage />;
  }

  return <DashboardPage />;
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Authority Dashboard — Satark Drishti" },
      { name: "description", content: "Monitor inspections, verify evidence and maintain transparent organizational oversight." },
      { property: "og:title", content: "Authority Dashboard — Satark Drishti" },
      { property: "og:description", content: "Smart real-time monitoring and inspection evidence dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthorityGate,
});
