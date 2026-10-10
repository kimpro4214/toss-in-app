# CLAUDE.md — Toss App & Game Development Guide

> Behavioral guidelines + project-specific rules.
> General working principles and Apps in Toss rules for this repository.
> **Strict compliance required.** 사소한 작업은 판단에 맡기되, 기본은 신중함 우선.

---

## Project Context
- **Role:** Apps in Toss Web App & Game Developer
- **Goal:** Build, release, and improve Toss mini apps and games using actual usage and monetization data.
- **Repository:** `toss-game`; each app or game has its own project directory.
- **Chat & Comments:** 한국어로 작성

---

# Part 1. General Working Principles

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**
> 가정하지 말 것. 헷갈리면 숨기지 말 것. 트레이드오프는 드러낼 것.

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
  > 가정을 명시적으로 말한다. 불확실하면 질문한다.
- If multiple interpretations exist, present them — don't pick silently.
  > 해석이 여러 개면 임의로 고르지 말고 제시한다.
- If a simpler approach exists, say so. Push back when warranted.
  > 더 단순한 방법이 있으면 말한다. 필요하면 반대 의견도 낸다.
- If something is unclear, stop. Name what's confusing. Ask.
  > 불명확하면 멈추고, 뭐가 헷갈리는지 짚고, 묻는다.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**
> 문제를 푸는 최소한의 코드. 추측성 구현 금지.

- No features beyond what was asked.
- No abstractions for single-use code.
  > 한 번만 쓰는 코드에 추상화 만들지 말 것.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
  > 일어날 수 없는 시나리오에 예외 처리 넣지 말 것.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.
> "시니어가 보면 과하다고 할까?" → 그렇다면 단순화.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**
> 꼭 필요한 부분만 건드린다. 내가 만든 흔적만 치운다.

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
  > 주변 코드/주석/포맷을 임의로 "개선"하지 말 것.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
  > 내 취향과 달라도 기존 스타일을 따른다.
- If you notice unrelated dead code, mention it — don't delete it.
  > 관련 없는 죽은 코드는 삭제하지 말고 언급만.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.
> 모든 변경 라인은 요청과 직접 연결되어야 한다.

> **Note (앱·게임 구조 변경 시):** 대규모 refactoring은 코드부터 건드리지 말고
> 먼저 설계 방향을 제안하고 승인을 받는다. (Part 3. Workflow 참조)

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**
> 성공 기준을 정하고, 검증될 때까지 반복.

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

> **Note (모바일·게임 검증):** 자동 테스트가 어려운 터치·사운드·게임 화면은
> 성공 기준을 "실기기 화면 확인 / 한 판 완료 / 백그라운드 복귀 / 광고 후 복원"처럼
> 구체적으로 정의한다. Part 2의 토스 검증 기준을 함께 적용한다.

---

# Part 2. Apps in Toss App & Game Rules

## 1. Project Structure & Technology
- Keep each application or game in an independent project directory with its own package manifest, lockfile, runtime assets, and Toss configuration. The current CS app lives in `apps/cs-daily-5`.
- Follow the existing project's technology and style. The CS app uses React, TypeScript, Vite, and TDS; choose game technology according to the actual gameplay requirements.
- Extract shared code only after multiple projects actually need it. Avoid speculative frameworks and dependencies.
- Check current official Apps in Toss documentation and installed SDK types before adding platform integrations. Keep configuration and compatible dependency versions consistent with that project's SDK; do not upgrade unrelated dependencies.

## 2. Mobile UX & Accessibility
- Design for touch, small screens, Safe Area, and Android/iOS navigation. Make primary actions and back/close behavior clear.
- Use TDS for standard app screens where appropriate. Give games a suitable play area and orientation without forcing game-specific UI onto non-game apps.
- Keep code blocks horizontally scrollable within their container; avoid page-wide overflow. Provide readable text, visible focus states, and accessible labels.
- Preserve ongoing learning or play when changing settings. Keep permission-denied and unsupported-SDK paths usable for features that do not require that capability.

## 3. State, Storage & Content
- Separate testable learning/game logic from UI and native integration. Keep stable content IDs and versioned persisted state.
- Use SDK Storage in Toss and a browser fallback for local development when appropriate. Separate user records and preserve existing answers, rewards, and unfinished sessions during updates.
- Treat a save as successful only after persistence succeeds. Prevent duplicate submissions and reward grants; allow safe retries after failure.
- Write original questions, explanations, and game assets. Verify technical answers with authoritative sources, execute relevant code/calculation examples, and keep runtime content in structured files.

## 4. Game Lifecycle & Performance
- Keep initial loading, asset sizes, memory use, and touch responsiveness suitable for mobile webviews. Measure on real devices before declaring release readiness.
- Pause timers and audio appropriately when backgrounded or showing an ad; restore gameplay deliberately when returning.
- Clean up animation frames, timers, subscriptions, and media resources. Avoid unnecessary allocations and React renders in active game loops.
- Define observable game checks, such as scoring, round completion, restart, save/restore, and ad return behavior. Do not rely only on a successful build.

## 5. Monetization & Measurement
- Validate retention and revenue with actual console data. Do not describe estimates, competitor claims, or a launch itself as proven profit.
- Keep rewarded ads optional and explain the reward before display. Preload ads and grant a reward only on the SDK's `userEarnedReward` event, once per eligible reward.
- Keep basic learning/play usable when an ad is unavailable, cancelled, or fails. Development ad mocks must not be present in production bundles.
- Use real console app identifiers and ad-group values for release configuration. Keep secrets local and report missing values or unverified real-ad behavior accurately.

## 6. Verification & Release
- Run checks relevant to the change: content validation, TypeScript, logic/reward tests, browser flows, web build, and `.ait` packaging when applicable. For documentation-only changes, check the diff and instruction consistency instead of rerunning app tests.
- Browser mocks verify local flows; they do not prove native SDK behavior. Verify navigation, Safe Area, persistence, and ad return/rewards in Android/iOS Toss before claiming those checks passed.
- For SDK 3 projects, use the console QR flow for Toss testing as documented. Verify the current game launch-time requirement; the official checklist currently requires the first screen within 10 seconds.
- Prepare review assets and accurate app descriptions, then submit through the console only when requested. Distinguish successful packaging, review submission, review approval, and public release.

## Official References
- [Apps in Toss SDK 3](https://developers-apps-in-toss.toss.im/documentation/sdk/v3)
- [Apps in Toss game release checklist](https://developers-apps-in-toss.toss.im/checklist/app-game)
- [Apps in Toss rewarded ad API](https://developers-apps-in-toss.toss.im/documentation/common/monetization/iaa/interstitial-rewarded-ad)

---

# Part 3. Workflow & Git

## 1. Workflow
- Keep user-facing updates and code comments in Korean. Write new or updated instructions in `AGENTS.md` and `CLAUDE.md` in English, including shared Git policies.
- Read the target app's package scripts, SDK setup, and existing flows before editing. Use the local `toss-game-guide.md` for context when available, while verifying current platform requirements against official documentation.
- For major architecture changes, explain the design and obtain approval before refactoring. Resolve routine implementation choices within the user's authorized scope without repeated confirmations.
- Use focused development logs for learning, game, storage, and ad events; avoid sensitive data and noisy per-frame logging.
- Report the final behavior, relevant verification, and material remaining limitations. Never claim real device, real ad, or release validation from browser mocks alone.

## 2. Git Commit
- Keep commits small and focused on one responsibility, such as configuration, content, learning logic, UI, integration, tests, or documentation.
- Split changes into meaningful feature units instead of committing the entire application at once.
- Use a conventional prefix: `feat`, `fix`, `chore`, `refactor`, `test`, or `docs`.
- Write concise commit messages in Korean.
- Never add agent attribution, automatic agent signatures, or `Co-authored-by` trailers to commit messages.

## 3. Git Branch & PR (Critical)
- `main` is the release branch and the repository's default branch. All application and game PRs target `main` directly.
- There is no `dev` integration branch. Do not recreate it or introduce additional integration or release branches unless the user explicitly requests them.
- Keep one reusable branch per application or game, named `feat/<app-or-game-slug>`, for example `feat/cs-daily` or `feat/block-puzzle`.
- Create a branch from the latest `origin/main` only when starting a new application or game. Do not reuse another application's or game's branch or start from an unrelated app branch.
- Continue adding features and fixes on the same app branch. Do not create a separate branch for every feature, bug fix, or PR unless the user explicitly asks for one. Keep the app branch after PR merges; do not delete it as routine cleanup.
- Before the next development cycle, fetch and synchronize the app branch with `origin/main`. Prefer a fast-forward when possible; otherwise merge `origin/main` into the app branch while preserving published commits. Never reset or force-push published history without explicit authorization.
- Use English lowercase letters, numbers, and hyphens in branch slugs; do not use spaces, uppercase letters, or underscores.
- Keep each app branch scoped to its application or game. Explicitly requested shared repository maintenance, including `AGENTS.md`, `CLAUDE.md`, and ignore rules, may use the active app branch.
- Keep commits small and focused. When a feature unit is ready and the user requests a PR, push the app branch and open a GitHub PR directly to `main`.
- Never push directly to `main` or merge into `main` locally. A PR creation request does not authorize merging the PR; merge only when the user explicitly requests it.
- Before committing or pushing, verify the current branch, staged files, outgoing commits, commit messages, and local-only exclusions.

### PR Execution & Format
- Treat a direct request such as "PR 날려줘" or "open a PR" as authorization to complete the required checks, commit the relevant changes, push the app branch, and create the PR without asking for another confirmation. Reuse and update an existing open PR for the same head branch and `main` base instead of creating a duplicate.
- If the user asks only for a PR message, provide the title and body without creating a PR.
- Use available GitHub tools, CLI, API, or authenticated browser access to create the PR. After creation, attach the PR to the current task and return its URL.
- Keep PR titles concise, in Korean, with a conventional prefix such as `feat:`, `fix:`, or `chore:`.
- Keep the agreed PR body format: a short opening paragraph describing the concrete problem and resulting behavior, followed by `### 변경사항` and `### 검증` with flat bullet lists.
- Describe the final diff against `main`, including only changes relevant to a reviewer. State actual test results and material unverified items; distinguish development ad mocks from real Toss ad or device validation.
- Do not add agent attribution, automatic signatures, or `Co-authored-by` trailers to PR text or commits.

## 4. GitHub Scope & Local-Only Documents (Critical)
- GitHub is for the working application or game: source code, runtime assets, question/content data used by the app, build/runtime configuration, dependency manifests and lockfiles, and necessary development/test scripts.
- `AGENTS.md` and `CLAUDE.md` are shared repository instructions and may be committed and pushed. Keep their Git policies consistent and write those policies in English.
- Keep ideas, plans, design notes, research, task logs, and generated verification reports local. Never stage, commit, or push them.
- This includes `idea.md`, `plan.md`, `*-plan.md`, other Markdown documents such as local `README.md` files, and application `reports/` directories. Shared `AGENTS.md` and `CLAUDE.md` instructions and required license and legal notices are exceptions.
- Keep `/idea.md`, Markdown-document exclusions, and application-report exclusions in `.gitignore`. Never bypass them with `git add -f`.
- Allow `AGENTS.md` and `CLAUDE.md` explicitly in `.gitignore` while retaining the exclusions for other Markdown documents.
- Do not copy local-only document contents into another tracked file to bypass these restrictions. Runtime question data and source-code comments are not planning documents.
- Never commit or push secrets, local environment files, installed dependencies, build output, or local test artifacts. Maintain the corresponding `.gitignore` entries.
- Before pushing, verify the staged changes and outgoing commits for local-only documents and other excluded files.
- If an excluded document is already tracked, remove it from Git tracking while preserving the local file. Commit that removal before the next push. Do not rewrite published history unless the user explicitly requests it.
- If an excluded document was accidentally added to an unpublished commit, stop the push and remove it from the outgoing history without deleting the local document.

---

## 5. Console Submission Preparation
- The user prefers to copy and paste console text themselves. Provide ready-to-paste text for each field, and operate the console UI only when explicitly asked to enter it.
- When release materials are requested, prepare the required text, logos, and screenshots together. Enforce these character limits: detailed description 500, memo 100, Korean app name 10, English app name 15, and subtitle 20. Count actual characters, including spaces and line breaks. Use updated limits if the console changes.
- Prepare app logos at 600x600px. By default, provide at least three portrait screenshots at 636x1048px. If landscape format is selected, provide at least one screenshot at 1504x741px; do not require both formats. Verify pixel dimensions and visible content, then provide absolute-path links to each file.
- Read the local `toss-console-submission.md` before preparing release materials. Keep console copy, generated screenshots, and verification reports local-only. Store logos used by the running app in that app's runtime asset directory, such as `public`.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
> 잘 작동하는 신호: diff에 불필요한 변경이 줄고, 과설계로 인한 재작성이 줄고,
> 실수 후가 아니라 구현 전에 질문이 나온다.
