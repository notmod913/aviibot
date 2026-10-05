import { createFileRoute } from "@tanstack/react-router";
import { InspectionSchedulingPage } from "@/pages/satark-pages";

export const Route = createFileRoute("/random-schedule")({
  head: () => ({
    meta: [
      { title: "Inspection Scheduling — Satark Drishti" },
      { name: "description", content: "Create and review inspection assignments for registered organizations." },
      { property: "og:title", content: "Inspection Scheduling — Satark Drishti" },
      { property: "og:description", content: "Schedule inspections from the live organization registry." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: InspectionSchedulingPage,
});
