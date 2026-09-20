# SPOTX Reseller Partner Panel

A platform for SPOTX (an enterprise digital signage platform) to manage **Reseller**
partners — businesses that buy SPOTX software licenses in bulk and resell them,
bundled with their own screen hardware, to their own customers. It runs three
separate web apps out of one codebase — a **Partner Panel**, an **Admin Panel**,
and a lightweight **Customer Portal** — backed by one Express + MongoDB API.

Unlike a commission-based affiliate model, a Reseller purchases SPOTX licenses
at wholesale and operates its own business on top of them: it holds licenses as
inventory, allocates them to its own customers, and pays SPOTX on a recurring
billing cycle for every license purchased — regardless of whether that license
is currently in use. SPOTX has no visibility into what a Reseller charges its
own customers. See [`RESELLER_COMPLETE_PLAN.md`](./RESELLER_COMPLETE_PLAN.md)
for the full business rationale and technical spec this module was built from.

---

## Tech stack

| Layer | Stack |
|---|---|
| Backend | Node.js, Express 5, MongoDB (Mongoose 9) |
| Frontend | React 19, Vite, React Router 7, Tailwind CSS 4, TanStack Query |
| Auth | JWT — three **completely separate** token spaces (partner / admin / customer portal) |
| Payments | Razorpay (Standard Checkout + Webhooks) + RazorpayX (payouts) |
| PDF generation | pdfkit (Partner Agreement) |
| Email | Nodemailer (SMTP) |
| Logging | Custom file logger (`backend/logs/YYYY-MM-DD.log`) |

---

## Repo layout

```
partnerpanel/
├─ backend/
│  ├─ index.js              — Express app entry, route mounting, CORS/helmet, webhook
│  ├─ config/                — env-driven constants, DB connection, roles/permissions
│  ├─ models/                — Mongoose schemas (see "Data model" below)
│  ├─ controller/            — request handlers, one file per resource area
│  ├─ router/                — Express routers, one file per resource area
│  ├─ middleware/             — auth guards, upload handling, permission checks
│  ├─ services/               — cross-cutting business logic (reseller billing,
│  │                            inventory ledger, license order/prepayment
│  │                            fulfillment, notifications, scheduler, …)
│  ├─ utils/                  — small stateless helpers (encryption, code
│  │                            generators, Razorpay/RazorpayX clients, logger, …)
│  ├─ validations/             — request-body validators
│  └─ seed/                   — one-off DB seed scripts (admin user, demo reseller)
└─ frontend/
   └─ src/
      ├─ pages/
      │  ├─ partner/reseller/ — Reseller-specific Partner Panel screens
      │  ├─ partner/          — shared partner screens (Documents, Bank, Team, Profile…)
      │  ├─ admin/            — Admin Panel screens
      │  └─ (Customer*.jsx)    — public referral signup + Customer Portal screens
      ├─ layouts/              — shared shell per app (Partner/Admin/Customer)
      ├─ context/              — auth context providers (partner/admin)
      ├─ components/           — shared UI + per-app components
      ├─ services/             — axios clients (one per app, separate token headers)
      └─ utils/                — auth event bus, Razorpay checkout helper
```

---

## The three apps

### 1. Partner Panel (`/partner/...`)

What a Reseller partner uses day to day (every partner in this system is a
Reseller — `PARTNER_TYPES` is `["reseller"]`):

- **Register / Login** — self-service registration (`/partner/register`) or
  admin-created accounts. JWT stored as `partnerToken` in `localStorage`.
- **Profile** — business/legal details, address, Partner Agreement.
- **Documents (KYC)** — upload MSME/Udyam, GST certificate, PAN, cancelled
  cheque, etc. **Owner-only** — this and Bank are the two most sensitive areas
  of a partner account.
- **Bank** — bank account for RazorpayX-linked payouts. Owner-only.
- **Team** — invite teammates with a role (`admin` / `sales` / `finance` /
  `viewer`), each scoped by the permission catalogue in `config/roles.js`.
- **Reseller Dashboard** — inventory summary (Purchased / Allocated /
  Available / Active / Suspended, with Purchased called out as the billing
  basis), customer summary, and billing summary (current invoice, next due,
  status).
- **Software Licenses** — inventory overview and the full transaction ledger.
- **Buy More Licenses** — request a bulk license purchase (server-computed
  price breakdown); requires a one-time prepayment before the first request,
  then admin accept/reject per request.
- **Customers** — the Reseller's own end customers: create, allocate
  licenses, release, suspend, reactivate, cancel.
- **Billing** — current invoice, due-date estimate, invoice history, and
  online payment (Razorpay) where an admin has enabled it for that invoice.
- **Notifications** — in-app notification feed (invoice due soon, low
  inventory, etc.).

Reseller-only routes are additionally gated by `requireResellerPartner` and, for
anything that grows what a partner owes, `blockIfResellerPaymentRestricted`
(a payment-restricted partner can still release/suspend/cancel, just not
allocate new licenses or buy more). Most routes are also gated by
`requireVerifiedPartner` — a partner can complete profile/KYC/bank before
verification, but reseller features are locked until an admin verifies the
account.

### 2. Admin Panel (`/admin/...`)

What SPOTX staff use to run the whole platform:

- **Dashboard** — platform-wide stats.
- **Partners** — list/detail, KYC document review, bank verification, status
  changes (draft → pending_verification → under_review → active/suspended/
  rejected/inactive), per-partner **pricing plan** (discount-percent or
  fixed-price mode) and **billing config** (cycle, proration, retry/grace
  settings).
- **Customers** — cross-partner view of all Resellers' end customers.
- **Documents** / **Bank** — cross-partner KYC/bank verification queues.
- **Reseller Dashboard** — cross-partner inventory/revenue totals, pending
  license-order requests (accept/reject), invoice payment-mode control
  (offline vs. online per invoice) and offline-payment verification,
  "Run Billing Now", and low-inventory/due-date notification checks.

### 3. Customer Portal (`/customer/...`)

A lightweight, read-mostly portal for a **Reseller's own customer** (not a
SPOTX customer — SPOTX never bills them directly):

- **Register** via a Reseller's referral link/code, verify email and set a
  password, then log in with a separate `customerPortalToken`.
- **Dashboard** — their account status with that Reseller.
- **Screens** — view and self-register the screens delivered to them.

---

## Auth model

Three **independent** JWT spaces that never work against each other's routes:

| | Token localStorage key | Signed with | Identity model |
|---|---|---|---|
| Partner | `partnerToken` | `JWT_SECRET` | `PartnerUser` (belongs to a `Partner`) |
| Admin | `adminToken` | `ADMIN_JWT_SECRET` | `User` (SPOTX staff) |
| Customer Portal | `customerPortalToken` | `CUSTOMER_JWT_SECRET` | `ResellerCustomer` |

Partner-side permission model (`config/roles.js`):

- Roles: `owner`, `admin`, `sales`, `finance`, `viewer` — each maps to a fixed
  permission list, including `reseller:*` permissions (`inventory:view`,
  `license:purchase`, `customers:manage`, `allocation:manage`,
  `billing:view`, `billing:pay`).
- `owner` always bypasses permission checks entirely.
- `documents:*` and `bank:*` are **owner-only** no matter what a role is
  configured with.

Admin-side roles (`ADMIN_ROLES`): `super_admin`, `kyc_reviewer`, `finance` —
enforced per-route via `requireAdminRole(...)`.

---

## Data model (MongoDB / Mongoose)

Every model lives under `backend/models/`:

**Partner core**
- `Partner` — the business entity (legal details, address, KYC/verification
  status, cached stats)
- `PartnerUser` — a login for a `Partner` (owner/admin/sales/finance/viewer)
- `PartnerDocument` — KYC files (MSME/GST/PAN/cheque/**partner_agreement**)
- `PartnerBankAccount` — encrypted bank account for payouts
- `PartnerRazorpayXAccount` — linked RazorpayX contact/fund account for payouts
- `PartnerActivity` — audit log (fixed enum of activity types)
- `PartnerNotification` — in-app notification feed
- `PartnerProgram` — time-boxed signup campaign

**Reseller inventory & customers**
- `ResellerInventory` — one document per partner: Purchased / Allocated /
  Registered / Active / Suspended counters, mutated only via
  `services/resellerInventory.js` so every change is transactional and
  logged
- `ScreenLicensePurchaseOrder` — one immutable record per bulk license
  request (request-then-accept: `orderStatus: pending | completed |
  payment_failed`)
- `LicenseTransaction` — append-only ledger of every inventory change
  (purchase/allocation/release/registration/activation/suspension/
  reactivation/cancellation)
- `ResellerCustomer` — the Reseller's own end customer (distinct from any
  SPOTX-billed customer; no trial period — subscription starts on
  activation)
- `CustomerAllocation` — the license-level relationship between a partner and
  one customer (allocated/registered/active/suspended counts, no price field)
- `Screen` — a delivered screen+software bundle unit, tied to an allocation
  (`soldAsResellerBundle` flag only — no hardware cost/serial/warranty data)

**Reseller pricing & billing**
- `ResellerPricingPlan` — per-partner rate, set by superadmin: either a
  discount percentage off list price or a flat negotiated rate; snapshotted
  onto every order/invoice so later changes never affect historical records
- `ResellerBillingConfig` — per-partner billing cycle (monthly/quarterly/
  yearly), proration rule, due days, retry schedule, grace period,
  agreement end date, and one-time prepayment requirement/status
- `ResellerInvoice` — SPOTX's invoice to the Reseller, billed on total
  **purchased** licenses only (never active/allocated/registered), with a
  full pricing snapshot; payment mode is offline by default, admin can
  switch a specific invoice to online (Razorpay)
- `PaymentGatewaySetting` — payment-gateway configuration read at request
  time (no admin-UI credential override — see Environment variables below)

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
   status: active  ──▶  admin sets ResellerPricingPlan (discount % or fixed
                        rate) + ResellerBillingConfig (cycle, proration,
                        retry/grace) — this generates and auto-accepts the
                        Partner Agreement PDF describing those terms.
```

### License purchasing (request → accept)

```
Partner completes one-time prepayment (required before any license request)
        │
        ▼
POST /partner/reseller/license-orders  → ScreenLicensePurchaseOrder (pending)
        │  (server computes price from the partner's live ResellerPricingPlan;
        │   client-submitted amounts are never trusted)
        ▼
Admin reviews  ──▶  Accept: licenses credited to ResellerInventory immediately,
        │           billed later via the partner's regular invoice cycle
        │           (no separate per-order payment step)
        └────────▶  Reject: order marked payment_failed, no inventory change
```

### Customer allocation lifecycle

```
Reseller creates a ResellerCustomer
        │
        ▼
Allocate licenses (rejected at the DB level, not a preceding check, if it
would exceed Available = Purchased − Allocated)
        │  allocateLicenses registers + activates in the same call —
        │  there is no separate manual register/activate step
        ▼
Active  ──▶  Suspend (Reseller-initiated, e.g. their customer stopped paying
        │    them — licenses stay reserved, SPOTX billing unaffected)
        │    ──▶ Reactivate
        └──▶  Cancel / Release (license returns to Available; does NOT
              reduce what was purchased or what's owed to SPOTX)
```

### Recurring billing (what the partner owes SPOTX)

```
SPOTX Bill (per cycle) =
    Total Purchased Licenses × Effective Price Per Screen
    × Cycle Multiplier (1 monthly, 3 quarterly, 12 yearly) + Tax
```

Billing reads **only** `totalPurchasedLicenses` — allocation, delivery,
activation, and suspension never affect the invoice. An admin runs billing
via "Run Billing Now" (`adminResellerController.runBillingNow`), idempotent
per `partnerId + billingPeriodStart + billingPeriodEnd`. A missed payment
restricts new purchases/allocations only — existing inventory and
already-delivered screens are never touched (see `RESELLER_COMPLETE_PLAN.md`
§B12/§B15 for the full retry/grace/suspension rules).

### Customer self-service (Customer Portal)

```
Reseller shares a referral link/code
        │
        ▼
Customer registers → verifies email → sets password
        │
        ▼
Logs into /customer with a separate customerPortalToken
        │
        ▼
Views their screens; can self-register a delivered screen
```

---

## Environment variables (`backend/.env`)

Copy `backend/.env.example` → `backend/.env` and fill in:

```
MONGO_URI=                 # MongoDB connection string
PORT=5000

JWT_SECRET=                # signs partner tokens
ADMIN_JWT_SECRET=          # signs admin tokens — deliberately separate
CUSTOMER_JWT_SECRET=       # signs Customer Portal tokens — deliberately separate
BANK_ENC_KEY=              # AES-256-GCM key encrypting bank account numbers

CLIENT_URL=http://localhost:5173
CLIENT_URLS=http://localhost:5173   # comma-separated if multiple frontends (e.g. add your Netlify URL)

SMTP_USER=                 # for password reset / invite / verification emails
SMTP_PASS=

RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_WEBHOOK_SECRET=   # see "Setting up Razorpay" below
```

Razorpay credentials are read via `utils/paymentGatewayConfig.js`, resolved
lazily per-request (no admin-panel override UI — edit `.env` and restart to
change credentials).

### Frontend (`frontend/.env`)

```
VITE_API_URL=http://localhost:5000/api   # point this at your deployed backend URL in production
```

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
   - URL: `https://<your-tunnel-or-prod-domain>/api/webhooks/razorpay`
   - Secret: the same string from step 2
   - Active events: `payment.captured`, `payment.failed`
5. Restart the backend after any `.env` change.

The webhook is a safety net only — checkout still works end-to-end without
it via the client-side verify call; leaving `RAZORPAY_WEBHOOK_SECRET` blank
just means webhook calls are rejected rather than breaking anything else.

---

## Running locally

```bash
# Backend
cd backend
npm install
cp .env.example .env      # then fill in the values above
npm run seed:admin        # creates a super_admin login
npm run dev                # nodemon, http://localhost:5000

# Frontend (separate terminal)
cd frontend
npm install
cp .env.example .env       # point VITE_API_URL at your backend
npm run dev                 # vite, http://localhost:5173
```

Useful scripts:

| Location | Script | What it does |
|---|---|---|
| `backend` | `npm run dev` | start API with nodemon (auto-restart) |
| `backend` | `npm start` | start API (no auto-restart) |
| `backend` | `npm run seed:admin` | create the first admin (`super_admin`) login |
| `backend` | `npm run seed:demo-reseller` | seed a demo reseller partner for local testing |
| `frontend` | `npm run dev` | Vite dev server |
| `frontend` | `npm run build` | production build (outputs to `frontend/dist`) |
| `frontend` | `npm run lint` | ESLint over the frontend |

---

## Deploying

**Frontend → Netlify.** This repo includes a `netlify.toml` at the project
root configured to build from `frontend/` (`npm run build`, publish
`frontend/dist`) with an SPA fallback so React Router's client-side routes
don't 404 on refresh. In Netlify: set the base directory to `frontend`, add
a `VITE_API_URL` environment variable pointing at your deployed backend's
`/api` URL, and deploy.

**Backend.** Netlify does not host a persistent Express + MongoDB process —
deploy `backend/` separately to a Node host (Render, Railway, Fly.io, a VM,
etc.), set the environment variables above there, and point the frontend's
`VITE_API_URL` at it. Add the Netlify site's URL to the backend's
`CLIENT_URLS` so CORS allows it, and update the Razorpay webhook URL to that
backend's public domain.

---

## Notable design decisions worth knowing before changing code

- **This app is single-partner-type by design.** `PARTNER_TYPES` is
  `["reseller"]` — the platform was narrowed from an earlier multi-partner-type
  (vendor/affiliate/influencer/…) commission-based model to focus solely on
  the Reseller license/inventory/billing model. No commission engine,
  opportunities, or settlements exist in this codebase.
- **Billing is based on purchased licenses only, never usage.** Every billing
  calculation must read `totalPurchasedLicenses` — never
  `totalActiveScreens`/`totalRegisteredScreens`. This is the single most
  consequential invariant in the system (see `RESELLER_COMPLETE_PLAN.md` §A2/§B14).
- **No visibility into resale economics, anywhere.** What a Reseller charges
  its own customer is never stored, calculated, or displayed anywhere in this
  system — the only financial relationship tracked end-to-end is what the
  Reseller owes SPOTX.
- **Inventory is a transactional ledger, not editable fields.** Only
  `services/resellerInventory.js` may write to `ResellerInventory`; every
  change is enforced at the database-update filter level (not a preceding
  check) and recorded as a `LicenseTransaction`.
- **Pricing and billing terms are snapshotted per transaction.** A later
  change to a partner's rate or billing cycle never alters already-created
  purchase orders or invoices.
- **Every payment path re-verifies before trusting money moved.** Razorpay
  checkout re-fetches and signature-checks even after a client-side "success"
  callback; the webhook is the authoritative safety net, not the client call.
- **This is a dev-phase project on Razorpay test credentials and test DB
  data** — no cleanup/migration tooling is expected yet; real credentials
  and production data come later.
