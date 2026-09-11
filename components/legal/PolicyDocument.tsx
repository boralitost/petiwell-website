import { Dictionary } from "@/lib/dictionary";

type PolicyDoc = Dictionary["policies"]["privacy"];

type Props = {
  doc: PolicyDoc;
};

export function PolicyDocument({ doc }: Props) {
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="section-title">{doc.title}</h1>
          <p className="section-subtitle !max-w-none">{doc.intro}</p>
        </div>
        {doc.sections.map((section) => (
          <div key={section.id} className="space-y-2">
            <h2 className="text-base font-semibold text-charcoal">
              {section.title}
            </h2>
            <p className="text-sm text-muted leading-relaxed">{section.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
