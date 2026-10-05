import { useEffect, useState } from "react";
import { fetchReverseGeocodedAddress, formatNearbyAddress } from "@/lib/reverse-geocode";

export function ReverseGeocodedAddress({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}) {
  const [address, setAddress] = useState<ReturnType<typeof formatNearbyAddress> | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setAddress(null);
    setError("");
    fetchReverseGeocodedAddress(latitude, longitude, controller.signal)
      .then((result) => setAddress(formatNearbyAddress(result)))
      .catch((lookupError: unknown) => {
        if (!controller.signal.aborted) {
          setError(lookupError instanceof Error ? lookupError.message : "Could not look up a nearby address.");
        }
      });
    return () => controller.abort();
  }, [latitude, longitude]);

  return (
    <div className="mt-4 border-t pt-4 text-xs">
      <p className="font-semibold">Inspector GPS location · approximate mapped address</p>
      {!address && !error && <p className="mt-1 text-muted-foreground">Looking up nearby street and city…</p>}
      {error && <p className="mt-1 text-muted-foreground">{error}</p>}
      {address && (
        <>
          <p className="mt-1 font-semibold">{address.street}</p>
          {address.locality && <p className="mt-1 text-muted-foreground">{address.locality}</p>}
          {address.region && <p className="mt-1 text-muted-foreground">{address.region}</p>}
          <a
            href="https://www.openstreetmap.org/copyright"
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-muted-foreground underline"
          >
            Address data © OpenStreetMap contributors
          </a>
        </>
      )}
    </div>
  );
}
