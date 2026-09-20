const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");
const { PartnerDocument } = require("../models/Index");
const ResellerBillingConfig = require("../models/ResellerBillingConfig");
const ResellerPricingPlan = require("../models/ResellerPricingPlan");

const UPLOAD_ROOT = path.join(__dirname, "..", "uploads", "partners");
const LOGO_PATH = path.join(__dirname, "..", "assets", "spotx-logo.png");
const LOGO_ASPECT = 789 / 307; // actual pixel dimensions of assets/spotx-logo.png

const BRAND_RED = "#EC2027";
const BRAND_BLACK = "#121212";
const CHARCOAL = "#2D2D2D";
const MUTED = "#666666";
const FAINT = "#999999";

// Every body section below is editable per partner (see Partner.agreementTerms
// in models/Partner.js) — admins can negotiate different terms with
// different resellers. `defaultText` is what renders when the partner has
// no override for that section; sections are otherwise rendered in this
// order with automatic numbering.
const AGREEMENT_SECTIONS = [
  {
    key: "background",
    title: "Background",
    defaultText: () =>
      "SPOTX operates an enterprise-grade digital signage platform that enables businesses to manage content, monitor " +
      "screens, schedule campaigns, and track performance across their screen network from a single dashboard. The " +
      "Partner wishes to participate in the SPOTX Partner Program in the capacity described below, and SPOTX is " +
      "willing to grant such participation on the terms of this Agreement."
  },
  {
    key: "scope",
    title: "Scope of Partnership",
    defaultText: () =>
      "The Partner will purchase SPOTX screen software licenses in bulk, at the pricing (a discount off SPOTX's " +
      "standard rate, or a flat negotiated rate) set out in this agreement, and will be billed on the agreed billing " +
      "cycle for its total purchased licenses regardless of usage. The Partner will resell those licenses bundled " +
      "with its own screen hardware to its own end-customers, under its own commercial terms; SPOTX has no " +
      "involvement in, or visibility into, that resale transaction."
  },
  {
    key: "onboarding",
    title: "Onboarding & Verification",
    defaultText: () =>
      "This Agreement, and the Partner's ability to use the referral, sales, and payout features of the SPOTX Partner " +
      "Panel, is conditioned on SPOTX's verification of the Partner's KYC documents and bank account details. The " +
      "Partner represents and warrants that all information and documents submitted for this purpose are true, " +
      "accurate, and not misleading. SPOTX reserves the right to suspend or reject the Partner's account if this is " +
      "found not to be the case."
  },
  {
    key: "payment",
    title: "Purchase & Payment Terms",
    defaultText: () =>
      "The Partner purchases SPOTX screen software licenses in bulk, at the pricing and billing cycle set out in the " +
      "Partner's Reseller Pricing Plan (configured for the Partner in the SPOTX Partner Panel), and is invoiced for " +
      "its total purchased licenses on that cycle regardless of usage. Payment of each invoice is due per the terms " +
      "stated on that invoice. SPOTX reserves the right to suspend the Partner's license allocation for non-payment " +
      "of an overdue invoice."
  },
  {
    key: "termTermination",
    title: "Term & Termination",
    defaultText: () =>
      "This Agreement commences on the Effective Date and continues until terminated by either Party. Either Party " +
      "may terminate this Agreement for convenience upon thirty (30) days' prior written notice to the other Party. " +
      "SPOTX may suspend or terminate this Agreement immediately upon written notice if the Partner breaches this " +
      "Agreement, provides false information, or engages in fraudulent or unlawful conduct. Termination does not " +
      "relieve the Partner of any invoiced amount already due under this Agreement."
  },
  {
    key: "confidentiality",
    title: "Confidentiality",
    defaultText: () =>
      "Each Party agrees to keep confidential all non-public business, technical, financial, and customer information " +
      "disclosed by the other Party in connection with this Agreement, and to use such information solely to perform " +
      "its obligations under this Agreement. This obligation survives termination of this Agreement."
  },
  {
    key: "intellectualProperty",
    title: "Intellectual Property",
    defaultText: () =>
      "SPOTX retains all right, title, and interest in and to its platform, software, trademarks, and brand assets. " +
      "The Partner is granted a limited, non-exclusive, non-transferable right to use SPOTX's name and marks solely " +
      "for marketing SPOTX to prospective customers under this Agreement, in accordance with SPOTX's brand " +
      "guidelines, and such right terminates automatically upon termination of this Agreement."
  },
  {
    key: "dataProtection",
    title: "Data Protection & Compliance",
    defaultText: () =>
      "Each Party will comply with applicable law in performing its obligations under this Agreement, including " +
      "applicable data protection law when handling personal information of prospective or registered customers. " +
      "The Partner will not misrepresent SPOTX's products, pricing, or terms to any prospective customer."
  },
  {
    key: "liability",
    title: "Limitation of Liability",
    defaultText: () =>
      "Neither Party will be liable to the other for any indirect, incidental, or consequential damages arising out " +
      "of this Agreement. Each Party's total liability under this Agreement is limited to the amounts actually paid " +
      "or payable by the Partner to SPOTX in the twelve (12) months preceding the event giving rise to the claim."
  },
  {
    key: "governingLaw",
    title: "Governing Law & Dispute Resolution",
    defaultText: () =>
      "This Agreement is governed by the laws of India. The Parties will first attempt to resolve any dispute arising " +
      "out of this Agreement through good-faith discussion, failing which the dispute will be subject to the " +
      "exclusive jurisdiction of the competent courts in India."
  },
  {
    key: "notices",
    title: "Notices",
    defaultText: (partner) =>
      `Notices under this Agreement will be sent to the Partner at ${partner.primaryContact.email} and will be deemed ` +
      "delivered when sent. SPOTX may also notify the Partner in-app via the SPOTX Partner Panel."
  },
  {
    key: "entireAgreement",
    title: "Entire Agreement",
    defaultText: () =>
      "This Agreement, generated by the SPOTX Partner Panel upon verification of the Partner's account, reflects the " +
      "commercial terms configured for the Partner as of the Effective Date and constitutes the entire understanding " +
      "between the Parties regarding the subject matter herein. Any amendment to the pricing or scope described " +
      "above will be reflected in a reissued version of this Agreement."
  }
];

// Effective text for a section: the partner's saved override if they have
// one, otherwise the standard template default.
const resolveSectionText = (partner, section) => {
  const override = partner.agreementTerms?.[section.key];
  return typeof override === "string" && override.trim() ? override : section.defaultText(partner);
};

const ENTITY_TYPE_LABEL = {
  proprietorship: "Sole Proprietorship",
  partnership: "Partnership Firm",
  llp: "Limited Liability Partnership",
  private_limited: "Private Limited Company",
  public_limited: "Public Limited Company",
  individual: "Individual",
  other: "Other Business Entity"
};

// Builds the [label, value] rows for the "Current Pricing & Billing Terms"
// section from the partner's live ResellerPricingPlan / ResellerBillingConfig
// — the actual numbers currently in effect, not prose describing where to
// find them. Either doc may be absent (partner isn't a reseller, or the
// config was never created) — rows are simply omitted in that case.
const buildPricingTermsRows = (plan, config) => {
  const rows = [];

  if (plan) {
    rows.push(["Pricing Mode", plan.pricingMode === "fixed_price" ? "Fixed Price" : "Discount off Standard Price"]);
    rows.push(["Standard List Price per Screen", `Rs. ${plan.standardPricePerScreen}`]);
    if (plan.pricingMode === "fixed_price") {
      rows.push(["Fixed Price per Screen", `Rs. ${plan.fixedPricePerScreen || 0}`]);
    } else {
      rows.push(["Wholesale Discount", `${plan.wholesaleDiscountPercent || 0}%`]);
    }
    rows.push(["Effective Price per Screen", `Rs. ${plan.effectivePricePerScreen}`]);
    rows.push(["Minimum Purchase Quantity", `${plan.minPurchaseQty} screen(s) per order`]);
    rows.push(["Applicable Tax Rate", `${plan.taxRatePercent}%`]);
    if (plan.pricingMode === "discount_percent" && Array.isArray(plan.bulkTiers) && plan.bulkTiers.length) {
      rows.push([
        "Bulk Pricing Tiers",
        plan.bulkTiers.map((t) => `${t.minQty}+ units @ Rs. ${t.pricePerScreen}/screen`).join("; ")
      ]);
      rows.push(["Bulk Tier Basis", plan.bulkTierBasis === "cumulative" ? "Cumulative purchased-to-date" : "Per order"]);
    }
  }

  if (config) {
    rows.push(["Billing Metric", "Total purchased licenses (regardless of usage)"]);
    rows.push(["Billing Cycle", (config.billingCycle || "monthly").replace(/^./, (c) => c.toUpperCase())]);
    rows.push(["Billing Start Rule", config.billingStartRule === "fixed_day_of_month" ? "Fixed day of month" : "On first purchase"]);
    rows.push([
      "Mid-Cycle Purchase Proration",
      config.prorationRule === "none" ? "Deferred to next billing cycle" : "Billed immediately at full cycle rate"
    ]);
    rows.push(["Invoice Payment Due", `Net ${config.dueDays} day(s) from invoice date`]);
    rows.push(["Due-Date Reminder", `${config.dueDateReminderDaysBefore} day(s) before due date`]);
    rows.push(["Grace Period Before Restriction", `${config.gracePeriodDays} day(s) after due date`]);
    if (config.agreementEndDate) {
      rows.push([
        "Agreement End Date",
        new Date(config.agreementEndDate).toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })
      ]);
    }
    if (config.prepayment?.status && config.prepayment.status !== "not_done") {
      rows.push([
        "One-Time Prepayment",
        `Rs. ${config.prepayment.amount || 0} — ${config.prepayment.status === "done" ? "Paid" : "Awaiting payment"}`
      ]);
    }
  }

  return rows;
};

const formatAddress = (address) => {
  if (!address) return "[Address not on file]";
  const parts = [address.addressLine1, address.addressLine2, address.city, address.state, address.pincode, address.country].filter(Boolean);
  return parts.length ? parts.join(", ") : "[Address not on file]";
};

/**
 * Renders the full multi-section partner agreement PDF to disk and returns
 * file metadata in the same shape partnerDocumentController.uploadDocument
 * produces, so the caller can save it as a normal PartnerDocument row.
 */
const generatePartnerAgreementFile = async (partner) => {
  const partnerDir = path.join(UPLOAD_ROOT, String(partner._id));
  fs.mkdirSync(partnerDir, { recursive: true });

  const filename = `partner-agreement-${Date.now()}.pdf`;
  const filePath = path.join(partnerDir, filename);

  const effectiveDate = new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" });
  const agreementRef = `SPX-AGR-${partner.partnerCode}`;
  const partnerTypeLabel = partner.partnerType.charAt(0).toUpperCase() + partner.partnerType.slice(1);

  // Live pricing/billing terms, pulled fresh on every generation so the PDF
  // always reflects what's actually configured for this partner right now.
  const [pricingPlan, billingConfig] = await Promise.all([
    ResellerPricingPlan.findOne({ partnerId: partner._id }),
    ResellerBillingConfig.findOne({ partnerId: partner._id })
  ]);
  const pricingTermsRows = buildPricingTermsRows(pricingPlan, billingConfig);

  await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: "A4", margin: 56, bufferPages: true });
    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    let sectionNumber = 0;
    const heading = (title) => {
      sectionNumber += 1;
      doc.moveDown(0.9);
      doc.fontSize(12).fillColor(BRAND_BLACK).font("Helvetica-Bold").text(`${sectionNumber}. ${title}`);
      doc.moveDown(0.3);
      doc.font("Helvetica");
    };
    const body = (text) => {
      doc.fontSize(10).fillColor(CHARCOAL).text(text, { align: "justify", lineGap: 3 });
    };
    const bullet = (text) => {
      doc.fontSize(10).fillColor(CHARCOAL).text(`•  ${text}`, { align: "left", lineGap: 3, indent: 10 });
    };

    // ---- Letterhead ----
    // The source logo's "Spot" wordmark is white-on-transparent — invisible
    // on a white page unless backed by a dark badge, same fix Logo.jsx uses
    // on the web (a light background would swallow it otherwise).
    if (fs.existsSync(LOGO_PATH)) {
      const logoHeight = 28;
      const logoWidth = logoHeight * LOGO_ASPECT;
      const padding = 12;
      const badgeX = 56;
      const badgeY = doc.y;

      doc.roundedRect(badgeX, badgeY, logoWidth + padding * 2, logoHeight + padding * 2, 6).fill(BRAND_BLACK);
      doc.image(LOGO_PATH, badgeX + padding, badgeY + padding, { height: logoHeight, width: logoWidth });
      doc.y = badgeY + logoHeight + padding * 2 + 10;
    } else {
      doc.fontSize(22).fillColor(BRAND_RED).font("Helvetica-Bold").text("SPOT", { continued: true });
      doc.fillColor(BRAND_BLACK).text("X");
      doc.font("Helvetica");
      doc.moveDown(0.2);
    }
    doc.fontSize(16).fillColor(BRAND_BLACK).font("Helvetica-Bold").text("Partner Agreement");
    doc.font("Helvetica");
    doc.moveDown(0.15);
    doc.fontSize(9).fillColor(MUTED).text(`Reference: ${agreementRef}    |    Effective Date: ${effectiveDate}`);
    doc.moveDown(0.6);
    doc.strokeColor("#E5E5E5").lineWidth(1).moveTo(56, doc.y).lineTo(539, doc.y).stroke();

    // ---- Preamble ----
    doc.moveDown(0.8);
    body(
      `This Partner Agreement ("Agreement") is entered into as of ${effectiveDate}, by and between SPOTX ("SPOTX" or the ` +
      `"Company"), an enterprise digital signage platform operator [Registered Office Address to be inserted], and the ` +
      `partner identified below ("Partner"). SPOTX and the Partner are individually a "Party" and together the "Parties".`
    );

    // ---- Parties ----
    heading("Parties");
    doc.fontSize(10).fillColor(BRAND_BLACK).font("Helvetica-Bold").text("The Partner");
    doc.font("Helvetica").fillColor(CHARCOAL);
    doc.text(`Business / Trade Name: ${partner.legalEntity.businessName}`);
    if (partner.legalEntity.legalName) doc.text(`Registered Legal Name: ${partner.legalEntity.legalName}`);
    doc.text(`Entity Type: ${ENTITY_TYPE_LABEL[partner.legalEntity.entityType] || "Not specified"}`);
    doc.text(`Partner Code: ${partner.partnerCode}`);
    doc.text(`Partner Category: ${partnerTypeLabel} Partner`);
    doc.text(`Registered / Business Address: ${formatAddress(partner.address)}`);
    doc.moveDown(0.4);
    doc.fontSize(10).fillColor(BRAND_BLACK).font("Helvetica-Bold").text("Authorized Representative");
    doc.font("Helvetica").fillColor(CHARCOAL);
    doc.text(`Name: ${partner.primaryContact.name}${partner.primaryContact.designation ? ` (${partner.primaryContact.designation})` : ""}`);
    doc.text(`Email: ${partner.primaryContact.email}`);
    if (partner.primaryContact.phone) doc.text(`Phone: ${partner.primaryContact.phone}`);

    // ---- Body sections ----
    // Each of these can be overridden per partner (see AGREEMENT_SECTIONS /
    // Partner.agreementTerms above) — an admin negotiating different terms
    // with a specific reseller edits that partner's copy of this text
    // before the agreement is generated.
    for (const section of AGREEMENT_SECTIONS) {
      heading(section.title);
      body(resolveSectionText(partner, section));

      // Immediately after the "Purchase & Payment Terms" prose, lay out the
      // Partner's actual current pricing/billing numbers as a table — not
      // just a pointer to "the Panel".
      if (section.key === "payment" && pricingTermsRows.length) {
        doc.moveDown(0.5);
        const labelX = 56;
        const valueX = 260;
        const rowWidth = 483;
        for (const [label, value] of pricingTermsRows) {
          const rowY = doc.y;
          doc.fontSize(9.5).font("Helvetica-Bold").fillColor(BRAND_BLACK).text(label, labelX, rowY, { width: 195 });
          const afterLabelY = doc.y;
          doc.font("Helvetica").fillColor(CHARCOAL).text(value, valueX, rowY, { width: labelX + rowWidth - valueX });
          doc.y = Math.max(afterLabelY, doc.y) + 3;
        }
        doc.moveDown(0.3);
        doc.fontSize(8).fillColor(FAINT).text(
          "These figures reflect the Partner's pricing plan and billing configuration as of the Effective Date above, and " +
          "will be reflected in a reissued Agreement if subsequently changed.",
          labelX,
          doc.y,
          { width: rowWidth, align: "justify" }
        );
        doc.moveDown(0.4);
      }
    }

    // ---- Acknowledgement / signature block ----
    doc.moveDown(1.2);
    doc.strokeColor("#E5E5E5").lineWidth(1).moveTo(56, doc.y).lineTo(539, doc.y).stroke();
    doc.moveDown(0.6);
    doc.fontSize(9).fillColor(FAINT).text(
      "This document is generated automatically by the SPOTX Partner Panel upon successful verification of the " +
      "Partner's KYC documents and bank account, and stands as the record of agreed commercial terms between the " +
      "Parties from that point forward. Where a separately signed master agreement exists between the Parties, that " +
      "document takes precedence over this one.",
      { align: "justify", lineGap: 2 }
    );

    doc.moveDown(1.2);
    const colY = doc.y;
    doc.fontSize(9).fillColor(BRAND_BLACK).font("Helvetica-Bold").text("For SPOTX", 56, colY);
    doc.font("Helvetica").fillColor(CHARCOAL).fontSize(9);
    doc.text("Authorized Signatory", 56, colY + 14);
    doc.text(`Verified on: ${effectiveDate}`, 56, colY + 28);

    doc.fontSize(9).fillColor(BRAND_BLACK).font("Helvetica-Bold").text("For the Partner", 300, colY);
    doc.font("Helvetica").fillColor(CHARCOAL).fontSize(9);
    doc.text(partner.primaryContact.name, 300, colY + 14);
    doc.text(partner.legalEntity.businessName, 300, colY + 28);

    // ---- Footer: page numbers on every page ----
    // Writing inside the bottom margin makes pdfkit think the content
    // overflows and silently appends a new blank page to fit it — zeroing
    // the margin for this one write avoids that.
    const pageRange = doc.bufferedPageRange();
    for (let i = 0; i < pageRange.count; i += 1) {
      doc.switchToPage(i);
      const bottomMargin = doc.page.margins.bottom;
      doc.page.margins.bottom = 0;
      doc.fontSize(8).fillColor(FAINT).text(
        `${agreementRef}  ·  Page ${i + 1} of ${pageRange.count}`,
        56,
        doc.page.height - 40,
        { width: doc.page.width - 112, align: "center" }
      );
      doc.page.margins.bottom = bottomMargin;
    }

    doc.end();
    stream.on("finish", resolve);
    stream.on("error", reject);
  });

  const { size } = fs.statSync(filePath);

  return {
    objectKey: path.join(String(partner._id), filename),
    originalName: "SPOTX Partner Agreement.pdf",
    mimeType: "application/pdf",
    size
  };
};

/**
 * Generates the agreement and files it as a normal PartnerDocument, already
 * verified (SPOTX generated it, there's nothing for a reviewer to approve).
 * Idempotent — a partner never gets a second one.
 */
const attachPartnerAgreement = async (partner, adminUserId) => {
  const existing = await PartnerDocument.findOne({ partnerId: partner._id, documentType: "partner_agreement" });
  if (existing) return existing;

  const file = await generatePartnerAgreementFile(partner);

  return PartnerDocument.create({
    partnerId: partner._id,
    documentType: "partner_agreement",
    file,
    verification: {
      status: "verified",
      verifiedBy: adminUserId,
      verifiedAt: new Date()
    }
  });
};

/**
 * Regenerates the Partner's agreement PDF and REPLACES the existing
 * "partner_agreement" PartnerDocument row in place (same row, new file) —
 * unlike attachPartnerAgreement this is not idempotent-skip; it always
 * re-renders. Used when an admin edits pricing/billing config that's baked
 * into the PDF, so the document on file never goes stale. Falls back to
 * creating a fresh row if the partner somehow doesn't have one yet.
 * Deletes the old PDF from disk once the new one is safely written.
 */
const regeneratePartnerAgreement = async (partner, adminUserId) => {
  const existing = await PartnerDocument.findOne({ partnerId: partner._id, documentType: "partner_agreement" });
  const previousObjectKey = existing?.file?.objectKey;

  const file = await generatePartnerAgreementFile(partner);

  let saved;
  if (existing) {
    existing.file = file;
    existing.verification = {
      status: "verified",
      verifiedBy: adminUserId,
      verifiedAt: new Date()
    };
    saved = await existing.save();
  } else {
    saved = await PartnerDocument.create({
      partnerId: partner._id,
      documentType: "partner_agreement",
      file,
      verification: {
        status: "verified",
        verifiedBy: adminUserId,
        verifiedAt: new Date()
      }
    });
  }

  if (previousObjectKey && previousObjectKey !== file.objectKey) {
    const previousPath = path.join(UPLOAD_ROOT, previousObjectKey);
    fs.unlink(previousPath, (err) => {
      if (err && err.code !== "ENOENT") {
        console.error("Failed to delete previous partner agreement file:", err.message);
      }
    });
  }

  return saved;
};

module.exports = {
  generatePartnerAgreementFile,
  attachPartnerAgreement,
  regeneratePartnerAgreement,
  AGREEMENT_SECTIONS,
  resolveSectionText
};
