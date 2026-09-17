import type { PolicyDoc } from "@/lib/legal-consumer";

type Props = {
  doc: PolicyDoc;
};

export function PolicyDocument({ doc }: Props) {
  return (
    <section className="section-shell">
      <div className="mx-auto max-w-3xl space-y-8">
        <div>
          <h1 className="section-title">{doc.title}</h1>
          <p className="section-subtitle !max-w-none whitespace-pre-line">
            {doc.intro}
          </p>
          {doc.lastUpdated ? (
            <p className="mt-3 text-xs text-muted">v {doc.lastUpdated}</p>
          ) : null}
        </div>
        {doc.sections.map((section) => (
          <div key={section.id} className="space-y-2">
            <h2 className="text-base font-semibold text-charcoal">
              {section.title}
            </h2>
            <p className="whitespace-pre-line text-sm leading-relaxed text-muted">
              {section.body}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
