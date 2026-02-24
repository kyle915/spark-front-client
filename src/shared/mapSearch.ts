export type PhotonResult = {
  lat: number;
  lng: number;
  label: string;
  description: string;
};

const PHOTON_ENDPOINT = "https://photon.komoot.io/api/";

const buildDescription = (props: Record<string, unknown>): string => {
  const parts = [
    props.name,
    props.street,
    props.housenumber,
    props.district,
    props.city,
    props.state,
    props.country,
  ]
    .map((value) => (typeof value === "string" ? value : null))
    .filter(Boolean);

  return parts.join(", ");
};

type PhotonFeature = {
  geometry?: {
    coordinates?: unknown[];
  };
  properties?: Record<string, unknown>;
};

export const searchPhotonLocations = async (
  query: string,
  signal?: AbortSignal,
  limit = 5,
): Promise<PhotonResult[]> => {
  const response = await fetch(
    `${PHOTON_ENDPOINT}?q=${encodeURIComponent(query)}&limit=${limit}&lang=en`,
    { signal },
  );

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  const data = await response.json();
  const features: PhotonFeature[] = Array.isArray(data?.features)
    ? data.features
    : [];

  return features
    .map((feature) => {
      const coords = feature.geometry?.coordinates;
      const props = feature.properties ?? {};
      const lng = Number.parseFloat(String(coords?.[0]));
      const lat = Number.parseFloat(String(coords?.[1]));

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null;
      }

      const label =
        typeof props.name === "string" && props.name.length > 0
          ? props.name
          : buildDescription(props) || "Unknown location";

      return {
        lat,
        lng,
        label,
        description: buildDescription(props),
      };
    })
    .filter((value: PhotonResult | null): value is PhotonResult =>
      Boolean(value),
    );
};
