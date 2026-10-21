# Financial Portal — Decisions

## §0 Reconciliations

### Money Representation
**Decision: Keep Prisma `Decimal(12,2)` for all money fields.**
- Existing Invoice/Payment/FeeStructure/PaymentReceipt models already use Decimal
- No migration needed, existing data intact
- Guardian portal keeps working without changes
- Decimal is the correct choice for financial data — precise, no floating-point drift
- The spec's "integer minor units" claim was factually incorrect about this codebase

### Enum Values
**Decision: Keep existing enum values.**
- `PARTIALLY_PAID` (not `PARTIAL`) — more descriptive, no migration needed
- `PENDING`/`COMPLETED`/`FAILED`/`REFUNDED` for PaymentStatus — existing values kept
- New statuses (RECORDED/VERIFIED/REVERSED) added as new enum values alongside existing ones
- `DRAFT`/`UNPAID`/`PARTIALLY_PAID`/`PAID`/`OVERDUE`/`CANCELLED` for InvoiceStatus — existing values kept

### Approval Workflow
**Decision: Fixed hard-coded approval gates per entity type.**
- PENDING → APPROVED/REJECTED → PROCESSED workflow
- No configurable workflow engine (spec defaults to this)
- Shared approval component reused across Discounts/Scholarships/Waivers/Expenses/Refunds

### Architecture
**Decision: Route group inside the existing Next.js app.**
- Consistent with student/guardian portals
- Shares auth/proxy/shell infrastructure
- Simpler deployment and maintenance

## New Roles
- `FINANCE_ADMIN` — all financial modules and configuration
- `CASHIER` — record payments, issue receipts, daily cash closing
- `FINANCE_APPROVER` — approve discounts, expenses, refunds, reversals
- `AUDITOR` — read-only: financial records, reports, audit logs

## Granular Permissions
Action-level permissions checked per-action, not just per-screen:
- `finance:invoice:view`, `finance:invoice:create`, `finance:invoice:edit`
- `finance:payment:view`, `finance:payment:create`, `finance:payment:verify`, `finance:payment:reverse`
- `finance:receipt:view`, `finance:receipt:generate`, `finance:receipt:reprint`
- `finance:discount:view`, `finance:discount:create`, `finance:discount:approve`
- `finance:expense:view`, `finance:expense:create`, `finance:expense:approve`
- `finance:refund:view`, `finance:refund:create`, `finance:refund:approve`
- `finance:account:view`, `finance:account:create`, `finance:account:edit`
- `finance:report:view`, `finance:report:export`
- `finance:settings:configure`
- `finance:audit:view`

## Traceability
- No hard deletes on posted financial records — reversals/adjustments only
- FinancialAuditLog interceptor on every financial controller
- Payment allocation, invoice balance recalculation, and refund processing run inside a single Prisma $transaction

## Socket.io
- Emit on FeeInvoice/FeePayment status changes
- Emit on new items entering approval queues
- Room-scope by tenant: `tenant:{tenantId}:finance`

## Payroll & Fee/Sibling-Discount (reconciliation addendum)

### Money & identifiers
- Reaffirmed: `Decimal(12,2)` money (the payroll spec again repeated the
  factually-incorrect "integer minor units" claim — rejected, as in §0).
- New models use `uuid` + `tenantId` + `@@unique([id, tenantId])`, not cuid.

### Payroll
- `Position` is a pay-grade entity distinct from `Role` (there is no
  `SystemRole` model; `SystemRole` is a TS type over `Role` slugs).
- One active `StaffPositionAssignment` per staff; many staff per position;
  changing position/salary closes the old row (history preserved) rather than
  mutating in place. Effective salary = `salaryOverride ?? baseSalary`.
- Deduction rules are **global**; single `valueType` (PERCENTAGE|FIXED_AMOUNT)
  per rule; percent+flat is achieved by applying multiple rules. A nullable
  `appliesToPositionId` is reserved for future per-position variants but not
  used now.
- Payout `DRAFT → APPROVED → PAID`; `FinancialAuditLog` on every transition;
  never edited/deleted once `PAID` (corrections are new offsetting payouts).
- On `PAID`: writes a `FinancialTransaction` DEBIT, links `FinancialPeriod`,
  assigns `payslipNo`; payslip rendered with `pdfkit` (same lib as result slips).
- Payroll is a new **top-level** sidebar item (`Banknote`, between
  "Cash & Accounts" and "Financial Reports").

### Fees & discounts
- `FeeStructure` gains `educationLevel?` + `grade?` (the spec claimed these
  already existed — they did not; `grade` is enum `SchoolClassGrade`, not String).
- Sibling discounts use **manual** `SiblingGroup` membership, not auto-derivation
  from `StudentGuardian`, and route through the existing approval queue
  (overrides the spec's auto-derive/auto-approve default).
- `FamilyConditionDiscount` is a separate, sensitive path: new backend
  `PermissionsGuard` + `@RequirePermission('finance:family-condition:view')`
  (roles allowed: FINANCE_ADMIN, FINANCE_APPROVER, and ADMIN `*`). `reason` is
  stripped from every non-privileged surface, shown as a generic "Fee Adjustment"
  line on invoices/statements, excluded from exports by default, and its reads
  are written to `FinancialAuditLog` (closes the mutations-only read-audit gap).
- Reuse `Payment`/`PaymentReceipt`/`PaymentAllocation` for recording fee
  payments (there is no `FeePayment` model); this work only wires discounts into
  the existing invoice-generation flow.

### Shared component
- §0's "shared approval component" does not yet exist (each page duplicated its
  own tab). Extract a reusable `ApprovalQueue` component and use it for the new
  payroll / sibling queues.

## Discount application (invoice generation)

- **Sibling → StudentDiscount sync.** Sibling eligibility is *not* applied to
  invoices directly. `POST /finance/sibling-discounts/sync` reads active
  `SiblingGroup`s + active `SiblingDiscountRule`s, composes the winning rule per
  group (see below), and creates **PENDING** `StudentDiscount` rows that flow
  through the existing discount approval queue. Re-running the
  sync is idempotent: a student that already has a PENDING/APPROVED discount of
  that type is skipped.
- **Composition rule** (`sibling-discount.helper.ts`, 12 unit tests). `siblingCount`
  is the number of students in the group. A rule matches when its `relationType`
  is identical to the group's, or when it is the universal `SISTERS_AND_BROTHERS`
  (a gender-specific rule never applies to a different or mixed group). Among
  eligible rules (active, matching, `minSiblingCount <= siblingCount`) the most
  specific tier wins (highest `minSiblingCount`); ties break on higher `value`,
  then smaller id for determinism.
- **Value type encoding.** `StudentDiscount` has no `valueType` column and we did
  not add one (that would be a schema change beyond the approved set). The type
  is carried by `DiscountType.kind`: the sync find-or-creates
  `Sibling Discount (Percentage)` / `kind='percentage'` and
  `Sibling Discount (Fixed)` / `kind='fixed'`. `snapshotValue` freezes the amount;
  `relationApplied` stores the relation.
- **Application at generation.** Only `bulkGenerate` (the real fee-invoice path)
  applies discounts; ad-hoc `createInvoice` (used by `recordPayment`) is left
  untouched. Approved `StudentDiscount`s reduce the invoice: PERCENTAGE applies
  to the **invoice subtotal**, FIXED amounts apply in full; the sum is capped at
  the subtotal. Each is written as a negative `InvoiceItem` ("Discount: …") and
  `Invoice.discount` / `Invoice.subtotal` are set alongside `total`. `mapInvoice`
  now returns `subtotal` + `discount`.
- **Family-condition discounts are never auto-applied.** An approved
  `FamilyConditionDiscount` stays a candidate for a *manual* link to an invoice;
  invoice generation ignores it entirely.

> 2026-10-15 status correction: the `bulkGenerate` / negative-`InvoiceItem`
> paragraph above describes pre-rework code. Verified by grep: neither
> `bulkGenerate` nor `InvoiceItem` exists anywhere in `backend/src` anymore;
> an APPROVED `StudentDiscount` currently has **zero financial effect** anywhere.
> The "invoice-time hook" the payment-time plan assumed had to be removed was
> never there — payment-time application is new code, not a migration (see the
> 2026-10-15 Topper + payment-time section below).

## Topper-of-Class + unified payment-time discounts (2026-10-15, user-confirmed)

Six §7 answers (all defaults): unified payment-time for all three sources;
topper scope = class; ranking = most-recent-PUBLISHED-exam aggregate; award =
current academic year expiring at year end; AUTO pre-checked-but-confirmed;
stacking = uncapped sum, hard floor zero.

### Research corrections (all verified against live code, 2026-10-15)
- **No Invoice model, no invoice-time discounts.** The invoice role is played by
  `StudentFeeStructure` (annual, `academicYearId` only). `syncSiblingDiscounts`
  queues PENDING `StudentDiscount`s and stops there; `FamilyConditionDiscount`
  never touches amounts; `buildInstallmentPlan` accepts a `discount` option no
  production caller passes. Nothing to remove for double-discount safety.
- **No rank concept exists** in `backend/src` (`rank`/RANK()/GPA/www = 0 hits).
  Topper ranking is built new off `ExamResult.marks` (`Decimal(8,2)`, nullable).
- **No term-level billing.** `AcademicTerm` exists but no finance code reads it;
  eligibility terms are expiry metadata only (`expiresAt`), matching keys off
  `academicYearId`.

### New model shape (backend `schema.prisma`)
- `DiscountSourceType { SIBLING, TOPPER, FAMILY_CONDITION, MANUAL }` — **MANUAL
  is a 4th value the spec did not foresee**: the discounts-tab
  `POST /finance/student-discounts` assign path is a real pipeline whose
  approved rows need somewhere to land. MANUAL = anything approved from
  `StudentDiscount` that the sibling sync did not compose.
- `DiscountEligibility` carries its own `valueType` + `value` (the row is
  self-contained): sibling valueType recovered from `DiscountType.kind`
  (`'percentage'|'fixed'`, set by the sync); topper from the rule; family from
  its row; manual from its `DiscountType.kind`.
- **No `status` column** — rows are created already-effective (approvals happen
  upstream; topper compute writes APPROVED directly). Validity = `expiresAt` +
  `appliedAmount` bookkeeping. **No `approvalRequirement` column** — derived:
  `SIBLING|TOPPER` pre-checked in Record Payment, `FAMILY_CONDITION|MANUAL`
  selectable-but-off (family is never auto-applied, locked rule).
- **Sibling vs manual classification:** `relationApplied != null ⇒ SIBLING`
  (only the sync writes that field, `finance-payroll.service.ts:949`;
  `AssignDiscountDto` has no such field). Everything else from the queue ⇒ MANUAL.
- **Year/expiry:** sibling/manual/family source tables carry no year, so those
  eligibilities get `academicYearId = null` (match any year, no expiry).
  Topper gets `academicYearId = exam.academicYearId`, `expiresAt =
  AcademicYear.endsOn`.
- **Display label, never the sensitive reason:** eligibility stores a `label`
  (`"Sibling Discount (15%)"`, `"Topper of <class> — <exam>"`,
  `"Family condition"`) generated at the bridge. The hardship `reason` text is
  never copied onto eligibility, so receipts/exports are redacted by
  construction (ReceiptDialog surfaces label + amount only).
- **Discounts are price reductions, not cash:** a `DiscountApplication` is NOT
  un-applied when its paired payment is reversed. Reversing cash returns the
  cash; the awarded discount stays consumed. Entry survives future reversals.

### Topper computation
- Source exam = latest `Exam` with `status = PUBLISHED`, ordered by
  `publishedAt desc`. Per-student aggregate = SUM(`marks`) over that exam's
  subjects where `ExamResult.kind = MAJOR AND status = PUBLISHED`
  (CASUAL rows excluded — low-stakes makeup noise; logged here).
- Grouping = `ExamSubject → classSubject.classId`; roster = `StudentEnrollment`
  `status = ACTIVE` in that class for the exam's year. Ties share the rank;
  winner = rank 1 per class. One eligibility per (student, rule, year) —
  recompute is idempotent, skips already-awarded.


## 2026-10-15 � Discounts workspace: 7 tabs consolidated into 2 (Assigned Discounts + Discount Rules)

- **Why:** the seven tabs (`types/students/approvals/siblings/sibling-rules/topper-rules/family`) fragmented one workflow across seven data sources; the prompt-specified `app/(dashboard)/...` path and `GET /finance/discount-rules` did not exist, and the prompt assumed `ACTIVE/EXPIRED/REVOKED` statuses, verbal-notes columns, and dark mode that the codebase does not have. Adapted, not transliterated.
- **Tab 1 Assigned Discounts** (`?tab=assigned`, default) reads `GET /finance/discounts/assigned`. Status badges are derived: `approved|active` -> Active, `pending` -> Pending, `expired` -> Expired, `rejected` -> Revoked (red). Approve/Reject route per row `source` (student-discounts vs family-condition endpoints); TOPPER rows carry no actions (already effective). Academic-year badge renders only for TOPPER rows � assignments/family rows have no year column, so the column shows an em dash rather than a fabricated year.
- **Tab 2 Discount Rules** (`?tab=rules`) reads `GET /finance/discount-rules`. Sibling-group management + sync and topper compute survive as dialogs (user decision: keep in modals, nothing functional lost). Sibling delete is a soft-deactivate; inactive rows render an Inactive badge (deletion otherwise looks like a no-op).
- **Assign modal** (`components/finance/assign-discount-modal.tsx`): student combobox reuses the payments-page Popover+Command pattern against `/fees/students?q=` (now also matches `roleNumber`); SIBLING/TOPPER post to `POST /finance/discounts/assign` (server resolves/creates the DiscountType), SPECIAL posts to the family-condition endpoint with mandatory notes (client `canSave` gate + server DTO `@IsNotEmpty reason`). Template picker is optional with a Clear button; year select defaults to the active session and is client-side only (APIs take no year � no `academicYearId` is sent, the whitelist pipe would 400 it).
- **Base UI (base-nova) gotchas hit during build:** `Select onValueChange` is nullable (`string | null`) � every handler null-guards; `ToggleGroup` is array-based (`value={[v]}`, no `type="single"`); `PopoverTrigger`/`SelectPrimitive.Icon` use `render=` (not `asChild`); tab state syncs back/forward via `useEffect` on `searchParams` inside a Suspense boundary. Pruned dead frontend types: `Discount, StudentDiscount, SiblingDiscountRule, FamilyConditionDiscount, TopperDiscountRule` (backend endpoints stay live).
- **No dark mode** � dropped by explicit user decision; page stays on semantic tokens in the app light theme. No `bg-zinc-950`/`dark:` classes anywhere in the new code.

## 2026-10-15 - Expenses workspace: "Expenses & Refunds" renamed to Expenses, 3 tabs consolidated into 2 (All Expenses + Approval Queue)

- **Why:** the Refunds tab duplicated a separate backend concept (`RefundRequest` against payments) inside an operational-expenditure ledger; the prompt-specified `app/(dashboard)/...` path does not exist (route is `app/(portal)/expenses`), and the prompt assumed `paymentMethod`, `refId`, `title`, and `requestedBy` columns that the `Expense` model does not have. Adapted, not transliterated - no schema change.
- **Tab 1 All Expenses** (`?tab=all`, default) reads `GET /finance/expenses` once at the page level. Columns: Title & Payee (description bold + vendor muted), Category badge, Amount via `useCurrency()`, Date (`MMM DD, YYYY`), Status badge (Approved/Paid -> default, Pending -> amber-tint outline per the discounts-page precedent, Rejected -> destructive), Actions (inline ghost Edit/Delete icons - prompt allowed icons instead of a dropdown). Header: search input (title/payee/category, client-side) + category Select (6 keys, matched via `categoryKeyForName` normalization) + Record Expense button.
- **Tab 2 Approval Queue** (`?tab=approvals`, pending count in the trigger) filters the same list client-side (`status === "pending"`). Approve posts `POST /finance/expenses/:id/approve` then reloads the shared list so Tab 1 syncs immediately; Reject opens a required-reason mini-dialog posting `{ reason }`. Tab state syncs back/forward via `useEffect` on `searchParams` inside a Suspense boundary (same pattern as discounts).
- **Record modal** (`components/finance/create-expense-modal.tsx`): title, category Select (labels sent as the stored category name via find-or-create), amount (> 0 gate), vendor/payee input, native date input defaulting to today, student Popover+Command picker (copied from assign-discount-modal) filling vendor when category is STUDENT_PAYOUT. Doubles as the edit modal (`initial` -> PUT). No payment-method / ref-ID / receipt-upload fields - the model has no such columns.
- **Dropped adaptations (documented):** Payment Method & Ref column (no columns; vendor shown instead), Requested By column (no `createdBy` on Expense; payee shown instead), receipt/voucher upload (no storage wired). Rejection reason is required client-side and accepted by the API but NOT persisted (no column) - follow-up migration can add `rejectionReason`. Edit/Delete backend-guarded to PENDING rows only (400 otherwise); buttons disable with title tooltips for non-pending rows.
- **Refunds removal:** `RefundsTab`, its trigger, and the `Refund` interface are gone (interface was used only here); sidebar labels (financial + admin) and the admin placeholder now read "Expenses". Backend `GET /finance/refunds` + `FinanceRefundsController` stay live (same precedent as discounts - UI removal only). The "Refund Approval" row in controls/page.tsx is a static approval-matrix label, not a Refunds surface - left alone.
- **No dark mode** - default shadcn theme variables only; no `dark:`/`zinc-950` classes in the new code (verified by grep).

## 2026-10-15 - Cash workspace: 4 tabs consolidated into Treasury dashboard (balance cards + 2 tabs)

- **Why:** the Cashbook tab duplicated the reports Cashbook view, and the Daily Closing / Bank Reconciliation tabs were dead placeholders ("coming soon"); the prompt-specified `app/(dashboard)/finance/accounts` path does not exist (route stays `app/(portal)/cash`, sidebar labels unchanged). Adapted, not transliterated - no schema change.
- **Section 1 balance cards** read the existing `GET /finance/accounts` (live computed balances). Cards render all live accounts rather than the 4 fixed destinations the prompt assumed (accounts are user-created with arbitrary names - no MAIN_DRAWER/BANKAK/FAWRY/BANK_ACCOUNT rows exist). `[ + Transfer Funds ]` (needs 2+ accounts) and `New Account` (existing create dialog preserved) sit in the header. Route and sidebar labels unchanged.
- **Tab 1 Daily Till Closings** (`?tab=closings`, default) reads new `GET /finance/closings`. Columns: Date & Cashier (closedBy resolved via the global User table), System Expected, Actual Counted, Variance badge (0 -> outline Balanced, <0 -> destructive Shortage, >0 -> green-tint Overage), Status (derived: 0 -> CLOSED else FLAGGED_REVIEW - no APPROVED state, no approver column exists), Actions (View summary dialog + Print via window.print).
- **Close Till Modal** (`components/finance/close-till-modal.tsx`): account Select (backend requires accountId - prompt had no account field), date defaults to today, expected read-only from new `GET /finance/closings/expected` (account credits-minus-debits, exactly mirroring stored closing math), live diff preview, notes required iff diff != 0 (client gate + server 400). Posts `POST /finance/closings`. One close per account per day (P2002 -> friendly 400).
- **Tab 2 Internal Transfers** (`?tab=transfers`) reads new `GET /finance/transfers`. No transfer table exists, so transfers persist as paired DEBIT/CREDIT `FinancialTransaction` rows sharing an `XFER:<uuid>` token in `referenceType` - existing balance math stays exact, zero migration. Columns: Date / From / To / Amount / Reference (slip #). Recorded By and Notes have no columns: accepted by the API but not persisted (same documented pattern as expense reject reasons); follow-up migration can add a `fund_transfers` table.
- **Transfer modal** (`components/finance/transfer-funds-modal.tsx`): From/To selects (must differ, client + server), amount > 0, optional ref#/notes. Both legs write inside one `withTenant` callback. Both accounts tenant-verified (404, no blind cross-tenant writes).
- **Removed:** Cashbook + Bank Reconciliation tabs and their placeholder components from the cash page. Backend `GET /finance/cashbook` and all reconciliation endpoints stay live (UI-only removal, house precedent).
- **No dark mode** - default theme variables only; no `dark:`/`zinc-950` classes in the new code (verified by grep).

## 2026-10-15 - Payroll 2-tab workspace (`app/(portal)/payroll`)

- Replaced the 4-tab batch generator (Run Payroll / Assignments / Positions / Deduction Rules) with **Monthly Pay Register** (`?tab=disbursements`) + **Salaries & Deduction Setup** (`?tab=setup`), same Suspense + `router.replace` tab pattern as expenses/cash.
- Register: 3 summary cards (total / paid / pending), search + role + status filters, per-row base / red deduction w/ absence tooltip / bold net / last paid / next eligible, `[ Pay Salary ]` -> confirm modal (`CASH|BANKAK|FAWRY|BANK_TRANSFER`, optional ref/notes) -> `POST /finance/payroll/pay`. Paid rows show green `PAID FOR <cycle>` badge; assignment-less rows disable Pay with "assign a position first" tooltip.
- Setup: per-person override inputs (`PUT /finance/payroll/salary`), active-position base table (`PUT /finance/positions/:id`), daily-absence + late-arrival rate inputs (`PUT /finance/payroll/shortage-rates`).
- Base UI API respected: nullable-guarded `onValueChange`, `TooltipTrigger render=` (no `asChild`). `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Payroll 3-tab layout + position salary modal

- Page is now **Monthly Pay Register** (`?tab=disbursements`) + **Positions** (`?tab=positions`) + **Deduction Rules** (`?tab=deductions`). The old setup tab was split: per-person override inputs removed (position base is authoritative), shortage rates moved into the Deductions tab.
- New `assign-position-salary-modal.tsx`: pick an existing active position (PUT base) or type a new title (POST create). Positions table shows live staff counts, Edit Salary, and Reset (base -> 0).
- Register shows an amber "Set salary in Positions tab" inline alert for $0 bases. Deductions tab adds rules CRUD (create/toggle/delete) above the shortage-rates card. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Salary modal dual mode (staff vs position)

- `assign-position-salary-modal.tsx` now takes `mode`: **staff** (default from `[+ Set Staff Salary]`) shows a grouped staff select (Academic Affairs teachers / Admin staff, ADMIN self excluded, served by `GET /finance/payroll/staff-options`) + amount -> `POST /finance/payroll/assign-salary`; **position** (from per-row Edit Salary) keeps the previous position create/edit behavior. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Roster-derived positions in the select

- The position dropdown now merges persisted Position rows with roles actually held by current staff (teachers from Academic Affairs + admin staff, ADMIN self excluded server-side via `GET /finance/payroll/staff-options`, title-cased for display). Roster-only picks (`new:<Title>`) create the Position row on save. So TEACHER / ACADEMIC AFFAIRS / FINANCIAL AFFAIRS / JANITOR etc. are always selectable even with zero Position rows. Silent failures fixed: load errors surface with Retry, plus an empty-state hint.

## 2026-10-15 (addendum) - Deduplicated position dropdown per spec

- Dropdown = persisted active positions (deduped by title, admin titles excluded) + roster-derived roles (academic contributes ONLY Teacher; admin contributes every unique staff role incl. custom titles; each title exactly once; ADMIN/SUPER_ADMIN/SYSTEM_ADMIN filtered both server- and client-side).
- Spec labels applied: "Position / Role", "Select a position...", "Monthly Base Salary (<code>)" with currency-prefixed amount input (`0.00` placeholder). Deviation noted: plain React state per repo finance-modal convention instead of react-hook-form + zod (no RHF/zod in the codebase finance modals).

## 2026-10-15 (addendum) - Position-only modal (no staff-member select)

- User correction: the form selects the staff member''s POSITION, never a person. Staff-select mode removed (`mode` prop gone); the dropdown lists positions only � persisted rows deduped by title + roster-derived roles (academic -> Teacher only; admin -> every unique staff role; ADMIN/SUPER_ADMIN/SYSTEM_ADMIN excluded), each title once, roster-only picks create the row on save. `[+ Set Position Salary]` label restored.

## 2026-10-15 (addendum) - Modal uses the upsert contract

- Every non-edit save in the salary modal now POSTs `{ positionKey, baseSalary }` (numeric `Number()` conversion client-side) to `/finance/payroll/positions` � one path for existing picks, roster-derived picks, and typed titles. Edit flow still PUTs by id. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Register driven by payable

- Pay button enablement/tooltip switched from `hasAssignment` to the new `payable` field (base > 0), so assignment-less teachers with a matched position salary are payable; zero-base rows keep the "Set salary in Positions tab" hint and disabled Pay. `tsc` + `eslint` clean.

## 2026-10-15 - Reports 2-tab workspace (replaces 5 mock tabs)

- `app/(portal)/reports/page.tsx` rewritten: the old page was 100% hardcoded mock arrays with zero API calls. Now Financial Summary (`?tab=summary`, 4 KPI cards + method breakdown) + Master Transaction Ledger (`?tab=ledger`, type filter + search + badge-colored signed rows), global preset/custom range driving both tabs, same Suspense + router.replace pattern.
- New `export-report-modal.tsx`: report-type radio filters rows/columns, range confirms from active selection, CSV via Blob download, PDF/Print Direct via print-only layout + window.print (no backend). `tsc` + `eslint` clean.

## 2026-10-15 - Controls 2-tab workspace (`?tab=governance|settings`)

- Replaced 4 tabs (periods read-only, methods read-only, workflows MOCK, settings read-only) with System Governance (fiscal periods table with New dialog + Lock/Unlock + OPEN/LOCKED badges; channel cards with Active toggle + Edit Channel Details modal) + Approval Rules & Settings (thresholds CRUD table + defaults form: currency select, receipt/voucher prefixes, grace days, Save Configuration). Mock workflows deleted. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Cash & Accounts and Financial Controls removed

- Deleted `app/(portal)/cash`, `app/(portal)/controls` (both URLs now 404), `components/finance/close-till-modal.tsx`, `components/finance/transfer-funds-modal.tsx` (zero other importers; payroll/report modals kept). Sidebar + mobile bottom nav entries removed. Backend accounts/controls routes, services, and migration `20261016090000_financial_controls` intentionally left live (frontend-only removal; reusable if the modules return).

## 2026-10-15 - Student ledger page + shared payment modal

- New `app/(portal)/students/[id]/page.tsx` (via `useParams`): snapshot cards + guardian card, fee-structure table, installment schedule with pre-filled Collect per row, collections log with per-row Print Single Receipt, master-statement button. Print modals use the print-only + `window.print()` pattern.
- Extracted `RecordPaymentDialog` -> `components/finance/record-payment-dialog.tsx` with `presetStudent` lock + `presetTargetKey` + controlled open mode; payments page rewired with zero behavior change (label maps re-exported for its verification views). Students table names link to detail pages. `tsc` + `eslint` clean. Caution note: PowerShell line-surgery on payments page mojibake-corrupted a `�` char (PS5.1 ANSI decode); repaired to UTF-8 no-BOM � prefer `edit` over shell for file ops.

## 2026-10-15 (addendum) - Portal layout Suspense shells (dynamic-route prerender fix)

- `/students/[id]` (first dynamic route) tripped Next.js prerendering: `usePathname()` in Sidebar/BottomNav with no Suspense boundary above. Fix at the layout level (covers all future dynamic routes): static, hook-free shell fallbacks around both. Page-level `useParams()` streams fine once the layout boundary exists. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Discount-aware student ledger + collect modal

- Detail page fetches existing `GET /finance/students/:id/eligible-discounts` (no backend change): stacked purple badges per usable eligibility (label + %/amount), neutral "Standard Tuition" badge when empty. Fee card gains Gross -> red Applied Discount -> Net Adjusted Tuition footer from existing `fee` payload; schedule table gains a per-installment Discount column.
- Record modal targets now net consumed discounts (`amount - paid - discounted`) with an audit subtext distinguishing already-applied reductions from newly-tickable Discounts checkboxes. Posting stays on `POST /finance/payments` + `discountIds` � the prompt''s `CollectPaymentDto`/`/collect` endpoint was NOT built (would duplicate the working money path). `tsc` + `eslint` clean.

## 2026-10-15 - Dashboard rewrite (5 KPIs + activity + positions)

- Replaced 3 cards + chart + quick actions with 5 KPI cards (collections + MoM %, outflows + breakdown subtext, net green/red, students, teachers) and a 60/40 grid (recent activity ledger + positions table with Manage Positions & Payroll link). Chart/quick-actions dropped per locked decision (reports/sidebar cover them). Base UI Button has no `asChild` � footer link uses router.push. `tsc` + `eslint` clean.

## 2026-10-15 (addendum) - Dashboard self-diagnosis (debugging aid)

- The page now detects an old-backend response (missing `payroll`/`totalStudents` keys) and shows an amber banner stating outflows/headcount need a backend restart, instead of silently rendering zeros. Header shows the tenant school name when the backend provides it. `tsc` + `eslint` clean.
