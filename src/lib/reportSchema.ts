// lib/reportSchema.ts
import { z } from "zod";

const CATEGORY_IDS = [
  "attack",
  "kidnapping",
  "fire",
  "flood",
  "medical",
  "accident",
  "crime",
  "building_collapse",
  "missing_person",
  "road_damage",
  "power_outage",
  "water_issue",
] as const;

export const reportSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(100, "Title is too long"),
  category: z.enum(CATEGORY_IDS, { error: "Select an emergency category" }),
  description: z
    .string()
    .trim()
    .min(10, "Please describe what's happening (at least 10 characters)")
    .max(1000, "Description is too long"),
  contact: z
    .string()
    .trim()
    .optional()
    .refine(
      (val) => !val || /^[0-9+\s-]{7,15}$/.test(val),
      "Enter a valid phone number",
    ),
  location: z
    .object({
      lat: z.number().optional(),
      lng: z.number().optional(),
      accuracyMetres: z.number().nonnegative().optional(),
      address: z.string().optional(),
      manualEntry: z.string().trim().optional(),
    })
    .refine(
      (loc) =>
        (loc.lat !== undefined && loc.lng !== undefined) || !!loc.manualEntry,
      { message: "Provide a location — enable GPS or enter it manually" },
    ),
  images: z
    .array(
      z.object({
        id: z.string(),
        dataUrl: z.string(),
        fileName: z.string(),
        sizeBytes: z.number(),
        kind: z.enum(["image", "video"]),
      }),
    )
    .max(5, "You can attach up to 5 evidence items"),
});

export type ReportSchemaType = z.infer<typeof reportSchema>;
