import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsArticle } from "@/components/site/DocsArticle";
import { DocsNav } from "@/components/site/DocsNav";
import { SiteFrame } from "@/components/site/SiteFrame";
import { DOC_PAGES, docBySlug } from "@/lib/docsContent";

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return DOC_PAGES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const page = docBySlug(slug);
  if (!page) return { title: "Docs" };
  return { title: page.title, description: page.summary };
}

export default async function DocsSlugPage({ params }: Props) {
  const { slug } = await params;
  const page = docBySlug(slug);
  if (!page) notFound();

  return (
    <SiteFrame>
      <main id="main" className="site-main">
        <div className="docs-layout">
          <DocsNav />
          <DocsArticle page={page} />
        </div>
      </main>
    </SiteFrame>
  );
}
