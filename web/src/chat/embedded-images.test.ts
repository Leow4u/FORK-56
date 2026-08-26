import { describe, expect, it } from "vitest";

import {
  extractEmbeddedImages,
  extractImageRefs,
  imageRefPath,
} from "./embedded-images";

describe("embedded-images", () => {
  it("extracts data-url images from text", () => {
    const b64 = "A".repeat(80);
    const url = `data:image/png;base64,${b64}`;
    const result = extractEmbeddedImages(`see ${url} please`);
    expect(result.images).toEqual([url]);
    expect(result.cleanedText).toBe("see  please");
  });

  it("lifts @image refs out of text", () => {
    const result = extractImageRefs("@image:/tmp/a.png\nhello");
    expect(result.refs).toEqual(["@image:/tmp/a.png"]);
    expect(result.cleanedText).toBe("hello");
  });

  it("parses ref paths", () => {
    expect(imageRefPath("@image:`/repo/x.png`")).toBe("/repo/x.png");
    expect(imageRefPath("@image:/repo/x.png")).toBe("/repo/x.png");
  });
});
