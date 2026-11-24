"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type Option = { value: string; label: string };

/** A filter select that applies on change, keeping the other filters (TRK-7). */
export function FilterSelect({ name, label, options }: { name: string; label: string; options: Option[] }) {
  const router = useRouter();
  const path = usePathname();
  const params = useSearchParams();
  return (
    <select
      className="select filter"
      aria-label={label}
      title={options.find((o) => o.value === (params.get(name) ?? ""))?.label ?? label}
      value={params.get(name) ?? ""}
      onChange={(e) => {
        const next = new URLSearchParams(params);
        if (e.target.value) next.set(name, e.target.value);
        else next.delete(name);
        next.delete("page");
        router.push(next.size ? `${path}?${next}` : path);
      }}
    >
      <option value="">{label}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}
