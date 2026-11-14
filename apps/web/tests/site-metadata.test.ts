import { describe, expect, it } from "vitest";
import { SITE_URL } from "../lib/site";

describe("production site metadata", () => {
  it("uses the custom production domain", () => {
    expect(SITE_URL).toBe("https://afterglow.jonzhang.dev");
  });
});
