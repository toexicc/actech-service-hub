import { describe, expect, it } from "vitest";
import { CHECK_PARTS_GUIDE, COMPANY_GUIDE, INVENTORY_GUIDE, PARTS_REQUEST_GUIDE, type PageGuideContent } from "./pageGuides";

const guides: [string, PageGuideContent][] = [
  ["inventory", INVENTORY_GUIDE],
  ["company", COMPANY_GUIDE],
  ["check parts", CHECK_PARTS_GUIDE],
  ["parts requests", PARTS_REQUEST_GUIDE],
];

for (const [name, guide] of guides) {
  describe(`${name} guide`, () => {
    it("has unique section ids and something to show in every section", () => {
      const ids = guide.sections.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
      guide.sections.forEach((s) => {
        expect((s.points?.length ?? 0) + (s.steps?.length ?? 0) > 0).toBe(true);
      });
    });

    it("closes every **bold** marker", () => {
      const texts = guide.sections.flatMap((s) => [s.intro ?? "", ...(s.points ?? []), ...(s.steps ?? []), ...(s.tips ?? [])]);
      texts.forEach((t) => expect((t.match(/\*\*/g) ?? []).length % 2).toBe(0));
    });
  });
}
