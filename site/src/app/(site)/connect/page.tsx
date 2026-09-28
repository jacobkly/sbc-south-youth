import type { Metadata } from "next";
import { PageIntro } from "@/components/site/page-intro";
import { Stub } from "@/components/site/stub";

export const metadata: Metadata = { title: "Connect & Serve" };

export default function ConnectPage() {
  return (
    <>
      <PageIntro eyebrow="Connect & Serve" title="Come. Connect. Serve.">
        Join a group chat, find your people, and help out on a team.
      </PageIntro>
      <Stub note="The three-step path and the join and serve forms go here." />
    </>
  );
}
