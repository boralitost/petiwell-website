"use client";

import { useMemo, useState } from "react";
import { TR_CITY_NAMES, districtsForCity } from "@/lib/tr-locations";

const selectClass =
  "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm";

type Props = {
  cityLabel: string;
  districtLabel: string;
  defaultCity?: string;
  defaultDistrict?: string;
  required?: boolean;
};

export function CityDistrictFields({
  cityLabel,
  districtLabel,
  defaultCity = "",
  defaultDistrict = "",
  required = true
}: Props) {
  const initialCity = TR_CITY_NAMES.includes(defaultCity) ? defaultCity : "";
  const [city, setCity] = useState(initialCity);
  const districts = useMemo(() => districtsForCity(city), [city]);
  const initialDistrict = districts.includes(defaultDistrict)
    ? defaultDistrict
    : "";

  return (
    <>
      <select
        name="city"
        required={required}
        value={city}
        onChange={(e) => setCity(e.target.value)}
        className={selectClass}
      >
        <option value="">{cityLabel}</option>
        {TR_CITY_NAMES.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
      <select
        name="district"
        required={required}
        defaultValue={initialDistrict}
        key={city}
        disabled={!city}
        className={selectClass}
      >
        <option value="">{districtLabel}</option>
        {districts.map((name) => (
          <option key={name} value={name}>
            {name}
          </option>
        ))}
      </select>
    </>
  );
}
