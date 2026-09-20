# SPOTX Partner Panel

A partner/affiliate management platform for SPOTX (an enterprise digital signage
platform). It runs three separate web apps out of one codebase — a **Partner
Panel**, a **Customer Panel**, and an **Admin Panel** — backed by one Express +
MongoDB API.

Partners (vendors, affiliates, influencers, referrers, agencies, resellers,
technology and strategic partners) refer or resell SPOTX to customers, earn
commission per SPOTX's rules for their partner type, and get paid out on a
schedule. Customers subscribe to SPOTX directly (optionally under a partner's
referral) and pay via Razorpay. Admins run onboarding/KYC, commission rules,
settlements, and payouts.

---

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Node.js, Express 5, MongoDB (Mongoose 9) |
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4 |
| Auth | JWT — three **completely separate** token spaces (partner / customer / admin) |
| Payments | Razorpay (Standard Checkout + Webhooks) |
| PDF generation | pdfkit (Partner Agreement) |
| Email | Nodemailer (SMTP) |

---

## Repo layout

```
partnerpanel/
├─ backend/
│  ├─ index.js              — Express app entry, route mounting, CORS/helmet
│  ├─ config/                — env-driven constants, DB connection, roles/permissions
│  ├─ models/                — Mongoose schemas (see "Data model" below)
│  ├─ controller/            — request handlers, one file per resource area
│  ├─ router/                — Express routers, one file per resource area
│  ├─ middleware/             — auth guards, upload handling, permission checks
│  ├─ services/               — cross-cutting business logic (commission engine,
│  │                            settlement payout fulfillment, agreement PDF gen, …)
│  ├─ utils/                  — small stateless helpers (encryption, code generators,
│  │                            settlement holds, commission resolver, …)
│  └─ seed/                   — one-off DB seed scripts (admin user, tier ladders)
└─ frontend/
   └─ src/
      ├─ pages/
      │  ├─ partner/          — Partner Panel screens
      │  ├─ admin/            — Admin Panel screens
      │  └─ customer/         — Customer Panel screens
      ├─ layouts/              — shared shell per app (sidebar/topbar)
      ├─ context/              — auth context providers (partner/admin/customer)
      ├─ components/           — shared UI + per-app components
      └─ services/             — axios clients (one per app, separate token headers)
```

---

## The three apps

### 1. Partner Panel (`/partner/...`)

What a partner (vendor/affiliate/influencer/referral/agency/reseller/technology/
strategic) uses day to day:

- **Register / Login** — self-service registration (`/partner/register`) or
  admin-created accounts. JWT stored as `partnerToken` in `localStorage`.
- **Profile** — business/legal details, address.
- **Documents (KYC)** — upload MSME/Udyam, GST certificate, PAN, cancelled
  cheque, etc. **Owner-only** (see permissions below) — this and Bank are the
  two most sensitive areas of a partner account.
- **Bank** — bank account for payouts. Owner-only.
- **Team** — invite teammates with a role (`admin` / `sales` / `finance` /
  `viewer`), each scoped by the permission catalogue in `config/roles.js`.
- **Referrals** — vendor's customer-signup referral code/link.
- **Customers** *(vendor only)* — customers registered under this vendor.
- **Opportunities** — deal pipeline (lead → demo → proposal → won/lost).
- **Commissions** — ledger of commission earned per deal/customer payment.
- **Settlements** — payout batches: amount waterfall (gross → TDS → net → +GST
  if applicable), bill submission for GST-registered partners, and a full
  event history/timeline.
- **Notifications** — in-app notification feed.

Most of these routes are gated by `requireVerifiedPartner` — a partner can
complete their profile/KYC/bank before verification, but referring, selling,
and getting paid are locked until an admin verifies the account (see
`VerifiedGate` component / `middleware/requireVerifiedPartner.js`).

### 2. Customer Panel (`/customer/...`)

What an end-customer of SPOTX uses:

- **Register / Login** — separate auth space (`customerToken`), can register
  standalone or via a vendor's referral code.
- **Dashboard**, **Screens** — their digital signage screens.
- **Subscription** — pick a plan (Basic/Premium) and screen count, see the
  GST-inclusive total, and pay via a real **Razorpay Standard Checkout** popup
  (UPI/card/etc). Payment is verified twice — client-side signature check
  immediately after checkout, and again via the Razorpay webhook as a safety
  net if the browser closes before the client call lands.
- **Billing** — payment/invoice history.
- **Profile**.

### 3. Admin Panel (`/admin/...`)

What SPOTX staff use to run the whole platform:

- **Dashboard** — platform-wide stats.
- **Partners** — list/detail, KYC document review, bank verification, status
  changes (draft → pending_verification → under_review → active/suspended/
  rejected/inactive), tier assignment (vendor), and **custom commission
  assignment** (vendor only — see "Partner Agreement" below).
- **Customers** — customer list, mark payments received manually if needed.
- **Documents** / **Bank** — cross-partner KYC/bank verification queues.
- **Opportunities** — mark deals won/lost, which triggers commission
  generation.
- **Commissions** — ledger view across all partners.
- **Settlements** — approve/hold/release/fail/retry payout batches, mark paid
  (offline or Razorpay-verified), review/verify GST bills, full audit history
  per settlement.
- **Config** (`Programs, Tiers, Commission Rules, Screen Pricing`) — the
  shared configuration every partner draws from: time-boxed signup Programs,
  the Tier ladder per partner type, CommissionRule definitions, and global
  screen pricing used for customer subscription totals.
  *(The Payment Gateway credentials tab was intentionally removed from this
  UI — Razorpay keys are configured via `.env` only, see below.)*

---

## Auth model

Three **independent** JWT spaces — a partner token, a customer token, and an
admin token never work against each other's routes:

| | Token localStorage key | Signed with | Identity model |
|---|---|---|---|
| Partner | `partnerToken` | `JWT_SECRET` | `PartnerUser` (belongs to a `Partner`) |
| Customer | `customerToken` | `JWT_SECRET` | `Customer` |
| Admin | `adminToken` | `ADMIN_JWT_SECRET` | `User` (SPOTX staff) |

Partner-side permission model (`config/roles.js`):

- Roles: `owner`, `admin`, `sales`, `finance`, `viewer` — each maps to a fixed
  permission list.
- `owner` always bypasses permission checks entirely.
- `documents:*` and `bank:*` are **owner-only** no matter what a role is
  configured with — KYC and payout bank details are the two most sensitive
  areas of a partner account.

Admin-side roles (`ADMIN_ROLES`): `super_admin`, `kyc_reviewer`, `finance` —
enforced per-route via `requireAdminRole(...)`.

---

## Data model (MongoDB / Mongoose)

Grouped by area — every model lives under `backend/models/`:

**Partner core**
- `Partner` — the business entity (legal details, address, KYC/verification
  status, partner type, program/tier assignment, cached stats)
- `PartnerUser` — a login for a `Partner` (owner/admin/sales/finance/viewer)
- `PartnerDocument` — KYC files (MSME/GST/PAN/cheque/**partner_agreement**)
- `PartnerBankAccount` — encrypted bank account for payouts
- `PartnerActivity` — audit log (fixed enum of activity types)
- `PartnerNotification` — in-app notification feed

**Programs / Tiers / Commission**
- `PartnerProgram` — time-boxed signup campaign
- `PartnerTier` — a rung on a partner type's ladder (qualification metric +
  benefits)
- `CommissionRule` — shared, tier-scoped commission definition (rate/fixed/
  per-screen/hybrid, recurring terms) — used by non-custom partner types
- `PartnerCommissionAssignment` — **vendor-only**, a custom per-partner
  commission override set directly by an admin (independent of the shared
  tier ladder); every reassignment supersedes the previous one but keeps it
  on record
- `PartnerCommission` — the commission ledger — one immutable-ish row per
  earned commission, computed at deal-won or customer-payment time

**Settlements (payouts to partners)**
- `PartnerSettlement` — a payout batch (gross → TDS deductions → net,
  status state machine: draft → pending_approval/approved → paid, with
  on_hold/failed/processing/cancelled side states)
- `PartnerSettlementBill` — a GST bill a partner submits before a
  GST-registered partner's payout can be released
- `PartnerSettlementHistory` — append-only audit trail of every settlement
  event (created/approved/held/released/paid/failed/retried/bill events),
  with an amount snapshot and who/what performed it

**Partner Agreement**
- (stored as a `PartnerDocument` row, `documentType: "partner_agreement"`) —
  a generated PDF describing the partner's actual commercial terms
- `PartnerAgreementAcceptance` — a separate, visible record that a given
  agreement was accepted (always automatic — see below), versioned per
  reissue

**Customer / billing**
- `Customer` — end-customer of SPOTX (optionally tied to a referring vendor)
- `CustomerPayment` — ledger of Razorpay transactions for subscription
  checkout (idempotent order reuse, signature + API-verified)
- `Invoice`, `Screen`, `ScreenPricing` — customer-side billing/screens
- `PartnerReferral`, `PartnerOpportunity` — referral tracking / deal pipeline

**Platform**
- `User` — SPOTX staff (admin login)
- `EmailOtp` — OTP flow for password reset, etc.

---

## Key flows

### Partner onboarding → verification

```
Partner registers/created by admin
        │
        ▼
   status: draft
        │  (partner fills profile, uploads KYC docs, adds bank account)
        ▼
status: pending_verification / under_review
        │  (admin reviews docs + bank account)
        ▼
   status: active   ──▶ vendor: admin picks a Tier (perks ladder) AND
                         sets a custom Commission (type + rate/amount) —
                         setting the commission is what generates and
                         auto-accepts the Partner Agreement PDF.
                         non-vendor: agreement generates automatically
                         on activation using the type's shared CommissionRule.
```

### Commission generation

Fires from two places:
- `commissionEngine.generateCommissionForWonOpportunity` — when an admin marks
  a `PartnerOpportunity` "won"
- `commissionEngine.generateCommissionForCustomerPayment` — vendor-only, when
  a `Customer`'s subscription payment is received (manual admin action, or
  automatically via Razorpay checkout fulfillment)

Both resolve the applicable rule the same way (`utils/partnerCommissionResolver.js`):
1. An **active `PartnerCommissionAssignment`** for that partner (vendor-only
   custom override), if one exists — else
2. The `CommissionRule` tied to the partner's current tier — else
3. A generic tier-less/partnerType fallback `CommissionRule`

This is the exact same lookup order `generatePartnerAgreement.js` uses to
describe terms in the PDF, so the agreement can never drift from what's
actually paid out.

### Customer subscription checkout (Razorpay)

```
Customer picks plan + screen count
        │  (frontend computes total incl. 18% GST from global ScreenPricing)
        ▼
POST /api/customer/subscription/checkout  → creates a Razorpay Order
        │  (idempotent — reuses an existing unpaid order within 30 min)
        ▼
Razorpay Checkout popup (UPI / card / etc.)
        │
        ├─▶ success → client calls /verify → signature + live API re-check
        │             → CustomerPayment marked paid → commission generated
        │             (if under a vendor's referral)
        │
        └─▶ webhook safety net → POST /api/webhooks/razorpay
              (raw-body signature verification, mounted BEFORE express.json())
              → same atomic idempotent claim, handles the case the browser
                closed before /verify landed
```

### Settlement (partner payout)

```
Admin bundles approved PartnerCommission rows → PartnerSettlement (draft)
        │
        ▼
  checkSettlementPayoutReadiness (utils/settlementHold.js)
   ├─ partner active? bank verified?
   └─ GST-registered partner? → needs a VERIFIED PartnerSettlementBill
        │
        ├─ not ready → auto on_hold (hold.code explains why, restorable)
        │
        ▼
   approved  →  admin marks paid via ONE of:
                 • Offline  (bank transfer/UPI/cheque — admin-attested)
                 • Razorpay-verify (paste a real Razorpay payment ID,
                   fetched + amount-matched against net+GST before trusting it)
        │
        ▼
   paid — PartnerCommission rows → "settled", partner stats updated,
          full event history recorded in PartnerSettlementHistory
```

Every settlement event — created, approved, held, released, paid, failed,
retried, bill submitted/verified/rejected — is recorded in
`PartnerSettlementHistory` and shown as a timeline in both the partner and
admin Settlement detail views.

---

## Environment variables (`backend/.env`)

Copy `backend/.env.example` → `backend/.env` and fill in:

```
MONGO_URI=                 # MongoDB connection string
PORT=5000

JWT_SECRET=                # signs partner + customer tokens
ADMIN_JWT_SECRET=          # signs admin tokens — deliberately separate
BANK_ENC_KEY=              # AES-256-GCM key encrypting bank account numbers

CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173   # comma-separated if multiple frontends

SMTP_USER=                 # for password reset / invite emails
SMTP_PASS=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=   # see "Setting up Razorpay" below
```

Razorpay credentials are read via `utils/paymentGatewayConfig.js`, which
resolves lazily per-request from `.env` (no admin-panel override UI — that
tab was removed; edit `.env` and restart to change credentials).

---

## Setting up Razorpay (dev / test mode)

1. **Get test keys** — Razorpay Dashboard (Test Mode) → Settings → API Keys →
   copy `Key ID` / `Key Secret` into `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
2. **Webhook secret** — this is a string *you* invent, not fetched from
   Razorpay:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Put it in `RAZORPAY_WEBHOOK_SECRET`.
3. **Expose your local backend publicly** (Razorpay's servers need to reach
   it — plain `localhost` won't work):
   ```powershell
   cloudflared tunnel --url http://localhost:5000
   ```
   (or `ngrok http 5000` — note: `localtunnel`/`loca.lt` URLs are blocked by
   Razorpay's hostname allowlist, don't use those)
4. **Register the webhook** — Razorpay Dashboard → Settings → Webhooks →
   Add New Webhook:
   - URL: `https://<your-tunnel-domain>/api/webhooks/razorpay`
   - Secret: the same string from step 2
   - Active events: `payment.captured`, `payment.failed`
5. Restart the backend after any `.env` change.

The webhook is a safety net only — checkout still works end-to-end without
it (`verifyCheckoutPayment` fulfills synchronously on the client callback);
leaving `RAZORPAY_WEBHOOK_SECRET` blank just means webhook calls are rejected
rather than breaking anything else.

---

## Running locally

```bash
# Backend
cd backend
npm install
cp .env.example .env      # then fill in the values above
npm run seed:admin        # creates a super_admin login
npm run seed:tiers        # seeds a default tier ladder per partner type
npm run dev                # nodemon, http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
npm run dev                 # vite, http://localhost:5173
```

Useful scripts:

| Location | Script | What it does |
|---|---|---|
| `backend` | `npm run dev` | start API with nodemon (auto-restart) |
| `backend` | `npm start` | start API (no auto-restart) |
| `backend` | `npm run seed:admin` | create the first admin (`super_admin`) login |
| `backend` | `npm run seed:tiers` | seed default `PartnerTier` ladders |
| `frontend` | `npm run dev` | Vite dev server |
| `frontend` | `npm run build` | production build |
| `frontend` | `npm run lint` | ESLint over the frontend |

---

## Notable design decisions worth knowing before changing code

- **New features avoid editing existing model files.** Several features
  (settlement bills/history, custom commission assignment, agreement
  acceptance) were deliberately built as brand-new model files referencing
  existing ones by ID, rather than adding fields to `Partner`,
  `PartnerSettlement`, `PartnerCommission`, etc. Follow this pattern for new
  work unless there's a strong reason not to.
- **`commissionRuleId` on `PartnerCommission` is optional.** When a
  commission was computed from a `PartnerCommissionAssignment` (vendor
  custom override) rather than a `CommissionRule`, it's left unset — the
  full computed terms already live in the `calculation` sub-document, and
  `commissionRuleId`'s `ref` only ever resolves the `CommissionRule`
  collection.
- **Commission and agreement text can never drift** — both
  `commissionEngine.js` and `generatePartnerAgreement.js` resolve "what rule
  applies to this partner" through the exact same
  `utils/partnerCommissionResolver.js` lookup.
- **Every payment/payout path re-verifies before trusting money moved.**
  Customer checkout re-fetches and signature-checks with Razorpay even after
  a client-side "success" callback; settlement Razorpay-verify does the same
  before marking a payout paid.
- **`PartnerActivity.activityType` has a fixed enum.** New event types that
  don't fit are logged under the closest existing value (e.g. bill events use
  `document_uploaded`/`document_verified`) rather than extending the enum —
  the dedicated audit models (`PartnerSettlementHistory`,
  `PartnerAgreementAcceptance`) carry the precise event names instead.
- **This is a dev-phase project on Razorpay test credentials and test DB
  data** — no cleanup/migration tooling is expected yet; real credentials
  and production data come later.
