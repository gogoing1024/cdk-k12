# CDK K12 - ChatGPT Activation Portal

## 1. Concept & Vision

A sleek, localized Chinese CDK activation portal that lets users manually input their ChatGPT `AuthSession` JSON data (instead of auto-fetching from the browser). The UI mimics a modern fintech activation flow — three focused steps, progress-driven, with clear feedback at every stage. Feels premium, fast, and trustworthy.

## 2. Design Language

- **Aesthetic**: Dark-mode fintech / activation portal — clean surfaces, subtle glows, structured card layout
- **Color Palette**:
  - Background: `#0f1117` (deep charcoal)
  - Card surface: `#1a1d27` (elevated surface)
  - Border: `#2a2d3a`
  - Primary accent: `#6366f1` (indigo glow)
  - Success: `#22c55e`
  - Warning: `#f59e0b`
  - Error: `#ef4444`
  - Text primary: `#f1f5f9`
  - Text muted: `#94a3b8`
- **Typography**:
  - Headings: `Plus Jakarta Sans` (Google Fonts), 600-700 weight
  - Body / monospace inputs: `JetBrains Mono` (Google Fonts)
- **Spatial system**: 8px base grid, card padding 24px, gap between steps 16px
- **Motion**: Step transitions fade + slide up (200ms ease-out), button press scale (0.97), spinner rotation, success pulse animation
- **Icons**: Lucide React icons (consistent 20px stroke-width 1.5)

## 3. Layout & Structure

```
┌─────────────────────────────────────────┐
│  Header: Logo + title + language toggle │
├─────────────────────────────────────────┤
│                                         │
│  Step indicator: ● — ○ — ○              │
│                                         │
│  ┌─────────────────────────────────┐    │
│  │  Step 1: CDK Key                │    │
│  │  Step 2: AuthSession Input      │    │
│  │  Step 3: Activation             │    │
│  └─────────────────────────────────┘    │
│                                         │
│  Footer: Note about reloading           │
└─────────────────────────────────────────┘
```

Single-page, centered card (max-width 480px), vertically centered on viewport.

## 4. Features & Interactions

### Step 1 — CDK Key Verification
- Single text input for the CDK key
- "验证 CDK" button
- On valid key → advance to Step 2
- On invalid key → shake animation + red border + error message
- Key stored in component state (not persisted)

### Step 2 — AuthSession Input
- Large textarea for pasting JSON from `chatgpt.com/api/auth/session`
- "检查数据" button validates JSON structure
- Displays parsed user info: email, account_id, plan_type, expiry
- On valid data → advance to Step 3
- On invalid JSON → error message
- Instructions displayed: how to get the session data

### Step 3 — Premium Activation
- Shows confirmed user info from Step 2
- "开始激活" button triggers activation
- Calls `https://chatgpt.com/backend-api/accounts/{account_id}/subscription` with Bearer token
- Loading state with spinner
- Success state: green checkmark + "激活成功！" message
- Error state: red message with error details
- Instructions about reloading ChatGPT after activation

## 5. Component Inventory

### StepIndicator
- Three dots connected by lines
- Active step: filled indigo circle with glow
- Completed step: filled green circle with checkmark
- Inactive step: hollow gray circle
- Connecting lines: gray if inactive, green if past

### CDKInput (Step 1)
- Card with icon + label
- Monospace input field
- States: default, focused (indigo border + glow), error (red border + shake), success

### SessionInput (Step 2)
- Card with instructions panel (collapsible "获取 AuthSession 指引")
- Large textarea (min 200px height)
- User info preview card (shows parsed data with green border when valid)

### ActivationPanel (Step 3)
- Confirmation card showing account info
- Large "开始激活" button (indigo gradient, hover glow)
- Loading spinner (indigo rotating ring)
- Result display: success checkmark animation or error message

### Button variants
- Primary: indigo gradient background, white text, hover glow
- Secondary: transparent with border, muted text
- Success: green background
- Disabled: opacity 50%, no pointer

## 6. Technical Approach

- **Framework**: React 18 + Vite
- **Styling**: Tailwind CSS v3 with custom theme extending the palette above
- **State**: React useState / useReducer for step flow
- **HTTP**: native `fetch` with CORS credentials
- **Fonts**: Google Fonts loaded via `<link>` in `index.html`
- **No backend** — all logic runs client-side
- **Icons**: `lucide-react` package

### Key API details (from demo.txt reference)
```
GET  https://chatgpt.com/api/auth/session
POST https://chatgpt.com/backend-api/accounts/{account_id}/subscription
Authorization: Bearer <accessToken>
```
