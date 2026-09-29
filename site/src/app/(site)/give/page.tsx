import type { Metadata } from "next";
import { GiveContent } from "@/components/site/give-content";
import { pages } from "@/content/pages";
import { readServerEnv } from "@/lib/env";
import { pageMetadata } from "@/lib/metadata";

export const metadata: Metadata = pageMetadata(pages.give);

export default function GivePage() {
  return <GiveContent cashtag={readServerEnv().giveCashtag} />;
}
