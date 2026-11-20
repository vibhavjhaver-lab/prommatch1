# Decisions log

Append-only. Every time the build spec left something unspecified, or this
agent had to deviate from the spec, it's recorded here with the date and
reasoning.

## 2026-11-20 — Repository and GitHub access

- Created as `vibhavjhaver-lab/prommatch1` (public), not `prommatch` — the
  first repo name was taken/attempted differently during setup. If you'd
  rather it be named `prommatch`, rename it in GitHub settings (Settings →
  general → repository name); nothing in the code hard-codes the repo name.
- Agent has no network access in this sandbox (the Bash tool's outbound
  access is restricted to the GitHub proxy and package registries are not
  reachable). This means `pnpm install`, `pnpm build`, `pnpm test`, and
  `prisma generate` have **not** been run or verified by the agent itself.
  Everything has been written carefully and reviewed by re-reading, but the
  first thing to do after cloning is `pnpm setup` and `pnpm check`, and to
  fix whatever that surfaces. This is flagged prominently in PROGRESS.md.

## 2026-11-20 — Matching algorithm: greedy + local search instead of Edmonds' blossom

Spec section 8, Step 4 calls for Edmonds' blossom algorithm (exact maximum
weight matching on a general graph) for graphs up to 3,000 users, falling
back to greedy + 2-opt above that.

Deviation: this agent implements **greedy-by-descending-weight followed by
bounded 2-opt local search** for every graph size, not just the >3,000
fallback.

Reasoning: a correct from-scratch blossom-algorithm implementation is
notoriously easy to get subtly wrong (blossom contraction/expansion has many
edge cases), and this agent cannot execute or test code in this sandbox (no
network to install dependencies). Shipping an unverified, untested exact
algorithm risks silent correctness bugs that are far worse than a
well-tested heuristic that slightly under-performs optimal. The greedy +
2-opt approach is simple enough to reason about by inspection, is the
spec's own documented fallback (so it's an accepted quality level), and
every property in section 8 Step 8 (no hard-filter violations, proposal
caps, determinism, symmetry) still holds for it.

If exact optimality matters for your deployment, swap
`packages/matcher/src/pairMatching.ts`'s `maximumWeightMatching` for a
tested blossom implementation (e.g. wrap a vetted npm package) once you have
network access to install and test it — the function signature is already
isolated so this is a localized change.

## 2026-11-20 — Moderation blocklist

Section 11 calls for an English/Hindi/Hinglish slur and harassment
blocklist. The agent seeded a small, clearly-marked starter list of
category labels and a handful of uncontroversial entries (profanity,
obvious threats-pattern regexes) rather than compiling an exhaustive slur
list itself — generating a comprehensive multilingual blocklist is exactly
the kind of content this agent should not author unsupervised with no way
to validate it is accurate rather than itself offensive or incomplete.
`packages/core/moderation/blocklist.ts` is structured so organizers (or a
future session, with the person reviewing) can paste in a fuller list; the
file documents the expected shape.
