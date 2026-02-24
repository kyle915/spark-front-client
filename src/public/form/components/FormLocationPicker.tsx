import { useEffect, useState } from "react";
import { Controller } from "react-hook-form";
import type { LatLngExpression } from "leaflet";
import { Marker, useMap } from "react-leaflet";
import type { Control, UseFormSetValue } from "react-hook-form";
import type { SparkFormData } from "../schema/schema";
import * as L from "leaflet";

import InteractiveMap from "@/shared/InteractiveMap";
import MapSearchControl from "@/shared/MapSearchControl";

// Fallback to Times Square, NY
const FALLBACK_POSITION: [number, number] = [40.758, -73.9855];

const defaultMarkerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface Props {
  control: Control<SparkFormData>;
  setValue: UseFormSetValue<SparkFormData>;
  nameLat: keyof SparkFormData;
  nameLng: keyof SparkFormData;
  label?: string;
  height?: string;
}

const MapSearchControlWrapper = ({
  onSelect,
}: {
  onSelect: (lat: number, lng: number) => void;
}) => {
  const map = useMap();

  return (
    <MapSearchControl
      map={map}
      onSelect={(result) => onSelect(result.lat, result.lng)}
    />
  );
};

export default function FormLocationPicker({
  control,
  nameLat,
  nameLng,
  label = "Select location",
  height = "h-56 sm:h-64 md:h-[320px]",
  setValue,
}: Props) {
  const [initialPosition, setInitialPosition] =
    useState<LatLngExpression>(FALLBACK_POSITION);

  // Detect real user location
  useEffect(() => {
    if (!navigator.geolocation) {
      setValue(nameLat, FALLBACK_POSITION[0]);
      setValue(nameLng, FALLBACK_POSITION[1]);
      setInitialPosition(FALLBACK_POSITION);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        setValue(nameLat, lat);
        setValue(nameLng, lng);
        setInitialPosition([lat, lng]);
      },
      () => {
        setValue(nameLat, FALLBACK_POSITION[0]);
        setValue(nameLng, FALLBACK_POSITION[1]);
        setInitialPosition(FALLBACK_POSITION);
      }
    );
  }, [nameLat, nameLng, setValue]);

  return (
    <div className="space-y-3 w-full">
      <p className="font-semibold">{label}</p>

      <Controller
        name={nameLat}
        control={control}
        render={({ field: latField }) => (
          <Controller
            name={nameLng}
            control={control}
            render={({ field: lngField, fieldState: { error } }) => {
              const lat = parseFloat(String(latField.value ?? ""));
              const lng = parseFloat(String(lngField.value ?? ""));

              const center: LatLngExpression =
                !isNaN(lat) && !isNaN(lng) ? [lat, lng] : initialPosition;

              const handleClick = (lat: number, lng: number) => {
                latField.onChange(lat);
                lngField.onChange(lng);
                setInitialPosition([lat, lng]);
              };

              return (
                <>
                  <InteractiveMap
                    center={center}
                    zoom={14}
                    height={height}
                    onMapClick={handleClick}
                  >
                    <MapSearchControlWrapper onSelect={handleClick} />
                    <Marker position={center} icon={defaultMarkerIcon} />
                  </InteractiveMap>

                  {error && (
                    <p className="text-xs text-error mt-1">{error.message}</p>
                  )}
                </>
              );
            }}
          />
        )}
      />

      <p className="text-xs opacity-60">
        Click on the map to set the location.
      </p>
    </div>
  );
}
