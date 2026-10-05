# CLAUDE.md — Core Craft Engine

> Behavioral guidelines + project-specific rules.
> 일반 행동 원칙(영문) 아래에 Core Craft 엔진 전용 규칙을 둔다.
> **Strict compliance required.** 사소한 작업은 판단에 맡기되, 기본은 신중함 우선.

---

## Project Context
- **Role:** Senior C++ Engine Programmer
- **Goal:** Custom DX11 Game Engine for "Core Craft" (Palworld style)
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

> **Note (엔진 작업 시):** 대규모 refactoring은 코드부터 건드리지 말고
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

> **Note (렌더링/엔진 검증):** 자동 테스트가 어려운 렌더 코드는
> 성공 기준을 "화면 출력 확인 / 커스텀 로그 출력 / 특정 프레임 동작"처럼
> 구체적으로 정의한다. Part 2의 DX11 체크리스트를 검증 기준으로 활용.

---

# Part 2. C++ & DX11 Engine Rules

## 1. C++ & Architecture
- Target Architecture: Unreal Engine style (UObject -> AActor -> UActorComponent)
- Separate .h & .cpp
- Use Forward Declaration 적극 활용 (include 최소화)
- Use Modern C++ (auto, constexpr, enum class, lambda)

## 2. Memory & Resource (Critical)
- Prevent memory leak
- Avoid raw new/delete. Use std::unique_ptr (소유권 명확), std::shared_ptr (공유)
- DX11 Resources: ID3D11... 객체는 반드시 Microsoft::WRL::ComPtr 사용. 생 포인터 절대 금지

## 3. Performance
- Optimize for open-world: Data Locality 최우선. SoA 구조나 연속된 std::vector 사용
- No memory allocation (new) or 무거운 string 연산 in Tick/Update loop
- Minimize State Change in Rendering Pipeline

## 3-1. DX11 렌더링 필수 체크리스트 (Critical)
MeshRenderer::Update() 또는 렌더링 코드 작성/수정 시 반드시 포함:
- `DC->IASetPrimitiveTopology(D3D11_PRIMITIVE_TOPOLOGY_TRIANGLELIST)` — 누락 시 하드웨어마다 다르게 동작(point/line 렌더링)
- `DC->IASetVertexBuffers(...)` — stride/offset 포함
- `DC->IASetIndexBuffer(...)` — DXGI_FORMAT_R32_UINT
- 셰이더 VS에서 `worldPosition`은 반드시 W 변환 후, VP 변환 전에 저장
  ```hlsl
  output.position = mul(input.position, W);
  output.worldPosition = output.position.xyz; // 반드시 여기서 저장
  output.position = mul(output.position, VP);
  ```
- `CameraPosition()`은 `-V._41_42_43` 아닌 `mul(float3(-V._41,-V._42,-V._43), (float3x3)V)` 사용
- `D3D11CreateDeviceAndSwapChain` 호출 시 Feature Level 명시: `D3D_FEATURE_LEVEL_11_0`

---

# Part 3. Workflow & Git

## 1. Workflow
- 대규모 refactoring 전 설계 방향 ask & get approval
- Add Custom Log/macro for instant debugging
- Chat & Comments in Korean

## 2. Git Commit
- Keep commits small and focused on one responsibility, such as configuration, content, learning logic, UI, integration, tests, or documentation.
- Split changes into meaningful feature units instead of committing the entire application at once.
- Use a conventional prefix: `feat`, `fix`, `chore`, `refactor`, `test`, or `docs`.
- Write concise commit messages in Korean.
- Never add agent attribution, automatic agent signatures, or `Co-authored-by` trailers to commit messages.

## 3. Git Branch & PR (Critical)
- `main` is the release branch and the repository's default branch.
- `dev` is the integration branch for reviewed application and game changes.
- Repository-wide maintenance, such as shared agent instructions and ignore rules, may be committed directly to `dev` when explicitly authorized by the user. New applications and games still require their own feature branches.
- Develop each application or game on its own feature branch, such as `feat/cs-daily`.
- Whenever starting a new application or game, create a new feature branch from the latest `dev`. Do not reuse another application's or game's branch, and do not start it from an unrelated feature branch.
- Use the naming format `<type>/<lowercase-kebab-case-description>`. Use English letters, numbers, and hyphens in the description; do not use spaces, uppercase letters, or underscores.
  - New application or game: `feat/<app-or-game-slug>`, for example `feat/cs-daily` or `feat/block-puzzle`.
  - Follow-up feature: `feat/<app-or-game-slug>-<change>`, for example `feat/cs-daily-subject-filter`.
  - Bug fix: `fix/<app-or-game-slug>-<issue>`, for example `fix/cs-daily-save-error`.
  - Repository maintenance or documentation: `chore/<description>` or `docs/<description>`.
- Keep each branch scoped to its application, game, or stated maintenance task.
- Integrate feature branches through reviewed GitHub PRs targeting `dev`.
- Release through a reviewed GitHub PR from `dev` to `main`.
- Never push directly to `main`, and never merge into `main` locally. The one-time initial creation of `main`, `dev`, and `feat/cs-daily` was explicitly approved; it is not ongoing permission to push directly to `main`.
- Before committing or pushing, verify the current branch, staged files, and commit messages.

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

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
> 잘 작동하는 신호: diff에 불필요한 변경이 줄고, 과설계로 인한 재작성이 줄고,
> 실수 후가 아니라 구현 전에 질문이 나온다.