import { z } from "zod";

/** Size limit of `docs/features.json`, in bytes (about 6,500 tokens). Raise it deliberately. */
export const MAX_BYTES = 26_000;

export const STATUSES = ["done", "partial", "not-started", "removed"] as const;

export const featureSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    summary: z.string().min(1).max(200),
    status: z.enum(STATUSES),
    milestone: z.enum(["M0", "M1", "M2", "M3", "M4"]),
    paths: z.array(z.string().min(1)),
    docs: z.array(z.string().min(1)),
    reason: z.string().min(1).optional(),
  })
  .refine((f) => f.status !== "removed" || f.reason, {
    message: "a removed feature needs a reason",
    path: ["reason"],
  })
  .refine((f) => f.status !== "done" || f.paths.length > 0, {
    message: "a done feature needs paths as evidence",
    path: ["paths"],
  });

export const featuresFileSchema = z
  .object({
    generated: z.string(),
    features: z.array(featureSchema),
  })
  .refine((f) => new Set(f.features.map((x) => x.id)).size === f.features.length, {
    message: "feature ids must be unique",
  });

export type Feature = z.infer<typeof featureSchema>;
export type FeaturesFile = z.infer<typeof featuresFileSchema>;
