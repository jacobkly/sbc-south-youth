"use client";

import { useState } from "react";
import { teamsFor } from "@/content/serve-teams";
import { type FieldErrors, limits, type StudentBand } from "@/lib/forms/schemas";
import { ChoiceCards, ChoiceTiles, FieldError, PrivacyNote, ReachFields, studentBands, TextArea, TextField } from "./fields";
import { MessageForm } from "./message-form";

function ServeFields({ errors }: { errors: FieldErrors }) {
  const [band, setBand] = useState<StudentBand>();
  const [teams, setTeams] = useState<string[]>([]);
  const offered = band ? teamsFor(band) : [];

  // Switching bands keeps only the picks the new band also has.
  function pickBand(value: string) {
    const next = value === "hs" ? "hs" : "college";
    const ids = teamsFor(next).map((team) => team.id);
    setBand(next);
    setTeams((picked) => picked.filter((id) => ids.includes(id)));
  }

  return (
    <>
      <TextField label="Your name" name="name" autoComplete="name" maxLength={limits.name} error={errors.name} />
      <ChoiceTiles legend="I'm in…" name="gradeBand" choices={studentBands} onValueChange={pickBand} error={errors.gradeBand} />
      {band ? (
        <ChoiceCards
          key={band}
          type="checkbox"
          legend="Which teams?"
          hint="Pick as many as you like."
          name="teams"
          choices={offered.map((team) => ({ value: team.id, label: team.title, body: team.body }))}
          values={teams}
          onValuesChange={setTeams}
          error={errors.teams}
          className="animate-appear motion-reduce:animate-none"
        />
      ) : (
        <div>
          <p className="text-[0.9375rem] font-semibold">Which teams?</p>
          <p className="mt-2.5 rounded-tile border border-dashed border-line-strong p-4 text-small text-pretty text-muted">
            Pick high school or college, and the teams for you show up here.
          </p>
          <FieldError id="teams-waiting">{errors.teams}</FieldError>
        </div>
      )}
      <ReachFields errors={errors} legend="How can the team leader reach you?" />
      <TextArea
        label="Anything else?"
        optional
        name="message"
        rows={3}
        limit={limits.note}
        hint="Like what you've done before, or a question."
        error={errors.message}
      />
    </>
  );
}

/** Pick the teams to try. The team leader follows up. */
export function ServeForm() {
  return (
    <MessageForm
      kind="serve"
      submitLabel="Count me in"
      finePrint={<PrivacyNote>We only use this to follow up.</PrivacyNote>}
      sent={{ as: "h3", againLabel: "Sign up someone else", next: { href: "/leaders", label: "Meet the leaders" } }}
    >
      {(errors) => <ServeFields errors={errors} />}
    </MessageForm>
  );
}
