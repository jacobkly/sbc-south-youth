import { describe, expect, it } from "vitest";
import { directionsUrl, isAppleMobile } from "./directions";

const address = "123 Example Street, Anytown, CA 00000";

describe("directionsUrl", () => {
  it("builds a Google Maps route to the address", () => {
    expect(directionsUrl(address, "google")).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=123+Example+Street%2C+Anytown%2C+CA+00000",
    );
  });

  it("builds an Apple Maps route to the address", () => {
    expect(directionsUrl(address, "apple")).toBe(
      "https://maps.apple.com/?daddr=123+Example+Street%2C+Anytown%2C+CA+00000",
    );
  });
});

describe("isAppleMobile", () => {
  it("spots iPhones and iPads, including iPads that say they're Macs", () => {
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)", maxTouchPoints: 5 })).toBe(true);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 5 })).toBe(true);
  });

  it("leaves out Macs and Android phones", () => {
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)", maxTouchPoints: 0 })).toBe(false);
    expect(isAppleMobile({ userAgent: "Mozilla/5.0 (Linux; Android 15; Pixel 9)", maxTouchPoints: 5 })).toBe(false);
  });
});
