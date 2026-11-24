"use client";

import { CircleQuestionMarkIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ResponsiveSheetContent } from "@/components/ui/responsive-sheet";
import { Sheet, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const STEPS = [
  "Open the Sales summary report in Square.",
  "Pick dates from a Monday to a Sunday, with All day.",
  "Set the view to Daily.",
  "Export the regular CSV.",
  "Press Import here, choose the file, and check the weeks before saving.",
];

// These mirror the rules in lib/income/square.ts and cafe-import.ts.
const ANSWERS = [
  {
    question: "Does it have to be Daily?",
    answer: "Only for more than one week in a file. A single week works in any view, and Daily always works.",
  },
  {
    question: "Regular or all data?",
    answer: "Regular. “Download all data as CSV” works too, but its extra rows are skipped.",
  },
  {
    question: "What if the dates aren’t full weeks?",
    answer: "A Daily file’s full weeks still go in. A week it only has part of is left out.",
  },
  {
    question: "Can I rename the file?",
    answer:
      "Keep the dates in its name. A “(1)” at the end is fine. A Summary file has no dates inside, so without them you’ll pick the week.",
  },
  {
    question: "What about weeks already entered?",
    answer: "They stay as they are unless you turn on “Replace what’s entered.” Two files for the same week are both left out.",
  },
];

/** A help icon for the Square import: how to get the file, and what the import does with it. */
export function SquareHelp({ className }: { className?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button type="button" variant="ghost" size="icon" className={cn("text-muted-foreground", className)}>
          <CircleQuestionMarkIcon />
          <span className="sr-only">How to import from Square</span>
        </Button>
      </SheetTrigger>
      <ResponsiveSheetContent>
        <SheetHeader className="pr-12">
          <SheetTitle>How to import from Square</SheetTitle>
          <SheetDescription>Nothing saves until you check the weeks and confirm.</SheetDescription>
        </SheetHeader>
        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4">
          <ol className="list-decimal space-y-1.5 pl-5 marker:text-muted-foreground">
            {STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
          <dl className="space-y-3 border-t pt-4">
            {ANSWERS.map(({ question, answer }) => (
              <div key={question} className="space-y-0.5">
                <dt className="font-medium">{question}</dt>
                <dd className="text-muted-foreground">{answer}</dd>
              </div>
            ))}
          </dl>
        </div>
      </ResponsiveSheetContent>
    </Sheet>
  );
}
