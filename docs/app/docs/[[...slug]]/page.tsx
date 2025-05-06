import { source } from '@/lib/source';
import {
  DocsPage,
  DocsBody,
  DocsDescription,
  DocsTitle,
} from 'fumadocs-ui/page';
import { notFound } from 'next/navigation';
// import { createRelativeLink } from 'fumadocs-ui/mdx';
import { getMDXComponents } from '@/mdx-components';
import type { Metadata } from 'next';

export default async function Page(props: {
  params: Promise<{ slug?: string[] }>;
}) {
  const params = await props.params;
  const page = source.getPage(params.slug);
  if (!page) notFound();

  const MDXContent = page.data.body;

  return (
    <DocsPage tableOfContent={{
      style: 'clerk',
    }} toc={page.data.toc} full={page.data.full}>
      <DocsTitle>{page.data.title}</DocsTitle>
      <DocsDescription>{page.data.description}</DocsDescription>
      <DocsBody>
        <MDXContent
          components={getMDXComponents({
            // TODO Consider static export instead of edge runtime https://fumadocs.dev/docs/ui/static-export#built-in-search
            // NOTE Commented out for compatibility with Cloudflare Pages edge runtime (Error: `createRelativeLink` is only supported in Node.js environment)
            // this allows you to link to other pages with relative file paths
            // a: createRelativeLink(source, page),
          })}
        />
      </DocsBody>
    </DocsPage>
  );
}

// NOTE Commented out for compatibility with Cloudflare Pages edge runtime
// export async function generateStaticParams() {
//   return source.generateParams();
// }

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug?: string[] }>;
}) {
  const { slug = [] } = await params;
  const page = source.getPage(slug);
  if (!page) notFound();

  const image = ['/docs-og', ...slug, 'image.png'].join('/');
  return {
    metadataBase: new URL('https://tight.sh'),
    title: page.data.title,
    description: page.data.description,
    openGraph: {
      images: image,
    },
    twitter: {
      card: 'summary_large_image',
      images: image,
    },
  } satisfies Metadata;
}

export const runtime = "edge";
