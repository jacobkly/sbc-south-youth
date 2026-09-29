import type { MetadataRoute } from "next";
import { robotsFor } from "@/lib/seo";

// Decided when the site builds, like the launch gate.
export default function robots(): MetadataRoute.Robots {
  return robotsFor(process.env);
}
