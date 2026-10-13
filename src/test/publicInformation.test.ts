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
    const categories = ANNOUNCEMENT_CATEGORIES.map((item) => item.value);
    const priorities = ANNOUNCEMENT_PRIORITIES.map((item) => item.value);

    expect(new Set(categories).size).toBe(10);
    expect(new Set(priorities).size).toBe(4);
  });

  it("uses human-readable labels and preserves unknown categories", () => {
    expect(categoryLabel("missing_person")).toBe("Missing person");
    expect(priorityLabel("critical")).toBe("Critical");
    expect(categoryLabel("future_category")).toBe("future_category");
  });

  it("formats valid dates and handles absent or invalid dates safely", () => {
    expect(formatAnnouncementDate(null)).toBe("Not scheduled");
    expect(formatAnnouncementDate("not-a-date")).toBe("Date unavailable");
    const formatted = formatAnnouncementDate("2026-10-13T09:00:00.000Z");

    expect(formatted).not.toBe("Date unavailable");
  });
});
