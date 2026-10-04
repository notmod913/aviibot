import { useEffect, useRef, useState } from "react";

export function GpsMapFrame({
  latitude,
  longitude,
  radiusM,
  title,
}: {
  latitude: number;
  longitude: number;
  radiusM: number;
  title: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState("initial");
  const latitudePadding = Math.max(0.003, radiusM / 111_320 * 2.5);
  const longitudePadding = latitudePadding / Math.max(Math.cos(latitude * Math.PI / 180), 0.2);
  const bounds = [
    longitude - longitudePadding,
    latitude - latitudePadding,
    longitude + longitudePadding,
    latitude + latitudePadding,
  ].map((value) => value.toFixed(6)).join(",");
  const mapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${bounds}&layer=mapnik&marker=${latitude},${longitude}`;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(([entry]) => {
      if (!entry || entry.contentRect.width <= 0 || entry.contentRect.height <= 0) return;
      const widthBucket = Math.round(entry.contentRect.width / 64);
      const heightBucket = Math.round(entry.contentRect.height / 64);
      setFrameSize(`${widthBucket}-${heightBucket}`);
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="relative h-[clamp(320px,55vh,560px)] min-w-0 overflow-hidden rounded-lg border">
      <iframe
        key={frameSize}
        title={title}
        src={mapUrl}
        loading="eager"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
