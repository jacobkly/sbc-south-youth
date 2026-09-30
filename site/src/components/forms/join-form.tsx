"use client";

import { limits } from "@/lib/forms/schemas";
import { ChoiceTiles, PrivacyNote, ReachFields, studentBands, TextField } from "./fields";
import { MessageForm } from "./message-form";

/** Ask to join the group chat. A leader adds regulars. */
export function JoinForm() {
  return (
    <MessageForm
      kind="join"
      submitLabel="Ask to join"
      finePrint={<PrivacyNote>We only use this to add you.</PrivacyNote>}
      sent={{ as: "h3", againLabel: "Sign up someone else", next: { href: "/this-week", label: "See what's on" } }}
    >
      {(errors) => (
        <>
          <TextField label="Your name" name="name" autoComplete="name" maxLength={limits.name} error={errors.name} />
          <ChoiceTiles legend="Right now I'm…" optional name="band" choices={studentBands} error={errors.band} />
          <ReachFields errors={errors} legend="How can a leader add you?" />
        </>
      )}
    </MessageForm>
  );
}
