import { Fragment, type ReactNode } from "react";
import { BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { PageGuideContent } from "@/lib/pageGuides";

// "Click **Import CSV**" → "Click <strong>Import CSV</strong>": button and tab names stand out in the steps.
const inline = (text: string): ReactNode =>
  text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
    i % 2 === 1 ? <strong key={i} className="font-semibold text-foreground">{part}</strong> : <Fragment key={i}>{part}</Fragment>,
  );

/** "How to use" button that opens a step-by-step guide for the page in a side panel. */
export function PageGuide({ guide, label = "How to use" }: { guide: PageGuideContent; label?: string }) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="shrink-0">
          <BookOpen className="mr-1.5 h-4 w-4" />
          {label}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader className="pr-6 text-left">
          <SheetTitle>{guide.title}</SheetTitle>
          <SheetDescription>{guide.intro}</SheetDescription>
        </SheetHeader>
        <Accordion type="single" collapsible defaultValue={guide.sections[0]?.id} className="mt-4">
          {guide.sections.map((section) => (
            <AccordionItem key={section.id} value={section.id}>
              <AccordionTrigger className="text-left text-sm">{section.title}</AccordionTrigger>
              <AccordionContent className="space-y-3 text-sm text-muted-foreground">
                {section.who && (
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">For {section.who}</p>
                )}
                {section.intro && <p>{inline(section.intro)}</p>}
                {section.points && section.points.length > 0 && (
                  <ul className="space-y-1.5">
                    {section.points.map((point, i) => (
                      <li key={i} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                        <span>{inline(point)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.steps && section.steps.length > 0 && (
                  <ol className="space-y-2">
                    {section.steps.map((step, i) => (
                      <li key={i} className="flex gap-3">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {i + 1}
                        </span>
                        <span className="pt-0.5">{inline(step)}</span>
                      </li>
                    ))}
                  </ol>
                )}
                {section.tips && section.tips.length > 0 && (
                  <ul className="space-y-1 rounded-md border bg-muted/40 p-3 text-xs">
                    {section.tips.map((tip, i) => (
                      <li key={i}>
                        <span className="font-semibold text-foreground">Tip: </span>
                        {inline(tip)}
                      </li>
                    ))}
                  </ul>
                )}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </SheetContent>
    </Sheet>
  );
}
