import { expect, it } from "vitest";
import { TIME_FRAME_OPTIONS } from "./constants";

it("offers 5-7 Days immediately after 3-5 Days for diagnosis and repair", () => {
  expect(TIME_FRAME_OPTIONS[TIME_FRAME_OPTIONS.indexOf("3-5 Days") + 1]).toBe("5-7 Days");
});