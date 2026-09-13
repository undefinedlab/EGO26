import Link from "next/link";
import type { DocPage } from "@/lib/docsContent";
import { DOC_PAGES } from "@/lib/docsContent";

export function DocsArticle({ page }: { page: DocPage }) {
  const idx = DOC_PAGES.findIndex((p) => p.slug === page.slug);
  const prev = idx > 0 ? DOC_PAGES[idx - 1] : null;
  const next = idx >= 0 && idx < DOC_PAGES.length - 1 ? DOC_PAGES[idx + 1] : null;

  return (
    <article className="site-panel docs-article">
      <p className="kicker">Documentation</p>
      <h1 className="docs-h1">{page.title}</h1>
      <p className="docs-summary">{page.summary}</p>

      {page.sections.map((section) => (
        <section key={section.heading} className="docs-section">
          <h2>{section.heading}</h2>
          {section.paragraphs
            ?.filter((p) => p.length > 0)
            .map((para) => (
              <p key={para.slice(0, 72)}>{para}</p>
            ))}
          {section.steps?.length ? (
            <ol className="docs-steps">
              {section.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          ) : null}
          {section.bullets?.length ? (
            <ul className="docs-list">
              {section.bullets.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          ) : null}
          {section.diagram ? (
            <pre className="docs-diagram" aria-label={`${section.heading} diagram`}>
              {section.diagram}
            </pre>
          ) : null}
          {section.note ? <aside className="docs-note">{section.note}</aside> : null}
        </section>
      ))}

      <nav className="docs-pager" aria-label="Adjacent docs">
        {prev ? (
          <Link href={`/docs/${prev.slug}`} className="docs-pager-link">
            ← {prev.nav}
          </Link>
        ) : (
          <span />
        )}
        {next ? (
          <Link href={`/docs/${next.slug}`} className="docs-pager-link docs-pager-link--next">
            {next.nav} →
          </Link>
        ) : (
          <span />
        )}
      </nav>
    </article>
  );
}
