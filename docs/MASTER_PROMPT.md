# NOVAX OPS — Master Prompt for LLM Analysis & Strategy

---

## WHAT YOU ARE BEING ASKED TO DO

You are being given a deep brief about a real, live software product — a social media agency operations platform called NOVAX Ops. This is not a hypothetical. The code has been fully audited. Everything described below reflects the actual state of the codebase, confirmed line by line.

Your job is to:
1. Think deeply about the **strategic question**: why would any real agency team use this instead of ChatGPT/Claude Pro + Google Sheets?
2. Identify the **highest-leverage improvements** — simple additions that add disproportionate value
3. Give **specific, actionable suggestions** — not generic advice
4. Think from the perspective of the actual users: account managers, copywriters, creative directors, and the agency CEO
5. Challenge every assumption about what the app should be

Do not give fluffy, generic advice. Be specific. If you suggest a feature, describe exactly how it would work. Be ruthless about what is and isn't valuable.

---

## THE PRODUCT: NOVAX OPS

**What it is:** A web-based operations platform built for a social media agency called NOVAX. It replaces ClickUp as their internal project management system, adds AI-powered content creation tools, handles client approval workflows, connects to their scheduling tool (Metricool), and manages assets. It is being evolved into a multi-tenant SaaS that other agencies can sign up for.

**Live at:** https://www.novaxops.com (Vercel, Next.js 15 + Supabase)

**The team using it:** ~10 people — account managers, copywriters, a creative director, designers, social managers, and a CEO. They manage roughly 10–15 social media clients simultaneously, each with their own brand voice, platforms, and content calendar.

**What they do day to day:**
- Receive a brief from a client (or create one internally)
- Generate content ideas, hooks, captions, scripts
- Design visuals (external, not in this app)
- Schedule posts on Instagram, TikTok, LinkedIn, Facebook, YouTube
- Get client approval before publishing
- Monitor comments and DMs and reply to them
- Report on performance monthly

---

## TECH STACK (BRIEF)

- **Frontend:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, shadcn/ui
- **Backend:** Next.js API routes (Node.js runtime, no Edge Functions)
- **Database:** Supabase (Postgres + Auth + Storage + RLS)
- **AI (primary):** Anthropic Claude (claude-sonnet-4-6, claude-opus-4-7) via @anthropic-ai/sdk
- **AI (fallback):** Google Gemini (gemini-3-flash-preview) via REST
- **Scheduling:** Metricool API (token-based, not OAuth — one agency account, clients mapped by blogId)
- **Moderation:** Chatwoot (webhook receives comments/DMs; reply sender partially built)
- **Social scraping:** Apify, YouTube Data API, custom scrapers
- **Email:** Resend
- **State management:** TanStack Query v5
- **Rich text:** Tiptap v3
- **Charts:** Recharts
- **Drag and drop:** @dnd-kit
- **File processing:** sharp, pptxgenjs, @react-pdf/renderer, xlsx

---

## WHAT IS GENUINELY WORKING (CONFIRMED IN CODE)

### Core Operations
- **Pipeline (Kanban):** 10-stage drag-and-drop board (strategy → ideas → calendar → copy → design → review → approval → scheduled → published → reporting). Real Supabase data. Drag-and-drop with @dnd-kit. URL-synced filters. Realtime subscription. Works well.
- **Task management:** Tasks assigned to users, with priorities, due dates, pipeline stages, sub-types. Comments. AI agents (5 types: task_analyzer, copywriter, researcher, asset_finder, post_caption) embedded in a slide-over panel.
- **Client management:** Client cards with detail modal (Overview / Intelligence / Tasks / Context Bank / Strategy / Competitors tabs). 9-step new client wizard. Crisis Mode toggle per client. Design Brief form with canvas sizes, fonts, colors. Real data, real CRUD.
- **Publishing:** Grid + Calendar view of scheduled posts. Compose dialog with single/carousel media modes. Per-platform overrides. Metricool scheduling. AI caption generation (English + Arabic). Edit/delete/reschedule/stats-sync. Works end-to-end.
- **Approval workflow:** Internal approval management. Shareable token links sent to clients. Public portal at `/approval/[token]` — clients can approve, request changes, leave notes per post. Email notification via Resend when approval is submitted. This is a real differentiator.
- **Moderation queue:** Comments/DMs fed in via Chatwoot webhook. AI reply generation. Send/escalate/ignore actions. Per-client filter. Realtime updates.
- **Asset library:** Upload to Supabase Storage, import from Google Drive (OAuth). Per-client filter. Tag + search.
- **Reports:** KPI charts via Recharts, Metricool analytics data, Claude-generated narrative, PPTX + PDF export.
- **Documents:** Tiptap rich text editor. Templates. Public sharing via token link.
- **Settings:** Team management, bulk invite (10-row sheet), bulk page permissions, per-user role assignment, integrations config (admin-only). Activity tab showing AI cost per user.
- **CEO Hub:** Strategy analysis, crisis override, second opinion — all Claude-backed.
- **Work Diary:** Daily reflections per team member. Admin can read all. Efficiency scores.

### Studio Tools (All real Supabase sessions + AI — confirmed working end-to-end unless noted)
- **Content Studio:** Brief → two-pass hook generation → per-piece content scripting (reel/carousel/static, up to 3 pieces) → Boss Brief (30-second exec summary). Expandable output cards. Excel/PDF export. Session persistence with resume-from-URL.
- **Hook Lab:** 20 divergent hooks → 3C scoring + SCAMPER filter → top ranked output. Session persistence. Boss Brief.
- **Strategy:** Double Diamond pipeline. Esplanade format. PPTX export. Claude Opus two-pass (pass 1 + reflection). Long but real.
- **Campaign Igniter:** 7 phases. Cultural tensions + constraint inversion → 5 execution briefs.
- **Inspiration Library:** Live trends from YouTube, TikTok, Reddit via Apify. Save to per-client boards.
- **Post-Mortem:** Why didn't this content perform? Hook/format/timing/caption diagnosis.
- **Visual Content Engine:** Brief → 3 creative treatment options → full scene-by-scene prompts (Midjourney/Kling/Veo3-ready).
- **Peak Format Generator:** Enter niche → 5 viral formats with hook stacks, 3-law validation, episode structure, payoff architecture.
- **Copy Engine:** Image-to-caption with framework selection (AIDA, PAS, BAB, etc.), Arabic dialect, Pinterest style learning.
- **Competitive Intelligence:** Apify-powered competitor scraping. Gap map, threat assessment. Results injected into every studio prompt.
- **Media Buying Plan:** 10-step pipeline. Market research, customer avatars, platform strategy, budget allocation, lead forecasting. PDF export.

### Client Intelligence Layer (This is the most important architectural piece)
Every AI call in the system receives a context block built by `lib/client-intelligence.ts` that includes:
1. **Normalized client profile** — brand voice, tone, audience, positioning, platforms, posting cadence, emoji/hashtag policy, banned topics, CTA, Arabic dialect
2. **Context bank** — last 10 active entries from `client_context_bank` table. Team manually adds wins, brand voice captures, objections, signals, recent feedback.
3. **Negative AI feedback** — last 8 thumbs-down corrections for this specific agent type for this client. These are team members saying "don't write like this for this client" and those notes get injected back.
4. **Quarterly strategy excerpt** — current quarter goals, themes, KPIs from the strategy tool output
5. **Pinterest style learning** — structural patterns the team has saved as "borrow" references across copy sessions
6. **Competitor context** — latest competitor intelligence report (7-day TTL): top competitor ER rates, hooks to avoid, underused hook opportunities, recommended formats

This block is hard-capped at 3000 characters and injected into every AI call. It is the app's most important differentiator over a blank ChatGPT chat.

---

## THE CORE STRATEGIC PROBLEM

**Why would an agency team use this instead of opening Claude.ai, pasting a client brief, and asking for the same output in 30 seconds?**

Honest answer: **Right now, they mostly wouldn't — for the AI features specifically.** A skilled copywriter with Claude Pro can replicate 80% of the Studio output by writing a good prompt manually. The real differentiators are:

1. **The scheduling + approval workflow** — you can't do that in ChatGPT. Creating a post, getting client approval on a token link, and scheduling to Metricool in one flow is genuinely valuable.
2. **Team collaboration with roles** — ChatGPT is single-user. This app has roles, task assignment, workload management.
3. **The context bank** — IF the team fills it in, the AI gets better context than a manual ChatGPT prompt. But right now the context bank is manually fed and rarely kept up to date.

The AI features become truly irreplaceable only when:
- The context bank fills itself automatically from performance data and approval feedback
- The AI visibly outperforms what a ChatGPT user would get because it knows things ChatGPT doesn't
- The workflow is tight enough that the AI tools save more time than they cost in UX friction

---

## CONFIRMED BUGS AND PROBLEMS (from deep code audit)

### Security Holes — Actively Dangerous

**1. Diary route has forgeable authentication**
`/api/diary` reads user identity from `x-user-id` and `x-user-role` HTTP request headers set by the browser. There is no server-side session verification. Any HTTP client can POST with `x-user-role: admin` and read/write diary entries for any user. This is a real security vulnerability.

**2. Most AI routes have no authentication**
The following routes accept requests from completely unauthenticated callers and trigger expensive AI calls at the company's expense:
- `/api/studio/hooks/generate`
- `/api/studio/strategy`
- `/api/studio/campaign/generate`
- `/api/studio/visual/generate` and `/api/studio/visual/approaches`
- `/api/ai-image/ideate`
- `/api/metricool/schedule/edit`

**3. Rate limiting is non-functional in production**
The rate limiter is an in-process JavaScript Map. On Vercel, each serverless container maintains its own independent Map. The code itself acknowledges this: "effective limit per real user is 10 × (number of warm instances)." In practice this provides near-zero protection against API abuse.

**4. Moderation creates false "sent" status**
When a team member clicks "Send Reply" on a comment, the database marks the item as `replied` regardless of whether the Chatwoot API call succeeded. The API call failure is silently swallowed. Team members see "Reply Sent." The reply never reached the platform. This is an active data integrity problem.

---

### Bugs That Break User Trust

**5. All AI prompts have corrupted Unicode**
The Hook Lab generation route (`/api/studio/hooks/generate`) has mojibake throughout its main prompt — `â€"` instead of `—`, `â€œ` instead of `"`. The Arabic dialect instruction strings are completely garbled (UTF-8 read as Latin-1). Every hook generation call sends corrupted instructions to the model. The model guesses at what the instructions mean. Output quality is degraded in ways that are impossible to trace without reading the raw prompt.

**6. Anthropic API key is not set — everything runs on Gemini**
The `ANTHROPIC_API_KEY` is empty in the environment. Every Claude call falls back to Gemini. The product is marketed as "Claude-powered" but delivers Gemini outputs. The quality difference is meaningful for creative work.

**7. Pipeline Velocity metric is always hardcoded to "3 days"**
The dashboard shows a "Pipeline Velocity: 3d" stat that is never calculated. It is literally a hardcoded string. Displayed as an operational metric to the CEO.

**8. Dead link on the dashboard**
The "Top Content" section and the Studio quick navigation both link to `/performance`. This page does not exist. It generates a 404 in production.

**9. Hook Lab "PDF Export" opens the browser print dialog**
The export button calls `window.print()`. No actual PDF is generated. The browser print view includes the nav, sidebar, and all UI chrome.

**10. Campaign Generator silently returns placeholder text on any AI failure**
If any of the 7 campaign phases fails (Gemini error, timeout, parse error), the route substitutes hardcoded placeholder text ("Concept 1", generic mechanic descriptions) and returns HTTP 200. The calling page shows "success." The team sends clients fake AI placeholders thinking they're real outputs.

**11. Studio session saves silently fail across all tools**
The pattern across Content Studio, Hook Lab, Campaign, and Strategy:
```js
fetch(`/api/studio/session/${id}`, { method: 'PATCH', ... }).catch(() => {})
```
If the session save fails, the user's work is not persisted. No error is shown. They close the tab thinking it saved. It's gone.

**12. Boss Brief silently fails everywhere**
The 30-second executive summary generated after every studio output is wrapped in `catch { /* non-fatal */ }` everywhere. If it fails, no fallback, no error, just a blank panel. This happens for the most important summary output in the Studio.

**13. Social performance data on dashboard disappears silently**
Two separate `catch {}` blocks mean that any Metricool API failure causes the entire social performance section to vanish from the dashboard. No "failed to load" message. Users see an incomplete dashboard and don't know why.

---

### Half-Built Features That Create False Confidence

**14. Credits system is completely dead code**
`lib/credits.ts` is a well-built credit system with cost definitions per operation type (1 credit for a caption, 5 for a strategy), atomic DB deduction via Postgres RPC, org-level limits, and per-user daily caps. It is **called exactly nowhere in the codebase**. Not a single AI route calls `checkAndDeductCredits()`. The DB columns and RPCs it depends on don't exist yet. All AI usage is unlimited, untracked, and unbilled.

**15. Social profile scraping is broken in all three platforms**
The scrape-profiles route runs and returns "scraped: N profiles" but:
- TikTok returns `posting_frequency: 0` always (hardcoded, never calculated)
- Instagram requires `INSTAGRAM_SESSION_ID` (undocumented env var not in the template) which doesn't work from Vercel IP addresses
- TikTok uses an unofficial internal endpoint that breaks without warning

**16. Respond.io reply sender is structurally broken**
When `RESPOND_IO_API_KEY` is set, the reply is sent to the Respond.io v2 API missing the required `channelId` field. The call returns 400. The error is swallowed. The DB is marked "replied." When the key is absent, the DB is marked "replied" without even trying. Either way: the reply never actually sends.

**17. Visual Studio, AI Image, Smart Resize — all UI shells with broken backends**
- Visual Studio generates prompts but has no way to submit them to Midjourney/Kling/Veo3 (no API keys)
- AI Image page returns 503 on every generation (FAL and Ideogram keys not set)
- Smart Resize routes exist; UI doesn't properly connect to them

**18. Client context bank is manually fed and manually maintained**
The most important differentiator in the app — the per-client context bank — only grows when team members manually add entries. In practice, people forget. After a month of use, most client context banks are sparse or empty. The AI quality for those clients is no better than a fresh ChatGPT chat.

---

### Architecture Problems That Will Hurt Later

**19. 23+ silent catch blocks with zero logging**
Confirmed across all scanned files. Pattern: `catch {}`, `catch { /* non-critical */ }`, `.catch(() => {})`. When things break in production there is zero trace. You cannot know which clients got bad data, which sessions weren't saved, which replies didn't send.

**20. No standardized auth middleware for API routes**
100+ API routes. Some call `getCallerProfile()`. Some read from headers. Some have no auth at all. There is no route-group-level auth enforcement. Every new route is a security gamble depending on whether the developer remembered to add auth.

**21. Client intelligence context is hard-capped at 3000 characters**
For a client with a rich history — context bank entries, feedback corrections, competitor intelligence, quarterly strategy, Pinterest learning — all of it is truncated at 3000 chars. The most important context items may be cut. The model gets an incomplete picture, but there is no visibility into what was truncated.

**22. `user_id` in strategy route comes from the request body**
The caller supplies their own `user_id` in the POST body. This is not validated against the authenticated session. Any caller can attribute expensive Opus usage costs to any other user's ID.

---

## WHAT WOULD MAKE THIS GENUINELY IRREPLACEABLE

Based on the audit, here is what would make an agency team say "I cannot do my job without this app":

### The performance feedback loop (currently missing entirely)
Right now, content goes: studio → approve → publish → report. Performance data from Metricool is synced daily to `post_performance_snapshots`. But this data is **never fed back into AI prompts**. The AI doesn't know that Tuesday 7pm reels for Client X get 4x engagement. It doesn't know that question-hook formats outperform statement hooks for Client Y by 180%. This data exists in the database but is not used.

If the app automatically learned from performance and said "here's what's working for this client, generate more of this" — that would be impossible to replicate in ChatGPT without manually copying all the data.

### The context bank needs to grow automatically
The context bank is the heart of the client intelligence layer. But it requires humans to fill it in. Features that would auto-populate it:
- When a post performs above 2x the client's average ER, auto-log the hook text, format, platform, and time
- When a client approves content with notes ("love this tone"), auto-log the note as a brand voice capture
- When a client requests changes ("we don't say things this way"), auto-log the rejection as a negative signal
- When a studio session gets a thumbs-up from a team member, auto-log what elements they liked

### The morning brief
A scheduled job that runs daily and delivers to each account manager's dashboard for their clients:
- Follower growth vs. last week
- Top post from yesterday with its engagement rate and why it likely performed
- What the client's 3 competitors posted in the last 24 hours
- Any engagement spikes or anomalies worth addressing
- Suggested reactive content based on competitor activity

This is operationally valuable in a way that no ChatGPT session can match because it requires aggregating live data from multiple sources automatically.

### Studio output → direct scheduling (remove friction)
Current flow: studio → write caption separately in Compose → add media → schedule in Metricool. That's at minimum 4 steps after the AI generates content. A "Schedule This" button on any studio output card that pre-fills the Compose dialog (hook as caption, platform from brief, suggested time based on client's performance data) would dramatically increase Studio adoption and make it a real part of the daily workflow.

### Inline commenting on approval portal
Right now clients can only approve the whole post or reject it. In real agency life, clients say "I love the first slide but change the CTA." Currently there's no way to capture that inline. All revision notes go into WhatsApp or email, outside the system. Adding click-to-comment on specific parts of the caption would make the approval portal the actual source of truth for client feedback.

---

## QUESTIONS FOR YOU TO ANSWER

Please answer all of these in as much detail as you can. Be specific. Challenge assumptions. Think from the perspective of real agency workers who are busy, distracted, and have very low tolerance for friction.

### Question Set 1: The Strategic Question

1. An agency account manager has Claude Pro. Their daily task is: write 5 captions for Client X who is a luxury perfume brand. In Claude Pro they open a new chat, paste the brand brief they have saved in Notion, and ask for 5 captions. It takes 2 minutes. What would make them choose this app instead, and feel like they're getting something genuinely better? What is the minimum feature/experience that creates that "I can't go back to ChatGPT for this" feeling?

2. The client intelligence block (the context injected into every AI call) currently contains: brand profile, last 10 context bank entries, last 8 negative feedback corrections, quarterly strategy excerpt, Pinterest inspiration patterns, competitor context. This is all good. But what's missing from this context that, if added, would make the AI output noticeably better? What does a real experienced copywriter know about a client that isn't captured here?

3. The app is trying to serve 10 different roles: admin, CEO, creative director, account manager, strategist, copywriter, designer, video editor, web developer, social manager. Is this a mistake? Should the app be radically simplified to serve 2-3 core roles well rather than trying to be everything? What would a role-specialized version of this app look like?

### Question Set 2: Simple High-Value Features

4. What are the 5 simplest features (each requiring less than 2 days to build) that would add the most real value to a social media agency team's daily workflow? Not ambitious features — small, obvious things that the team would use every day that are clearly missing.

5. The Studio has 10 tools now. Is that too many? Are they sufficiently differentiated from each other? Would it be better to have 3 exceptionally good tools than 10 adequate ones? If you had to kill 5 of them, which 5, and why?

6. The app has a "Content Library" of published posts as reusable templates. Right now it's a static library — you browse it and "save as template." How could this be transformed into an active learning asset? What would a smart library look like that actually improves content quality over time?

### Question Set 3: The Context Bank and Memory

7. The context bank is manually maintained and currently has no structure that the AI follows when using it. Entries are free-text categorized as: wins, brand_voice, objections, signals, feedback. How should the context bank be redesigned? What categories of client knowledge are most valuable to capture? How should the AI use them differently for different tasks (hooks vs. strategy vs. captions)?

8. The system collects thumbs-up/thumbs-down feedback on every AI output (the `ai_feedback` table). Currently only negative feedback (thumbs down) is injected back into prompts. What should happen with positive feedback? How should the system learn from what the team likes, not just what they correct?

9. The 3000 character cap on the client intelligence block means context gets truncated silently. How should the system prioritize what context to include? Is there a smarter architecture than a hard character cap — for example, relevance scoring, recency weighting, or agent-type-specific context selection?

### Question Set 4: Workflow and UX

10. Map the typical daily workflow of a social media copywriter at this agency. They wake up, open the app. What should they see first? What should be one click away? What currently takes too many steps that should be automatic? Design the ideal morning experience for this user.

11. The approval portal is one of the app's strongest features — a public token link where clients review and approve posts. What would make this portal dramatically better? Think about what clients actually want from an approval experience, not what the agency wants.

12. The app has notifications from the `audit_log`. What notifications would actually be useful enough that a team member enables them rather than ignores them? What events should trigger a push notification vs. an email digest vs. just a badge? What notification hell are we creating by notifying on everything?

### Question Set 5: Content Quality and AI

13. The Hook Lab generates 20 hooks, scores them with 3C (Curiosity, Clarity, Compulsion), runs SCAMPER, and returns the top ranked ones. This is impressive but is it actually effective? From a copywriting and content strategy perspective, what's wrong with this approach? What does it miss about what makes a hook actually work in the wild?

14. The strategy tool generates a full quarterly strategy in the "Esplanade format" — a specific methodology. But the output is a document. After the strategy is generated, how does it actually influence daily content creation decisions? Right now there's a weak link — the strategy excerpt is included in the 3000-char context block. Is there a better way to make strategy actually shape content decisions moment by moment?

15. The app generates Arabic content and has Arabic dialect rules (Saudi, Egyptian) baked into prompts. Most Arabic social media AI tools are terrible at dialect — they write in Modern Standard Arabic (fusha) which sounds corporate and stiff. What would genuinely excellent Arabic social media content generation look like? What context, rules, and validation steps would make this a real differentiator for the MENA market?

### Question Set 6: The Product Roadmap

16. Right now the product is transitioning from an internal tool to a multi-tenant SaaS. The multi-tenant architecture (organizations table, per-org data isolation, Stripe billing, etc.) is in a plan document but not yet built. What are the most common mistakes agencies make when trying to build a tool for other agencies? What would make a social media agency adopt this tool rather than sticking with their current stack?

17. The app is going to compete with: Hootsuite, Buffer, Later (scheduling), Sprout Social (analytics + publishing), Jasper/Copy.ai (AI copywriting), Notion (docs + tasks), ClickUp (project management). It's trying to replace all of them with one tool. Is that the right positioning? What's the minimum viable differentiator — the one thing this app needs to do better than any single competitor to win the comparison?

18. If you were the CEO of this agency and you had this tool, what would you expect to see on your dashboard that you can't see right now? What decisions do you make every week that this app should be helping you make? What does "AI-powered agency management" actually look like from a CEO perspective, beyond generating captions?

### Question Set 7: Technical Architecture Suggestions

19. The client intelligence block is built, the competitor context is built, the performance data is synced daily. But they're all disconnected — the performance data never influences the AI context. Design the architecture of a "learning loop" — the mechanism by which post performance data automatically improves future AI output for that client. Be specific about: what data is captured, when it runs, how it's stored, and how it's injected into prompts.

20. The app has 100+ API routes with no standardized authentication pattern. What is the cleanest, most practical way to add auth enforcement to all routes without refactoring 100 files? Is Next.js middleware the right place for this, or is there a better pattern?

21. The context bank grows over time. Some entries will become stale or irrelevant (a client's old positioning that changed 6 months ago). What's the right strategy for context bank lifecycle management — expiration, relevance decay, conflict resolution between old and new entries?

---

## TONE AND CONSTRAINTS FOR YOUR ANSWER

- Be brutally honest. If something is a bad idea, say so and explain why.
- Prioritize ruthlessly. Don't give a list of 30 things — tell me what matters most and in what order.
- Be specific. "Improve the UX" is not an answer. "Add a keyboard shortcut to jump from the studio output to the Compose dialog" is an answer.
- Think like a user, not a developer. The question is always "does this save real time or reduce real friction for a real person doing a real task?"
- Challenge the premise where needed. Some of these questions assume things that might be wrong. Push back where you see it.
- No jargon. This analysis will be read by both technical and non-technical people.

---

## ADDITIONAL CONTEXT: THINGS NOT TO SUGGEST

- **Do not suggest rebuilding in a different framework.** The stack is fixed.
- **Do not suggest adding Metricool alternatives.** The Metricool integration is deliberate and working.
- **Do not suggest removing the Studio.** The Studio tools are a strategic bet on AI-augmented creativity.
- **Do not suggest a mobile app.** Out of scope for now.
- **Do not suggest adding a public API.** Out of scope for the SaaS phase.
- The app has no open chat box that lets users type free prompts to the AI. Every AI action is triggered by a specific context-aware button. **This is intentional.** The AI is always purpose-built for a specific task. Do not suggest "add a chat interface" — there is already a full AI assistant chat on `/assistant`.

---

## SUMMARY: THE CORE TENSIONS TO RESOLVE

1. **Depth vs. breadth:** 10 Studio tools is impressive but each one is thinner than a dedicated tool. The app needs to either go deeper on fewer tools or find a way to make the breadth feel coherent rather than scattered.

2. **Manual vs. automatic:** The context bank, inspiration boards, and competitor intelligence all require human effort to keep populated. The app's AI quality degrades as soon as people stop manually maintaining these systems. The goal should be: if nobody logs in for 2 weeks, the app should still know more about each client than it did 2 weeks ago.

3. **Studio vs. workflow:** The Studio produces content. The workflow (tasks, pipeline, publishing, approval) moves content. Right now these are two separate systems loosely connected. The strongest version of this app is one where every studio output immediately enters the workflow — it becomes a task, it gets approved, it gets scheduled, all in one motion.

4. **Agency tool vs. SaaS:** As a single-agency internal tool, depth and specificity win. As a SaaS for any agency, generality and onboarding ease win. These are opposing design forces. The product needs to pick a lane or architect around the tension deliberately.

---

Answer all questions. Be specific. Be honest. Make it actionable.
