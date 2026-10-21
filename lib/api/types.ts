export interface FeeCategory {
  id: string;
  name: string;
  description?: string;
  active: boolean;
}

export interface FeeInstallment {
  installmentNo: number;
  amount: number;
  dueDate: string;
}

export interface Student {
  id: string;
  name: string;
  firstName: string;
  lastName?: string | null;
  educationLevel?: string | null;
  grade?: number | null;
}

export interface AcademicYear {
  id: string;
  name: string;
  startsOn: string;
  endsOn: string;
  isCurrent: boolean;
}

export interface SchoolClass {
  id: string;
  className: string;
  educationLevel: string;
  grade: string;
  studentCount: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface FeeStructure {
  id: string;
  categoryId?: string;
  name: string;
  tuitionFee: number;
  registrationFee: number;
  currencyCode?: string;
  frequency: string;
  educationLevel?: string;
  grade?: string;
  installmentCount?: number;
  installmentDueDates?: string[];
  installments?: FeeInstallment[];
  isActive?: boolean;
  active: boolean;
}

export interface Payment {
  id: string;
  studentId: string;
  studentName: string;
  educationLevel?: string;
  grade?: number | null;
  className?: string;
  totalFee?: number;
  amount: number;
  currencyCode?: string;
  method: "cash" | "bankak" | "fawry" | "okash" | "al_mashriq";
  reference?: string;
  allocationKind?: "installment" | "registration" | "lump_sum";
  allocationTarget?: string;
  installmentNo?: number | null;
  installmentPaid?: number;
  installmentAmount?: number;
  balance?: number;
  progress?: number;
  status?: "paid_in_full" | "on_track" | "partial" | "overdue";
  daysLate?: number;
  statusLabel?: string;
  paidAt: string;
  createdAt?: string;
  isFinalPaymentOnInstallment?: boolean;
  installmentProgress?: {
    invoiceAmount: number;
    amountPaidToDate: number;
    percent: number;
  } | null;
  installmentEffect?: {
    contributed: number;
    amountBefore: number;
    amountAfter: number;
    isOpening: boolean;
    isFinal: boolean;
  } | null;
}

export interface PaymentAllocation {
  installmentNo: number | null;
  kind: "installment" | "registration" | "lump_sum";
  amount: number;
}

export interface RecordPaymentInput {
  studentId: string;
  allocations: PaymentAllocation[];
  method: Payment["method"];
  transactionId?: string;
  notes?: string;
  discountIds?: string[];
}

export interface StudentSchedule {
  studentId: string;
  studentName: string;
  educationLevel?: string;
  grade?: number | null;
  assigned: boolean;
  // True when the structure was matched by education level+grade for preview
  // and no StudentFeeStructure row exists yet — the link is created on save.
  proposed?: boolean;
  className?: string;
  totalFee: number;
  registrationFee: number;
  registrationPaid: number;
  tuitionFee: number;
  totalPaid: number;
  totalDiscounted?: number;
  balance: number;
  progress: number;
  status: "paid_in_full" | "on_track" | "partial" | "overdue";
  daysLate: number;
  frequency?: string;
  installments: {
    no: number;
    amount: number;
    dueDate: string;
    paid: number;
    discounted?: number;
    complete: boolean;
    overdue: boolean;
    daysLate: number;
  }[];
  currentTarget: { no: number; amount: number; dueDate: string; paid: number } | null;
}

export type ExpenseCategoryKey =
  | "MAINTENANCE"
  | "SALARIES"
  | "UTILITIES"
  | "SUPPLIES"
  | "STUDENT_PAYOUT"
  | "OTHER";

export interface Expense {
  id: string;
  categoryId: string;
  categoryName: string;
  amount: number;
  currencyCode?: string;
  title: string;
  description?: string;
  vendor: string;
  status: "pending" | "approved" | "rejected" | "paid";
  incurredAt: string;
}

export interface CashAccount {
  id: string;
  name: string;
  type: "cash" | "bank";
  balance: number;
  currency: string;
}

export interface CreateCashAccountInput {
  name: string;
  type: "CASH" | "BANK";
  currency: string;
  bankName?: string;
  accountNo?: string;
  openingBalance?: number;
}

export interface CashbookEntry {
  id: string;
  accountId: string;
  accountName: string;
  type: "debit" | "credit";
  amount: number;
  currencyCode?: string;
  description?: string;
  date: string;
}

export interface DailyClosing {
  id: string;
  accountId: string;
  accountName: string;
  date: string;
  expected: number;
  counted: number;
  variance: number;
  status: "CLOSED" | "FLAGGED_REVIEW";
  cashierName: string;
}

export interface FundTransfer {
  id: string;
  date: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  reference: string;
}

export interface DashboardActivity {
  type: "COLLECTION" | "EXPENSE" | "PAYROLL";
  title: string;
  amount: number;
  method: string;
  at: string | null;
}

export interface DashboardStats {
  tenant?: { id: string; name: string };
  totalCollected: number;
  expenses: number;
  netCashFlow: number;
  payroll: number;
  outflows: number;
  collectionsLastMonth: number;
  collectionsChangePct: number | null;
  totalStudents: number;
  totalTeachers: number;
  recentActivity: DashboardActivity[];
}

export interface CollectionSummary {
  month: string;
  collected: number;
}

export interface FinancialPeriod {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export interface PaymentMethod {
  id: string;
  name: string;
  type: string;
  active: boolean;
  accountName?: string | null;
  accountNumber?: string | null;
}

export interface FinancialSettings {
  currency: string;
  academicYear: string;
  currentPeriodId: string;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  receiptPrefix: string;
  voucherPrefix: string;
  graceDays: number;
}

export interface ApprovalThreshold {
  id: string;
  module: string;
  threshold: number;
  approverRole: string;
  isActive: boolean;
}

export type DeductionValueType = "PERCENTAGE" | "FIXED_AMOUNT";
export type SiblingRelationType = "SISTERS" | "BROTHERS" | "SISTERS_AND_BROTHERS";

export interface Position {
  id: string;
  title: string;
  description: string;
  baseSalary: number;
  currencyCode: string;
  isActive: boolean;
  departmentId: string | null;
  departmentName: string;
  staffCount: number;
}

export interface Department {
  id: string;
  name: string;
}

export interface DeductionRule {
  id: string;
  name: string;
  valueType: DeductionValueType;
  value: number;
  description: string;
  appliesToPositionId: string | null;
  isActive: boolean;
}

export interface StaffAssignment {
  id: string;
  userId: string;
  staffName: string;
  staffNumber: string;
  positionId: string;
  positionTitle: string;
  baseSalary: number;
  salaryOverride: number | null;
  effectiveSalary: number;
  currencyCode: string;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
}

export interface Employee {
  userId: string;
  name: string;
  email: string;
  staffNumber: string;
  roles: string[];
  assignmentId: string | null;
  positionId: string | null;
  positionTitle: string | null;
  baseSalary: number | null;
  salaryOverride: number | null;
  effectiveSalary: number | null;
  currencyCode: string | null;
}

export interface PayrollRegisterRow {
  userId: string;
  name: string;
  staffNumber: string;
  roleLabel: string;
  positionTitle: string;
  baseSalary: number;
  currencyCode: string;
  absentDays: number;
  lateDays: number;
  deductionAmount: number;
  netPay: number;
  status: "paid" | "pending";
  lastPaidAt: string | null;
  nextEligibleDate: string;
  hasAssignment: boolean;
  payable: boolean;
  cycleLabel: string;
}

export interface ShortageRates {
  absentDaily: number;
  lateRate: number;
}

export type SalaryPayMethod = "CASH" | "BANKAK" | "FAWRY" | "BANK_TRANSFER";

export interface ReportMethodShare {
  method: string;
  count: number;
  total: number;
  share: number;
}

export interface ReportSummary {
  collections: number;
  expenses: number;
  discounts: number;
  net: number;
  byMethod: ReportMethodShare[];
}

export type LedgerRowType = "COLLECTION" | "EXPENSE" | "PAYROLL" | "DISCOUNT";

export interface LedgerRow {
  id: string;
  at: string;
  type: LedgerRowType;
  title: string;
  channel: string;
  amount: number;
  ref: string;
  by: string;
}

export type ReportKind = "summary" | "collections" | "expenses" | "discounts";

export interface LedgerGuardian {
  name: string;
  phone: string;
  relationship: string;
  isPrimary: boolean;
}

export interface LedgerFeeRow {
  label: string;
  amount: number;
  discount: number;
  net: number;
}

export interface LedgerInstallment {
  no: number;
  name: string;
  dueDate: string;
  amount: number;
  discounted: number;
  paid: number;
  remaining: number;
  status: "PAID" | "PARTIAL" | "PENDING" | "OVERDUE";
  overdue: boolean;
}

export interface LedgerPayment {
  id: string;
  ref: string;
  at: string | null;
  target: string;
  method: string;
  amount: number;
  currencyCode: string;
  by: string;
}

export interface StudentLedger {
  profile: {
    id: string;
    name: string;
    roleNumber: string;
    educationLevel: string;
    grade: number | null;
    phone: string;
    guardians: LedgerGuardian[];
  };
  fee: {
    templateName: string;
    currency: string;
    rows: LedgerFeeRow[];
    total: number;
    totalDiscount: number;
    netTotal: number;
  };
  installments: LedgerInstallment[];
  payments: LedgerPayment[];
  totals: {
    assigned: number;
    paid: number;
    balance: number;
    status: "FULLY_PAID" | "PARTIALLY_PAID" | "OVERDUE";
    currency: string;
  };
}

export interface PayoutDeduction {
  id: string;
  ruleId: string | null;
  label: string;
  valueType: DeductionValueType;
  value: number;
  amount: number;
  note: string;
}

export interface SalaryPayout {
  id: string;
  userId: string;
  staffName: string;
  staffNumber: string;
  payslipNo: string;
  positionAssignmentId: string;
  positionTitle: string;
  financialPeriodId: string | null;
  periodName: string;
  periodStart: string | null;
  periodEnd: string | null;
  grossAmount: number;
  totalDeductions: number;
  netAmount: number;
  currencyCode: string;
  status: "draft" | "approved" | "paid" | "cancelled";
  accountId: string | null;
  approvedBy: string | null;
  paidAt: string | null;
  paymentMethod: string;
  reference: string;
  notes: string;
  createdAt: string | null;
  deductions: PayoutDeduction[];
}

export interface SiblingGroupMember {
  id: string;
  studentId: string;
  studentName: string;
  roleNumber: string;
  educationLevel: string;
  grade: string;
}

export interface SiblingGroup {
  id: string;
  name: string;
  relation: SiblingRelationType;
  createdAt: string | null;
  members: SiblingGroupMember[];
}

export type DiscountSourceType = "SIBLING" | "TOPPER" | "FAMILY_CONDITION" | "MANUAL";

export interface DiscountEligibility {
  id: string;
  sourceType: DiscountSourceType;
  valueType: DeductionValueType;
  value: number;
  appliedAmount: number;
  label: string;
  academicYearId: string | null;
  expiresAt: string | null;
  preChecked: boolean;
}

export interface TopperComputeResult {
  examId: string;
  examName: string;
  awarded: number;
  skipped: number;
}

// Unified 2-tab workspace contracts (mirror the backend ledger shapes).
export type AssignedDiscountCategory = "SIBLING" | "TOPPER" | "SPECIAL_DISCRETION" | "MANUAL";
export type AssignedDiscountSource = "STUDENT_DISCOUNT" | "FAMILY_CONDITION" | "TOPPER";
export type AssignedDiscountStatus = "pending" | "approved" | "rejected" | "active" | "expired";

export interface AssignedDiscountRow {
  id: string;
  source: AssignedDiscountSource;
  studentId: string;
  studentName: string;
  grade: string | null;
  category: AssignedDiscountCategory;
  name: string;
  valueType: DeductionValueType | null;
  value: number;
  notes: string | null;
  academicYear: string | null;
  status: AssignedDiscountStatus;
  actions: Array<"approve" | "reject">;
}

export type DiscountRuleCategory = "SIBLING" | "TOPPER" | "MANUAL";
export type DiscountRuleSource = "SIBLING_RULE" | "TOPPER_RULE" | "DISCOUNT_TYPE";

export interface DiscountRuleRow {
  id: string;
  source: DiscountRuleSource;
  name: string;
  category: DiscountRuleCategory;
  valueType: DeductionValueType | null;
  value: number | null;
  description: string | null;
  isActive: boolean;
}
