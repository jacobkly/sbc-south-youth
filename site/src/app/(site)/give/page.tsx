import type { Metadata } from "next";
import { GiveContent } from "@/components/site/give-content";
import { readServerEnv } from "@/lib/env";

export const metadata: Metadata = {
  title: "Give",
  description: "Give to SBC South Youth with Cash App, and see what your gift does.",
};

export default function GivePage() {
  return <GiveContent cashtag={readServerEnv().giveCashtag} />;
}
