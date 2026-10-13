import { describe, expect, it } from "vitest";
import {
  ANNOUNCEMENT_CATEGORIES,
  ANNOUNCEMENT_PRIORITIES,
  categoryLabel,
  formatAnnouncementDate,
  priorityLabel,
} from "@/types/publicInformation";

describe("public information labels", () => {
  it("provides distinct categories and priority levels", () => {
    expect(new Set(ANNOUNCEMENT_CATEGORIES.map((item) => item.value)).size).toBe(10);
    expect(new Set(ANNOUNCEMENT_PRIORITIES.map((item) => item.value)).size).toBe(4);
  });

  it("uses human-readable labels and preserves unknown categories", () => {
    expect(categoryLabel("missing_person")).toBe("Missing person");
    expect(priorityLabel("critical")).toBe("Critical");
    expect(categoryLabel("future_category")).toBe("future_category");
  });

  it("formats valid dates and handles absent or invalid dates safely", () => {
    expect(formatAnnouncementDate(null)).toBe("Not scheduled");
    expect(formatAnnouncementDate("not-a-date")).toBe("Date unavailable");
    expect(formatAnnouncementDate("2026-10-13T09:00:00.000Z")).not.toBe("Date unavailable");
  });
});
