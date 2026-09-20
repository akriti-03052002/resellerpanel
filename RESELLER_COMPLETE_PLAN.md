# Reseller Partner Module — Technical Plan

**Status:** Draft for internal review. No part of this module has been implemented.
**Scope:** `partnerType: "reseller"` already exists in the codebase. This plan upgrades that partner type in place with a complete license-inventory and billing system. There is no rename, no new enum value, and no data migration required.

This document has two parts:
- **Part A — Business Model & Rationale:** what a Reseller partner is, why its model differs from every other partner type, worked examples, and how it integrates with the existing Partner Panel.
- **Part B — Technical Specification:** data models, services, routes, RBAC, frontend, and open items.

## Summary of Business-Model Decisions

1. **Billing basis.** SPOTX bills the Reseller on total purchased licenses, not on active or in-use screens. A Reseller pays for every license purchased — allocated or not, activated or not, suspended or not — in the same way a seat-based software subscription is billed for seats reserved rather than seats in active use.
2. **Billing cycle.** Each Reseller's billing cycle (monthly, quarterly, or yearly) is set per their signed agreement. There is no default assumption of monthly billing.
3. **Product bundling.** The Reseller sells the end customer a screen and SPOTX software together as a single product. The customer purchases from the Reseller, not from SPOTX. The physical hardware — sourcing, cost, and warranty — is entirely the Reseller's responsibility; SPOTX sells only the software license to the Reseller.
4. **Pricing model.** Each Reseller's per-screen rate is set by SPOTX superadmin using one of two modes, per the signed agreement: a discount percentage off the standard list price, or a flat negotiated rate independent of list price. Exactly one mode applies to a given partner at any time, and it governs both bulk purchases and recurring invoices.
5. **No customer trial.** Unlike the Vendor `Customer` model, which grants a 30-day trial before billing starts, a Reseller's end customer has no trial period. Their subscription with the Reseller begins the moment their screen is activated.
6. **No visibility into resale economics, anywhere on the platform.** What the Reseller charges its own customer for the bundle, and how that payment is collected, must not appear on any part of this system — not in the partner panel, not in the admin panel, not in any API response, report, export, or database field. No screen anywhere is permitted to ask for, display, or store that number. The only financial relationship this system tracks, end to end, is what the Reseller owes SPOTX.

---

# PART A — BUSINESS MODEL & RATIONALE

## A1. What a Reseller Partner Is

Every other partner type in this system (Vendor, Affiliate, Influencer, Referral, Agency, Technology, Strategic) shares the same commercial shape: the partner brings SPOTX business, and SPOTX pays the partner a commission. The commission engine, `PartnerCommission`, and `PartnerSettlement` all exist to answer one question — how much does SPOTX owe this partner?

The Reseller partner type inverts that relationship. A Reseller purchases SPOTX's product at wholesale and operates its own business on top of it:

1. Purchases a batch of SPOTX screen software licenses in bulk, often in advance of any confirmed customer demand.
2. Holds that batch as inventory.
3. Sources its own customers, on its own commercial terms.
4. Sells each customer a screen and SPOTX software together as a single bundled product. The Reseller sources the physical hardware itself, at its own cost and margin; SPOTX has no visibility into that side of the transaction.
5. Collects payment from its customers directly. SPOTX is not a party to that transaction.
6. Pays SPOTX at its negotiated rate, on its agreed billing cycle (monthly, quarterly, or yearly), for every license purchased — regardless of whether that license is currently allocated, delivered, activated, or unused.

Accordingly, the system's role for a Reseller is not to calculate what SPOTX owes the partner, but the reverse: what the partner owes SPOTX this billing cycle, based on licenses purchased rather than licenses used, and whether the partner has sufficient available inventory to take on new customers.

## A2. Inventory as a Multi-State Ledger

A single `screenCount` field is insufficient, because a Reseller's licenses exist in several distinct states simultaneously:

- **Purchased** — total licenses paid for. This is also the billing basis.
- **Allocated** — reserved for a specific customer, whether or not that customer's bundle has been delivered.
- **Registered** — a screen+software bundle has been delivered to the customer and tied to the allocation.
- **Active** — a delivered screen currently running SPOTX software. Operationally relevant to the Reseller's own tracking; has no bearing on the SPOTX invoice.
- **Suspended** — a customer's screen paused by the Reseller (for example, following a payment lapse on the Reseller's own side). The license remains reserved and continues to be billed by SPOTX as normal.
- **Available** — purchased minus allocated; unpromised inventory.

Representing these as independently editable fields would allow the numbers to drift out of consistency. Instead, each is a counter that can only be changed by a single, transactional service function, so every change is recorded as a ledger entry rather than a direct edit.

## A3. Two Independent Payment Relationships

```
Relationship 1 (within SPOTX's system):
    Reseller Partner  →  SPOTX
    Bulk license purchases, plus a recurring bill (monthly, quarterly, or
    yearly per agreement) for every purchased license, regardless of use.

Relationship 2 (entirely outside SPOTX's system):
    Customer  →  Reseller Partner
    The customer purchases a screen+software bundle at a price set solely
    by the Reseller. SPOTX has no visibility into this transaction or its
    amount.
```

The Reseller's margin is the difference between what it charges its customer for the bundle and what it pays SPOTX for the license (plus any margin on the hardware, which is its own concern). This system does not calculate, store, or display that margin in any form — no customer-facing price field, no profit report. The only monetary calculation this system performs is what the Reseller owes SPOTX (see Section B14), and that calculation must never depend on or reference anything about the customer-facing side of the transaction.

## A4. License Lifecycle

```
Purchased → Available → Allocated → Registered (bundle delivered) → Active → Suspended → Reactivated → Cancelled/Released → Available
```

- **Purchase** — payment to SPOTX; licenses enter inventory as Available. Purchases are not refundable by default. Billing begins from this point.
- **Allocate** — reserve licenses for a named customer. Reversible via Release.
- **Register** — the Reseller sources and delivers a physical screen, pre-loaded with SPOTX software, to the customer as part of the bundled sale, and ties that unit to the reserved license.
- **Activate** — the delivered screen goes live. The customer's subscription with the Reseller begins at this point, with no trial period. Activation does not change the SPOTX invoice, since the license was already counted as purchased.
- **Suspend** — the Reseller pauses a customer's screen without releasing the license. Billing to SPOTX is unaffected.
- **Cancel** — the license is released back to inventory. This does not reduce what the partner purchased, and therefore does not reduce the amount owed to SPOTX.

Allocation, registration, and activation are operational states describing how the Reseller manages its own customer base. None of them affect the SPOTX invoice — only the purchased-license count does. This is a reserved-capacity billing model, comparable to a seat-based software license or a bulk-minutes telecom plan, rather than a metered usage model.

Because the Reseller sells a screen and software as one bundle, it is effectively operating two layered businesses: a hardware business (sourcing and selling screens, entirely its own cost and margin) and a software resale business (purchasing SPOTX licenses at wholesale, which is the subject of this plan). SPOTX has no visibility into, and no stake in, the hardware side.

## A5. Worked Example

**Day 0.** Partner ABC is onboarded as a Reseller with zero purchased licenses and zero customers. A Reseller partner may legitimately exist with no customers at all.

**Bulk purchase.** ABC purchases 500 licenses in advance of confirmed demand. Under its agreement, ABC receives a 20% discount off the SPOTX standard rate of ₹100/screen, paying ₹80/screen — a total of ₹47,200 (₹80 × 500, plus 18% GST) via Razorpay.

```
Purchased 500 / Allocated 0 / Active 0 / Available 500
```

From this point, ABC owes SPOTX for 500 licenses every billing cycle, independent of whether any license is ever allocated to a customer.

**First customer.** Customer A requires 100 screens. ABC allocates 100 licenses.

```
Purchased 500 / Allocated 100 / Available 400
```

**Delivery and activation.** ABC sources and delivers 80 screen+software bundles to Customer A and activates them. Customer A's subscription with ABC begins immediately, with no trial period.

```
Allocated 100 / Registered 80 / Active 80
```

The remaining 20 allocated licenses are reserved but undelivered. This has no bearing on ABC's SPOTX bill, which is based on the full purchased count regardless of delivery or activation status.

**Additional customers.** Customers B and C require 150 and 200 screens respectively; ABC allocates and delivers accordingly.

```
Purchased 500 / Allocated 450 / Active 450 / Available 50
```

**Capacity constraint.** A further customer requires 100 licenses; only 50 remain available. The system rejects the allocation with a clear message. ABC purchases an additional 100 licenses as a new, separate order — the original order is never modified.

```
Purchased 600 / Allocated 450 / Available 150 → allocate 100 → Allocated 550 / Available 50
```

**Reduction and cancellation.** Customer A reduces from 100 to 80 screens (20 licenses released); Customer B cancels entirely (150 licenses released). ABC's purchased total remains 600 throughout — only the allocation changes.

**Billing.** At the end of ABC's billing cycle (assume monthly), SPOTX bills ABC for its total purchased licenses — 600 — at its effective rate of ₹80/screen: ₹48,000 plus GST. This applies irrespective of how many of those licenses are currently active, delivered, or allocated. Had ABC's agreement specified a quarterly cycle, the same 600 licenses would be billed at ₹1,44,000 plus GST once every three months rather than monthly. A missed payment triggers the configured retry and grace-period process; purchased-license history and inventory are never altered as a result of a billing dispute — only the partner's account/service permissions are affected.

## A6. Integration with the Existing Partner Panel

- **No change to core partner infrastructure.** `Partner`, `PartnerUser`, RBAC, KYC, and bank verification are unaffected. A Reseller authenticates through the same system as any other partner type; Reseller-specific capability is added purely through new `reseller:*` permissions.
- **Conditional navigation.** The sidebar renders a Reseller-specific navigation set (Software Licenses, Buy More Licenses, Billing, Customers/Allocations) based on `partner.partnerType`, and hides Opportunities, Referrals, Commissions, and Settlements, which do not apply to this partner type.
- **No commission engine involvement.** A Reseller never generates a `PartnerOpportunity` → `won` → `PartnerCommission` sequence.
- **Payment infrastructure reuse.** Both bulk license purchases and recurring invoice payments reuse the existing Razorpay integration (`razorpayWebhookController.js`) and the order-then-webhook-verification pattern already used for customer subscriptions (`CustomerPayment`), under two new webhook purposes. The webhook remains the authoritative source of truth; any client-side "payment succeeded" callback is treated only as a UX convenience.
- **Parallel admin views.** `AdminPartnerDetail.jsx` displays commission/settlement data for commission-based partner types and inventory/billing data for Reseller partners, selected by `partnerType`.
- **Deprecation of `wholesale_discount`.** The former `wholesale_discount` commission type modeled a Reseller's margin as an instantly-settled commission row — conceptually incorrect, and a source of confusion in commission reporting for other partner types. It is replaced entirely by the pricing and billing system described in Part B.
- **Hardware is out of scope.** No hardware SKU catalogue, cost tracking, or warranty management exists in this system. The `Screen` model records only a flag indicating a unit was sold as part of a Reseller bundle, for the Reseller's own reference.
- **Resale economics are out of scope.** No field, calculation, or report in this system reflects what a Reseller charges or collects from its own customers. The system's only financial output for this partner type is the amount owed to SPOTX (Section B14).

## A7. Implementation Risks

- **Webhook duplication.** A retried Razorpay webhook must not apply a purchase or payment twice. Mitigated by an atomic, single-use claim on the order/invoice record, consistent with the existing customer-payment implementation.
- **Allocation race conditions.** Two concurrent allocation requests must not both succeed against the same remaining capacity. Mitigated by expressing the availability check as part of the database update's filter condition, rather than as a separate preceding check.
- **Retroactive pricing changes.** A later change to standard pricing, discount rate, or fixed rate must not alter historical orders or invoices. Mitigated by snapshotting all pricing fields at the time each order or invoice is created.
- **Incorrect billing basis.** The single most consequential implementation risk in this plan: every billing calculation must read `totalPurchasedLicenses`, and must never read `totalActiveScreens` or `totalRegisteredScreens`. A defect that substitutes one of these fields for another would silently under-bill any partner holding unused inventory.
- **Inventory penalized for billing disputes.** A missed SPOTX payment must never automatically reduce a partner's inventory. Only account/service permissions are restricted; inventory and its history remain intact.
- **Conflation of cost layers.** Hardware cost and margin belong solely to the Reseller's business and must never appear in any SPOTX-side calculation, invoice, or report.

## A8. Summary

A Reseller Partner purchases SPOTX software licenses in bulk and resells them to its own customers, bundled with screen hardware it sources independently. This system's responsibility is limited to tracking how many licenses the partner has purchased and billing them each cycle — monthly, quarterly, or yearly, per agreement — for the full purchased count, irrespective of how many licenses are allocated, delivered, or active. The Reseller's own hardware and resale pricing never factor into the SPOTX invoice.

---

# PART B — TECHNICAL SPECIFICATION

## B1. Terminology

| Term | Definition |
|---|---|
| Screen Software License | One SPOTX software subscription assignable to a single screen. This is the unit on which SPOTX bills the Reseller. |
| Purchased Licenses | Total licenses purchased by the Reseller from SPOTX. The billing basis (Section B14). |
| Available Licenses | Purchased licenses not currently allocated to a customer. |
| Allocated Licenses | Licenses reserved for a customer's screen+software bundle. |
| Registered Screens | Physical screens sourced and sold by the Reseller as part of a bundle, registered against a customer allocation. |
| Active Screens | Delivered screens currently running SPOTX software. Operational only; does not affect billing. |
| Suspended Screens | Screens temporarily paused by the Reseller. Licenses remain reserved and continue to be billed. |
| Released Licenses | Licenses returned to available inventory. |
| Cancelled License | A license whose allocation has been cancelled and returned to inventory. |

A license and a physical screen are distinct database concepts: `Allocated ≠ Registered ≠ Active`. None of these correspond to the billing quantity — only `Purchased` does.

## B2. Lifecycle

```
Purchased (billing begins) → Available → Allocated → Registered (bundle delivered) → Active → Suspended → Reactivated → Cancelled/Released → Available
```

A license need not pass through every state. Billing is determined solely by the Purchased state; Allocated, Registered, Active, Suspended, and Cancelled exist only to support the Reseller's own operational management.

## B3. Reuse of Existing Code

| File | Current Role | Change for Reseller |
|---|---|---|
| `backend/config/constant.js` | `PARTNER_TYPES` already includes `reseller`; `COMMISSION_TYPES` includes `wholesale_discount` | Retain `reseller`. Remove `wholesale_discount` from `COMMISSION_TYPES` — it is no longer a commission type, and no `PartnerCommission` row will be generated for a Reseller. The equivalent concept becomes a per-partner pricing field on `ResellerPricingPlan` (Section B5). |
| `backend/config/roles.js` | Role permission tables | Add `reseller:*` permissions. |
| `backend/models/Partner.js` | Core partner entity | Unchanged. |
| `backend/models/Customer.js`, `Screen.js`, `ScreenPricing.js`, `CustomerPayment.js` | Vendor's direct customer, billed by SPOTX with a 30-day trial | Not reused for Reseller customers, who pay the Reseller (not SPOTX) and receive no trial. `Screen.js` is extended to record a delivered bundle unit; hardware cost, sourcing, and warranty are not tracked here. |
| `backend/controller/partnerCustomerController.js` | Vendor customer creation, type-gated | Gating pattern reused via new `requireResellerPartner` middleware. |
| `backend/controller/razorpayWebhookController.js` | Purpose-branched, idempotent webhook handler | Extended with `reseller_license_purchase` and `reseller_invoice_payment` branches. |
| `backend/models/PartnerSettlementBill.js` | Records SPOTX's payment obligation to a partner | Not applicable — the payment direction is reversed for Reseller. |
| `backend/utils/razorpay.js`, `backend/utils/logActivity` | Payment and audit utilities | Reused without modification. |
| `adminConfigController.buildAutoRuleShape` | Auto-generates a `CommissionRule` for a `reseller`→`wholesale_discount` tier | Branch removed. Pricing is now set directly via `ResellerPricingPlan`, not derived from a commission tier. |
| `backend/utils/partnerVerification.js` | KYC document requirements, keyed by `reseller` | Unchanged. |
| `backend/services/generatePartnerAgreement.js` | Contains a `reseller` clause | Clause retained and extended with license, billing-cycle, and bundle terms. |
| `backend/services/commissionEngine.js` | Contains a `wholesale_discount` branch | Branch removed entirely; a Reseller never enters the commission engine. |
| `backend/seed/seedTiers.js` | Seeds a reseller commission-tier ladder | Removed; superseded by `ResellerPricingPlan`. |

## B4. Constant Changes

```js
// backend/config/constant.js — no change to PARTNER_TYPES
const PARTNER_TYPES = [
  "vendor", "influencer", "affiliate", "referral",
  "agency", "reseller", "technology", "strategic"
];

const COMMISSION_TYPES = [
  "percentage", "fixed_per_deal", "fixed_per_screen",
  "recurring_percentage", "recurring_fixed", "hybrid"
  // "wholesale_discount" removed
];
```

## B5. Data Models

**`ResellerInventory`** — one document per partner, representing the current inventory state.
```
partnerId, totalPurchasedLicenses, totalAllocatedLicenses,
totalRegisteredScreens, totalActiveScreens, totalSuspendedScreens,
status: active | restricted | suspended
```
`totalAvailableLicenses` is a computed virtual (`purchased − allocated`) and is never persisted, to avoid drift. Only `services/resellerInventory.js` may modify this document. `totalPurchasedLicenses` is the sole field consumed by billing.

**`ScreenLicensePurchaseOrder`** — one immutable record per bulk purchase.
```
partnerId, quantity,
pricing: {
  standardUnitPrice,
  pricingMode: "discount_percent" | "fixed_price",
  wholesaleDiscountPercent,     // present only when pricingMode is discount_percent
  fixedUnitPrice,               // present only when pricingMode is fixed_price
  unitPrice,                    // effective price applied to this order
  subtotal, taxRatePercent, taxAmount, discount, totalAmount, currency
},
pricingPlanId,
razorpay: { orderId, paymentId, signature (excluded from default queries), method, failureCode, failureReason },
status: created | paid | failed,
orderStatus: pending | completed | payment_failed,
licensesApplied: boolean,
orderCode  // e.g. "RP-LIC-00001"
```
Purchase orders are never edited after creation; each additional purchase creates a new record.

**`LicenseTransaction`** — append-only ledger of all inventory changes.
```
partnerId, customerId?, allocationId?, purchaseOrderId?,
type: purchase | allocation | release | adjustment | registration | activation | suspension | reactivation | cancellation,
quantity, previousBalance, newBalance, reason, createdBy, createdAt
```

**`ResellerCustomer`** — the Reseller's end customer.
```
partnerId, businessDetails { companyName, gstin }, contactDetails { name, email, phone },
status: pending | allocated | pending_activation | active | suspended | cancelled
```
Distinct from `Customer` (the Vendor's direct SPOTX customer). No trial state exists in this model — subscription begins on activation.

**`CustomerAllocation`** — the license-level relationship between a Reseller and one customer.
```
partnerId, customerId,
allocatedLicenses, registeredScreens, activeScreens, suspendedScreens,
status: allocated | pending_activation | active | suspended | cancelled,
allocatedAt, activatedAt, releasedAt
```
This model intentionally has no price field of any kind. `activatedAt` is the subscription start date.

**`Screen`** (extended) — reuse of the existing model.
```
allocationId, licenseStatus: allocated | registered | active | suspended | cancelled,
registeredAt, activatedAt, suspendedAt, cancelledAt,
soldAsResellerBundle: boolean   // reference flag only; no cost, serial, or warranty data
```

**`ResellerPricingPlan`** — one record per partner, maintained by superadmin.
```
partnerId,
standardPricePerScreen,
pricingMode: "discount_percent" | "fixed_price",
wholesaleDiscountPercent,       // used when pricingMode = discount_percent
fixedPricePerScreen,            // used when pricingMode = fixed_price, independent of standard rate
effectivePricePerScreen,        // persisted, not virtual — computed from whichever mode is active
minPurchaseQty,
bulkTiers: [{ minQty, pricePerScreen }],   // applicable only in discount_percent mode
bulkTierBasis: "per_order" | "cumulative",   // whether tiers key off a single order's
                                               // quantity or the partner's running total
                                               // purchased-to-date; default per_order
taxRatePercent,
effectiveFrom, isActive
```
`effectivePricePerScreen` is the rate applied to both purchase orders and invoices. It is snapshotted at the time each transaction is created, so a later change in rate or mode affects only future transactions.

**`ResellerBillingConfig`** — one record per partner, defining billing behavior per agreement.
```
billingMetric: "purchased"      // fixed; never active, allocated, or registered counts
billingCycle: monthly | quarterly | yearly,
billingStartRule: on_first_purchase | fixed_day_of_month,
prorationRule: none | daily_proration,
dueDays, retrySchedule: [{ dayOffset }], gracePeriodDays,
agreementEndDate   // triggers an admin-facing alert as this date approaches (Section B15);
                     // does not itself suspend or change the partner — see B15 item 3
```

**`ResellerInvoice`** — SPOTX's invoice to the Reseller.
```
partnerId, invoiceNumber, billingCycle: monthly | quarterly | yearly,
billingPeriodStart, billingPeriodEnd,
purchasedLicenseSnapshot,
standardUnitPriceSnapshot,
pricingModeSnapshot: "discount_percent" | "fixed_price",
wholesaleDiscountPercentSnapshot,
fixedUnitPriceSnapshot,
unitPriceSnapshot,
cycleMultiplier,   // 1 monthly, 3 quarterly, 12 yearly
subtotal, taxRatePercent, taxAmount, total,
dueDate, paymentStatus: pending | paid | failed | overdue,
razorpay { orderId, paymentId }, paidAt
```
Immutable once generated; corrections are recorded as separate adjustment entries.

## B6. Inventory Service and Invariants

`backend/services/resellerInventory.js` is the sole code path permitted to write to `ResellerInventory`. Each mutation:

```
1. Begin a database transaction.
2. Apply the invariant as part of the update's filter condition, e.g.:
     allocate(qty): { partnerId, $expr: { $lte: [ { $add: ["$totalAllocated", qty] }, "$totalPurchased" ] } }
   A failed match is rejected with: "Insufficient available screen licenses. Available: X. Requested: Y."
3. Write a corresponding LicenseTransaction record within the same transaction.
4. Commit atomically.
```

Invariants enforced at all times:
```
totalAvailableLicenses >= 0
totalAllocatedLicenses <= totalPurchasedLicenses
totalRegisteredScreens <= totalAllocatedLicenses
totalActiveScreens <= totalRegisteredScreens
totalSuspendedScreens <= totalRegisteredScreens
```
None of these invariants govern billing; billing reads only `totalPurchasedLicenses`, independent of this service's allocation logic.

## B7. Middleware

```js
// requireResellerPartner
if (req.partner.partnerType !== "reseller") {
  return res.status(403).json({ success: false, message: "This feature is only available to Reseller partners." });
}
```
Applied after existing partner authentication and `requireVerifiedPartner` middleware.

## B8. Controllers and Routes

| Controller | Routes |
|---|---|
| `partnerResellerInventoryController.js` | `GET /partner/reseller/inventory`, `GET /partner/reseller/inventory/transactions` |
| `partnerLicenseOrderController.js` | `POST/GET /partner/reseller/license-orders`, `GET /:id` |
| `partnerResellerCustomerController.js` | `GET/POST /partner/reseller/customers`, `GET /:id` |
| `partnerAllocationController.js` | `POST /partner/reseller/allocations`, `/:id/release`, `/register`, `/activate`, `/suspend`, `/reactivate`, `/cancel` |
| `partnerResellerBillingController.js` | `GET /partner/reseller/invoices`, `POST /:id/pay` |
| `adminResellerConfigController.js` | `GET/PUT /admin/reseller/partners/:id/pricing-plan`, `GET/PUT /admin/reseller/billing-config` |
| `adminResellerController.js` | `GET /admin/reseller/dashboard`, `GET /admin/reseller/partners/:id` |

The webhook handler in `razorpayWebhookController.js` is extended with `purpose === "reseller_license_purchase"` and `"reseller_invoice_payment"` branches, following the existing idempotent-claim pattern.

Billing generation requires a scheduling mechanism not currently present in this codebase — either a scheduled job (e.g. `node-cron`) or an admin-triggered "Run Reseller Billing" action, idempotent on `partnerId + billingPeriodStart + billingPeriodEnd`. Any scheduler must evaluate each partner's individual billing cycle rather than assuming a single global schedule (see Section B12).

## B9. RBAC

```
reseller:inventory:view
reseller:license:purchase
reseller:customers:manage
reseller:allocation:manage
reseller:billing:view
reseller:billing:pay
```
Integrated into the existing per-role permission tables in `backend/config/roles.js`, following the same view/manage structure used for `customers:*`.

## B10. Frontend

**Sidebar** (rendered when `partnerType === "reseller"`):
```
Dashboard
Customers (All / Add / Allocations)
Software Licenses (Overview / Available / Purchase Orders / Transaction History)
Billing (Current Invoice / History / Payment History)
Buy More Licenses
Profile (Business Details / KYC / Bank / Agreement)
```
Opportunities, Referrals, Commissions, and Settlements are not shown for this partner type.

**Dashboard.** Inventory summary (Purchased, Allocated, Available, Registered, Active, Suspended, with a note identifying Purchased as the billing basis); customer summary (Total, Active, Pending, Suspended, Cancelled); billing summary (Current Invoice, Outstanding, Next Due, Last Payment, Status, Billing Cycle).

**Buy Software Licenses.** Quantity entry with a server-computed price breakdown (unit price, subtotal, tax, discount, total); client-submitted amounts are not trusted. Copy should indicate that billing begins immediately upon purchase, independent of subsequent allocation or delivery.

**Customers / Allocations.** Per-customer counts (allocated, registered, active, suspended) with actions for allocation, bundle-delivery registration, activation, suspension, reactivation, release, and cancellation. The allocation dialog displays live available capacity and rejects over-allocation with the message: *"Insufficient available screen licenses. Available: X. Requested: Y. Please purchase additional licenses."* The registration action is presented as recording a bundle delivered to the customer, not as the customer registering their own device.

**Billing.** Current invoice (billed quantity, billing cycle, amount due) with a payment action, plus invoice history.

**Admin.** `AdminResellerDashboard.jsx` provides a cross-partner summary (purchased/allocated/active/available totals, current-cycle revenue, pending/overdue/failed payments, suspended partners). `AdminPartnerDetail.jsx` gains a Reseller-specific tab. `AdminResellerConfig.jsx` allows per-partner configuration of pricing mode (with only the relevant input shown for the selected mode) and billing cycle.

## B11. Audit Log Entries

Recorded via the existing `logActivity` utility:
```
LICENSE_PURCHASED, LICENSE_ALLOCATED, LICENSE_RELEASED, LICENSE_ADJUSTED
SCREEN_REGISTERED, SCREEN_ACTIVATED, SCREEN_SUSPENDED, SCREEN_REACTIVATED, LICENSE_CANCELLED
RESELLER_CUSTOMER_CREATED, RESELLER_CUSTOMER_CANCELLED
RESELLER_INVOICE_GENERATED, RESELLER_PAYMENT_SUCCESS, RESELLER_PAYMENT_FAILED
RESELLER_PARTNER_SUSPENDED, RESELLER_PARTNER_REACTIVATED
RESELLER_AGREEMENT_EXPIRING
```

## B12. Edge Cases and Open Decisions

| Scenario | Expected behavior |
|---|---|
| Duplicate webhook delivery | Atomic status claim prevents a duplicate purchase or payment application. |
| Concurrent allocation requests for the same remaining capacity | Prevented by the database-level guard, not by a preceding check. |
| Over-allocation attempt | Rejected prior to any write. |
| Mid-cycle price or mode change | Existing orders and invoices remain unaffected (values are snapshotted). |
| Customer suspended | Allocation is retained; billing to SPOTX is unaffected either way. |
| Customer cancelled | Allocation released; purchased-license count and billing are unaffected. |
| Unpaid SPOTX invoice | Inventory is untouched; only new allocation, registration, activation, and purchase actions are blocked pending resolution. |
| Duplicate billing run | Prevented by a unique constraint on `partnerId + billingPeriodStart + billingPeriodEnd`. |
| Mid-cycle purchase on a quarterly/yearly plan | New licenses are prorated for the remainder of the current cycle and billed in full thereafter (Section B14a). |

**Resolved decisions:**

1. **Billing automation.** Manual for the initial release — an admin-triggered "Run Reseller Billing" action, not a scheduled job. Automatic scheduling (`node-cron`) is deferred to a future phase once the manual flow has proven correct in production. The manual action still uses the same idempotent billing service described in Section B8, so switching to a scheduler later is a matter of calling that service from a cron trigger instead of a button — no change to the underlying logic.
2. **Bulk-tier pricing basis.** Both per-order and cumulative-purchase-history bases are supported, selectable per partner. `ResellerPricingPlan.bulkTiers` gains a sibling field, `bulkTierBasis: "per_order" | "cumulative"`, set by superadmin per partner alongside the tier thresholds. Recommended default when a partner has no stated preference: `per_order`, since it is simpler to reason about and avoids retroactive rate changes on existing inventory as cumulative totals cross thresholds.
3. **Renegotiation of `billingCycle` and `wholesaleDiscountPercent`.** Both are admin-editable at any time. Recommended (and adopted) rule: changes apply **prospectively only** — from the next billing cycle or next purchase order onward. Already-generated invoices and already-completed purchase orders keep the values that were snapshotted onto them at the time. This avoids reopening closed financial records and matches how `effectivePricePerScreen` is already snapshotted per transaction (Section B5).
4. **Automatic volume-based discount scaling.** No. A partner's `wholesaleDiscountPercent` does not increase automatically as they buy more — it is a fixed value set per the specific terms of that partner's agreement, changed only when an admin updates it (per item 3). Volume-based pricing structure, where wanted, is expressed through `bulkTiers` (item 2), not through automatic escalation of the negotiated discount itself.
5. **Partner-initiated pricing-mode switching.** No. A partner cannot change their own `pricingMode`, `wholesaleDiscountPercent`, `fixedPricePerScreen`, or `billingCycle` from the partner panel under any circumstance. These are superadmin-only fields, set and changed exclusively via `adminResellerConfigController.js`.
6. **GST/bill submission from the Reseller.** The Reseller submits their GST and business-verification documents once, during partner KYC/verification (the existing `PartnerDocument` flow) — not at the time of each purchase or invoice payment. No additional bill is required from the Reseller before they pay a `ResellerInvoice`; SPOTX's own invoice is the only document involved in the recurring payment flow.

7. **Scope of suspension enforcement.** Resolved as panel-access restriction only, permanently — not a temporary starting point. This system has no integration with, or link to, the Reseller's physical hardware or CMS (confirmed above: no serial numbers, no device identifiers, nothing tracked about the physical screen at all). With no connection point into that layer, there is no mechanism by which SPOTX could reach in and disable an already-activated screen, and none should be built or assumed. A payment-suspended Reseller therefore loses the ability to allocate licenses, register new bundles, activate new screens, or make new purchases; whatever is already running on already-delivered screens continues to run, since enforcing otherwise is outside what this system can or should touch.

**Resolved, not open:** hardware-side data (serial numbers, make/model, warranty, or any other identifying detail) will not be captured under any circumstance. The physical device is entirely the Reseller's own procurement — `Screen.soldAsResellerBundle` remains a plain boolean with no further hardware fields, now or later.

## B13. Non-Goals

- No `PartnerCommission`, `CommissionRule`, `PartnerSettlement`, or `PartnerSettlementBill` is created for a Reseller partner under any circumstance.
- No visibility into, or tracking of, the customer-to-Reseller payment relationship, anywhere on the platform. No resale-price field on any model, no input or display of that price on any partner-panel or admin-panel screen, no margin or profit calculation, no report, export, or API response that surfaces it. This applies across the entire system, not only to the billing calculation in Section B14.
- No tracking of hardware cost, serial numbers, make/model, or warranty information, under any circumstance. The physical screen is entirely the Reseller's own procurement and remains fully outside this system.
- No change to the `partnerType` enum or the value `reseller`.
- No billing calculation based on active, registered, or allocated license counts — purchased licenses only.

## B14. Billing Formulas

```
Available Licenses = Purchased Licenses − Allocated Licenses

Effective Price Per Screen =
    if pricingMode = "discount_percent":
        Standard Price Per Screen × (1 − Wholesale Discount % / 100)
    if pricingMode = "fixed_price":
        Fixed Price Per Screen

SPOTX Bill (per cycle) =
    Total Purchased Licenses
    × Effective Price Per Screen
    × Cycle Multiplier (1 monthly, 3 quarterly, 12 yearly)
    + Tax
```

**Example — discount-percent mode.** Standard rate ₹100/screen; agreed discount 20%; effective rate ₹80/screen. On a monthly cycle with 600 purchased licenses: `600 × ₹80 = ₹48,000` plus GST, versus ₹60,000 plus GST at the undiscounted rate.

**Example — fixed-price mode.** A partner negotiated a flat rate of ₹300/screen, independent of the standard rate. On a monthly cycle with 200 purchased licenses: `200 × ₹300 = ₹60,000` plus GST. The standard rate has no bearing on this calculation.

Allocation, delivery, activation, and suspension status have no effect on this calculation. A Reseller is billed for what it has purchased, at its agreed rate, on its agreed cycle.

### B14a. Mid-Cycle Purchase Proration

Licenses purchased partway through a billing cycle are prorated for the remainder of that cycle when `prorationRule: daily_proration` is set, and billed in full from the following cycle onward:

```
Example (monthly cycle; 100 additional licenses purchased 10 days into a 30-day cycle):
  Prorated charge this cycle = ₹100 × 100 × (20 remaining days / 30) = ₹6,667
  From the next cycle: the full 100 licenses are included in the base purchased count.
```
Where `prorationRule: none`, newly purchased licenses are counted only from the following full cycle, with no partial charge for the elapsed period.

---

## B15. Additional Items — Resolutions and Remaining Discussion

**Resolved:**

1. **Hardware return/reissue process.** Out of scope for this system entirely. Whether the Reseller physically recovers a screen from a cancelled customer for reuse elsewhere is the Reseller's own operational concern, not something SPOTX tracks, decides, or needs visibility into. `Screen` records may be un-registered and reassigned in the data model (the license portion), but nothing about the physical hardware's fate is recorded or enforced by this system.
2. **Authority over customer suspension.** Confirmed as fully Reseller-discretionary, with one constraint built into the intended use case: a Reseller may suspend one of its own customers specifically when that customer stops paying the Reseller. SPOTX has no visibility into or approval role over this action — it is a normal operational action available to the Reseller, not a SPOTX-mediated one.
3. **End-of-agreement handling.** When a Reseller's agreement approaches or passes its end date, the system notifies SPOTX (not the partner) — an admin-facing alert, not an automated partner-facing action. A SPOTX admin then contacts the Reseller directly, and the outcome of that conversation (renew, upgrade, or suspend) is applied manually by the admin through the existing partner-status controls. No automatic suspension or reclassification happens without that human step. This requires an `agreementEndDate` field on `ResellerBillingConfig` (or a dedicated `ResellerAgreement` record) and a corresponding admin dashboard alert/audit-log entry (e.g. `RESELLER_AGREEMENT_EXPIRING`) generated ahead of that date.

4. **Invoice document format.** No separate downloadable/GST-compliant PDF is required. The Reseller's GST and business-verification documents are submitted once, at KYC/partner verification (existing `PartnerDocument` flow) — the same resolution as Section B12 item 6. The in-panel invoice history table is sufficient for the recurring `ResellerInvoice` record itself; no additional document generation is needed for the initial release.
5. **Proactive notifications.** Confirmed — implement both. Reused via the existing `PartnerNotification` mechanism (already used elsewhere in the panel), triggered by two events: an upcoming invoice due date, and available-license inventory dropping below a threshold. See item 6 below for the specific timing adopted.
6. **Default values for retry and grace-period settings.** Adopted, following the pattern common to standard recurring-billing/dunning practice (the same shape used by Razorpay, Stripe, and most SaaS billing systems):
   ```
   dueDays: 7                          — invoice due 7 days after generation ("Net 7")
   lowInventoryNotificationThreshold: 10% of totalPurchasedLicenses (or a configurable flat number)
   dueDateReminder: sent 3 days before dueDate
   retrySchedule: [{ dayOffset: 1 }, { dayOffset: 3 }, { dayOffset: 5 }]   — after the due date, if unpaid
   gracePeriodDays: 3                  — after the final retry, before restriction takes effect
   ```
   Total time from due date to restriction under these defaults: 8 days (5 days of retries + 3 grace days). These are configurable per partner via `ResellerBillingConfig`, not hard-coded — the values above are the recommended system defaults, not a fixed rule.
