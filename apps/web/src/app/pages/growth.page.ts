import { Component, inject } from "@angular/core";
import { Meta, Title } from "@angular/platform-browser";
import { ActivatedRoute, RouterLink } from "@angular/router";
import { MarketingFooter } from "../layout/marketing-footer";

type BlogPost = {
  slug: string;
  category: string;
  title: string;
  description: string;
  readTime: string;
  sections: { heading: string; body: string[] }[];
};

const POSTS: BlogPost[] = [
  {
    slug: "seo-aeo-geo-ai-seo",
    category: "AI search",
    title: "SEO vs AEO vs GEO vs AI SEO: what each one means",
    description:
      "A plain-English guide to the four search visibility terms teams now use when planning content for Google, AI answers, and generative search.",
    readTime: "7 min read",
    sections: [
      {
        heading: "Quick definitions",
        body: [
          "SEO means improving pages so they can rank in traditional search results. It still covers technical health, useful content, internal links, authority, and matching the intent behind a query.",
          "AEO means answer engine optimization. The goal is to make your content easy to quote, summarize, or cite when a search engine, assistant, or answer surface gives a direct response.",
          "GEO means generative engine optimization. It overlaps with AEO, but focuses on visibility inside generated answers from tools like AI Overviews, Perplexity, ChatGPT-style search, and other AI discovery surfaces.",
          "AI SEO is the broad market phrase people use for adapting SEO work to AI-assisted search. In practice, it combines SEO foundations with AEO and GEO tactics.",
        ],
      },
      {
        heading: "What changed",
        body: [
          "People still search Google, but more searches end with a summarized answer. That means the page has to serve two audiences: the human reader and the machine summarizing the answer.",
          "Thin content is weaker than ever. Clear definitions, direct answers, source-backed claims, product facts, comparison tables, and real examples are easier for both humans and AI systems to understand.",
        ],
      },
      {
        heading: "How Duskly fits",
        body: [
          "Duskly is not an SEO crawler. It is the publishing layer after your content strategy is ready. Use it to turn one article, FAQ, release, or comparison page into consistent posts across social, blog, and community channels.",
          "That consistency matters for AI search because brands are easier to understand when the same facts, offers, and use cases appear clearly across owned pages and distribution channels.",
        ],
      },
    ],
  },
  {
    slug: "answer-engine-optimization-checklist",
    category: "AEO",
    title: "Answer engine optimization checklist for small teams",
    description:
      "A practical AEO checklist for making pages easier to quote in snippets, AI answers, FAQs, and direct-response search surfaces.",
    readTime: "6 min read",
    sections: [
      {
        heading: "Start with answer-first structure",
        body: [
          "Put the direct answer near the top of the page. A useful answer is short, specific, and easy to lift without needing three paragraphs of context.",
          "Use question headings, definition sentences, numbered steps, and concise tables. The page should be scannable even before someone reads the full article.",
        ],
      },
      {
        heading: "Add evidence and entity clarity",
        body: [
          "AEO is not just formatting. Add author names, dates, product names, pricing facts, supported platforms, and links to supporting docs where possible.",
          "If the page mentions your product, say exactly what it does. Ambiguous positioning makes it harder for answer engines to describe you accurately.",
        ],
      },
      {
        heading: "Distribute the answer",
        body: [
          "Turn each answer into social posts, support snippets, release notes, and FAQ updates. Duskly helps schedule that distribution so the answer appears consistently outside the original page.",
          "When the answer changes, update the original page first, then schedule follow-up posts that point back to the current source.",
        ],
      },
    ],
  },
  {
    slug: "generative-engine-optimization-for-founders",
    category: "GEO",
    title: "Generative engine optimization for founders",
    description:
      "How early-stage products can make their positioning clearer for AI-generated answers without hiring a large content team.",
    readTime: "5 min read",
    sections: [
      {
        heading: "Make the product easy to describe",
        body: [
          "Most GEO work starts with boring clarity. What is the product? Who is it for? What problem does it solve? Which alternatives does it replace?",
          "Put those answers on public pages, docs, pricing, changelogs, and comparison content. Generative engines need repeated, consistent facts before they can summarize you well.",
        ],
      },
      {
        heading: "Publish use cases, not only features",
        body: [
          "A feature list says what the product contains. A use-case page explains when someone should choose it. AI answers often need the second one.",
          "For Duskly, useful GEO pages include social media scheduler for agencies, RSS-to-social workflow, AI social post generator, and open-source Buffer alternative.",
        ],
      },
      {
        heading: "Keep distribution alive",
        body: [
          "GEO is not a one-time page edit. Every launch, integration, pricing change, and support answer should become public, structured content and then get distributed.",
          "A scheduler gives that content a longer shelf life because important facts keep resurfacing across channels.",
        ],
      },
    ],
  },
  {
    slug: "free-organic-traffic-tools",
    category: "Free tools",
    title: "Free organic traffic tools content teams should offer",
    description:
      "Free tools can bring high-intent organic traffic when they solve a real planning problem instead of acting like a thin lead magnet.",
    readTime: "6 min read",
    sections: [
      {
        heading: "Good free tools are small and specific",
        body: [
          "A useful tool gives the visitor an answer in under a minute: how often to post, how many captions to prepare, what questions to answer, or which channels to repurpose into.",
          "The best tools are close to the product workflow. For Duskly, that means scheduling, content planning, captions, SEO-to-social repurposing, and launch calendars.",
        ],
      },
      {
        heading: "Make the output useful without signup",
        body: [
          "Organic visitors should get value immediately. Then the product call-to-action can be simple: schedule these posts in Duskly.",
          "This builds trust and gives search engines a reason to rank the page beyond generic marketing copy.",
        ],
      },
      {
        heading: "Turn tool usage into publishing intent",
        body: [
          "After someone calculates a posting cadence or writes a caption, the next natural step is scheduling. That is where Duskly can convert organic traffic without a hard sell.",
        ],
      },
    ],
  },
];

function setPageMeta(title: Title, meta: Meta, pageTitle: string, description: string) {
  title.setTitle(`${pageTitle} | Duskly`);
  meta.updateTag({ name: "description", content: description });
}

@Component({
  standalone: true,
  selector: "dk-growth-nav",
  imports: [RouterLink],
  template: `
    <header class="border-b border-[#e4e4e7] bg-[#fbfbfa]/90 backdrop-blur-md">
      <div class="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <a routerLink="/" class="font-display text-[17px] font-extrabold tracking-tight">Dus<span class="text-cta">kly</span></a>
        <nav class="flex items-center gap-4 text-[13px] font-medium text-[#52525b] sm:gap-5">
          <a routerLink="/blog" class="hover:text-[#09090b]">Blog</a>
          <a routerLink="/tools" class="hover:text-[#09090b]">Free tools</a>
          <a routerLink="/signup" class="hidden rounded-full bg-cta px-3.5 py-2 text-[12px] font-semibold text-white hover:bg-cta-hover sm:inline-flex">Start scheduling</a>
        </nav>
      </div>
    </header>
  `,
})
export class GrowthNavComponent {}

@Component({
  standalone: true,
  imports: [RouterLink, MarketingFooter, GrowthNavComponent],
  template: `
    <div class="min-h-dvh bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <dk-growth-nav />
      <main class="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <p class="font-mono text-[12px] font-semibold uppercase tracking-wider text-cta">Blog</p>
        <h1 class="mt-5 max-w-4xl font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-6xl">Content ops, SEO, AEO, GEO, and AI publishing guides</h1>
        <p class="mt-6 max-w-2xl text-lg leading-8 text-[#52525b]">Practical articles for turning search-led ideas into scheduled posts, answer-ready pages, and repeatable distribution workflows.</p>
        <div class="mt-12 grid gap-5 md:grid-cols-2">
          @for (post of posts; track post.slug) {
            <a [routerLink]="['/blog', post.slug]" class="rounded-lg border border-[#e4e4e7] bg-white p-6 transition hover:border-zinc-300 hover:shadow-sm">
              <p class="font-mono text-[11px] font-semibold uppercase tracking-wider text-cta">{{ post.category }} · {{ post.readTime }}</p>
              <h2 class="mt-4 font-display text-2xl font-bold leading-tight tracking-normal">{{ post.title }}</h2>
              <p class="mt-3 text-sm leading-6 text-[#52525b]">{{ post.description }}</p>
            </a>
          }
        </div>
      </main>
      <dk-marketing-footer />
    </div>
  `,
})
export class BlogIndexPage {
  readonly posts = POSTS;

  constructor() {
    setPageMeta(inject(Title), inject(Meta), "Blog", "Duskly blog articles about SEO, AEO, GEO, AI SEO, free tools, and social content scheduling.");
  }
}

@Component({
  standalone: true,
  imports: [RouterLink, MarketingFooter, GrowthNavComponent],
  template: `
    <div class="min-h-dvh bg-[#fbfbfa] font-sans text-[#09090b] antialiased">
      <dk-growth-nav />
      <main class="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
        <a routerLink="/blog" class="font-mono text-xs font-semibold text-[#52525b] underline decoration-cta decoration-2 underline-offset-4">Back to blog</a>
        <p class="mt-8 font-mono text-[12px] font-semibold uppercase tracking-wider text-cta">{{ post.category }} · {{ post.readTime }}</p>
        <h1 class="mt-5 font-display text-4xl font-extrabold leading-[1.05] tracking-normal sm:text-5xl">{{ post.title }}</h1>
        <p class="mt-6 text-lg leading-8 text-[#52525b]">{{ post.description }}</p>
        <article class="mt-12 space-y-10">
          @for (section of post.sections; track section.heading) {
            <section>
              <h2 class="font-display text-2xl font-bold tracking-normal">{{ section.heading }}</h2>
              <div class="mt-4 space-y-4 text-[15px] leading-7 text-[#3f3f46]">
                @for (paragraph of section.body; track paragraph) {
                  <p>{{ paragraph }}</p>
                }
              </div>
            </section>
          }
        </article>
        <div class="mt-14 rounded-lg border border-[#e4e4e7] bg-white p-6">
          <h2 class="font-display text-2xl font-bold tracking-normal">Put the plan on a calendar</h2>
          <p class="mt-2 text-sm leading-6 text-[#52525b]">Duskly helps turn articles, FAQs, and launches into scheduled posts across social, blogs, and chat channels.</p>
          <a routerLink="/signup" class="mt-5 inline-flex h-10 items-center rounded-full bg-cta px-5 text-sm font-bold text-white hover:bg-cta-hover">Start scheduling</a>
        </div>
      </main>
      <dk-marketing-footer />
    </div>
  `,
})
export class BlogArticlePage {
  private readonly route = inject(ActivatedRoute);
  readonly post = POSTS.find((p) => p.slug === this.route.snapshot.paramMap.get("slug")) ?? POSTS[0];

  constructor() {
    setPageMeta(inject(Title), inject(Meta), this.post.title, this.post.description);
  }
}

