import { useState } from "react";
import { Link } from "react-router";
import { OpinionBlock } from "../../components/semantics/OpinionBlock";
import type {
  CommunityPostCategory,
  CommunityPostIntent,
} from "../../selectors/community";

export type CommunityFeedProps = { posts: readonly CommunityPostIntent[] };
const categories = [
  "ALL",
  "TRENDING",
  "COMPETITIVE",
  "COLLECTORS",
  "OFFICIAL",
] as const;

export function CommunityFeed({ posts }: CommunityFeedProps) {
  const [category, setCategory] = useState<(typeof categories)[number]>("ALL");
  const visible =
    category === "ALL"
      ? posts
      : posts.filter((post) => post.category === category);
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap gap-2" aria-label="Community categories">
        {categories.map((item) => (
          <button
            key={item}
            type="button"
            aria-pressed={category === item}
            onClick={() => setCategory(item)}
            className={`rounded px-3 py-2 text-sm ${category === item ? "bg-emerald-500/20 text-emerald-300" : "text-slate-400"}`}
          >
            {item.slice(0, 1) + item.slice(1).toLowerCase()}
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="rounded border border-slate-800 p-4 text-slate-400">
          No structured community post intents in this category.
        </p>
      ) : (
        <ol className="space-y-4">
          {visible.map((post) => (
            <CommunityPost key={post.id} post={post} />
          ))}
        </ol>
      )}
    </section>
  );
}

function CommunityPost({ post }: { post: CommunityPostIntent }) {
  return (
    <li className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
      <div className="flex justify-between text-xs font-semibold uppercase tracking-wider text-slate-400">
        <span>{post.category as CommunityPostCategory}</span>
        <span>Day {post.day}</span>
      </div>
      <OpinionBlock title="Community opinion" source={post.category}>
        <p>{post.templateText}</p>
      </OpinionBlock>
      {post.links.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-3 text-sm">
          {post.links.map((link) => (
            <Link
              key={`${link.kind}-${link.id}`}
              className="text-emerald-300"
              to={link.href}
            >
              {link.label}
            </Link>
          ))}
        </div>
      )}
    </li>
  );
}
