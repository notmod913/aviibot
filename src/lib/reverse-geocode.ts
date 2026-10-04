export interface ReverseGeocodedAddress {
  display_name: string;
  building?: string;
  house_number?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  residential?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  city_district?: string;
  city?: string;
  town?: string;
  village?: string;
  state_district?: string;
  county?: string;
  state?: string;
  postcode?: string;
  country?: string;
}

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");

export async function fetchReverseGeocodedAddress(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<ReverseGeocodedAddress> {
  const query = new URLSearchParams({
    latitude: latitude.toString(),
    longitude: longitude.toString(),
  });
  const response = await fetch(`${API_BASE_URL}/api/location/reverse?${query}`, { signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.detail || `Address lookup failed (${response.status}).`);
  }
  return payload as ReverseGeocodedAddress;
}

export function formatNearbyAddress(address: ReverseGeocodedAddress): {
  street: string;
  locality: string;
  region: string;
} {
  const street = [
    address.building,
    address.house_number,
    address.road || address.pedestrian || address.footway || address.residential,
  ].filter(Boolean).join(", ");
  const locality = [
    address.neighbourhood || address.quarter || address.suburb || address.city_district,
    address.city || address.town || address.village || address.county,
  ].filter(Boolean).join(", ");
  const region = [address.state_district || address.county, address.state, address.postcode, address.country]
    .filter(Boolean)
    .join(", ");
  return {
    street: street || address.display_name,
    locality,
    region,
  };
}
