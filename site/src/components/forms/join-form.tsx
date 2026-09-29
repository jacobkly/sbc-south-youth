"use client";

import { useState } from "react";
import { connect } from "@/content/connect";
import { type FieldErrors, limits } from "@/lib/forms/schemas";
import { ChoiceCards, ChoiceTiles, PrivacyNote, ReachFields, studentBands, TextField } from "./fields";
import { MessageForm } from "./message-form";

const options = connect.join.options.map((option) => ({ value: option.id, label: option.title, body: option.body }));

function JoinFields({ errors }: { errors: FieldErrors }) {
  const [band, setBand] = useState<string>();

  return (
    <>
      <TextField label="Your name" name="name" autoComplete="name" maxLength={limits.name} error={errors.name} />
      <ChoiceTiles legend="I'm in…" name="gradeBand" choices={studentBands} onValueChange={setBand} error={errors.gradeBand} />
      <ChoiceCards legend="What do you want to join?" name="group" choices={options} error={errors.group} />
      <ReachFields errors={errors} legend="Where should we send the link?" />
      {band === "hs" && (
        <TextField
          label="A parent or guardian's email"
          name="parentEmail"
          type="email"
          inputMode="email"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          maxLength={limits.email}
          hint={connect.join.parentNote}
          error={errors.parentEmail}
          className="animate-appear motion-reduce:animate-none"
        />
      )}
    </>
  );
}

/** Ask to join the group chat, a small group, or both. A leader sends the link. */
export function JoinForm() {
  return (
    <MessageForm
      kind="join"
      submitLabel="Ask to join"
      finePrint={<PrivacyNote>We only use this to add you.</PrivacyNote>}
      sent={{ as: "h3", againLabel: "Sign up someone else", next: { href: "/this-week", label: "See what's on" } }}
    >
      {(errors) => <JoinFields errors={errors} />}
    </MessageForm>
  );
}
