/**
 * JSON shapes returned by the server API. Dates are ISO strings; calendar
 * dates are `YYYY-MM-DD` strings already resolved to the user's timezone.
 */
import type { TransactionType } from '../schemas/transaction'
import type { PaymentMethodType } from '../schemas/entities'
import type { InstallmentItemStatus, InstallmentStatus } from '../schemas/installment'
import type { AIProviderName } from '../schemas/ai'
import type { RecurrenceFrequency } from '../utils/dates'

export interface UserDto {
  id: string
  name: string
  email: string
  avatarUrl: string | null
  preferredCurrency: string
  timezone: string
  defaultPaymentMethodId: string | null
  defaultCategoryId: string | null
  hasPassword: boolean
  hasGoogle: boolean
  createdAt: string
}

export interface CategoryDto {
  id: string
  name: string
  icon: string | null
  color: string | null
  parentId: string | null
  active: boolean
  isSystem: boolean
  sortOrder: number
}

export interface PaymentMethodDto {
  id: string
  name: string
  type: PaymentMethodType
  currency: string
  active: boolean
  sortOrder: number
}

export interface MerchantDto {
  id: string
  name: string
  defaultCategoryId: string | null
  transactionCount?: number
  lastUsedAt?: string | null
}

export interface CategoryRef {
  id: string
  name: string
  icon: string | null
  color: string | null
}

export interface PaymentMethodRef {
  id: string
  name: string
  type: PaymentMethodType
}

export interface MerchantRef {
  id: string
  name: string
}

export interface TransactionDto {
  id: string
  type: TransactionType
  amountMinor: number
  currency: string
  /** Instant (ISO 8601, UTC). */
  occurredAt: string
  /** Calendar date/time in the user's timezone. */
  date: string
  time: string
  categoryId: string | null
  category: CategoryRef | null
  paymentMethodId: string | null
  paymentMethod: PaymentMethodRef | null
  fromPaymentMethodId: string | null
  fromPaymentMethod: PaymentMethodRef | null
  toPaymentMethodId: string | null
  toPaymentMethod: PaymentMethodRef | null
  merchantId: string | null
  merchant: MerchantRef | null
  note: string | null
  tags: string[]
  installmentId: string | null
  installmentTitle?: string | null
  recurringId: string | null
  createdAt: string
  updatedAt: string
}

export interface TransactionListResponse {
  items: TransactionDto[]
  nextCursor: string | null
  total: number
}

/** A deterministic Smart Repeat suggestion derived from the user's history. */
export interface SmartRepeatSuggestion {
  key: string
  label: string
  type: TransactionType
  amountMinor: number
  currency: string
  categoryId: string | null
  category: CategoryRef | null
  paymentMethodId: string | null
  paymentMethod: PaymentMethodRef | null
  merchantId: string | null
  merchant: MerchantRef | null
  note: string | null
  useCount: number
  lastUsedAt: string
}

export interface FavoriteDto {
  id: string
  name: string
  type: 'income' | 'expense'
  amountMinor: number
  currency: string
  categoryId: string | null
  category: CategoryRef | null
  paymentMethodId: string | null
  paymentMethod: PaymentMethodRef | null
  merchantId: string | null
  merchant: MerchantRef | null
  note: string | null
  sortOrder: number
}

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

export interface InstallmentPaymentDto {
  id: string
  installmentId: string
  itemId: string
  sequence: number
  amountMinor: number
  paidDate: string
  paidTime: string
  paymentMethodId: string | null
  paymentMethod: PaymentMethodRef | null
  note: string | null
  transactionId: string | null
  createdAt: string
}

export interface InstallmentItemDto {
  id: string
  installmentId: string
  sequence: number
  dueDate: string
  expectedAmountMinor: number
  paidMinor: number
  remainingMinor: number
  status: InstallmentItemStatus
  note: string | null
  payments: InstallmentPaymentDto[]
}

export interface InstallmentDto {
  id: string
  title: string
  status: InstallmentStatus
  currency: string
  totalAmountMinor: number
  downPaymentMinor: number
  principalMinor: number
  interestMinor: number
  feesMinor: number
  count: number
  expectedInstallmentMinor: number
  firstDueDate: string
  dueDay: number
  categoryId: string
  category: CategoryRef | null
  paymentMethodId: string
  paymentMethod: PaymentMethodRef | null
  merchantId: string | null
  merchant: MerchantRef | null
  note: string | null
  parentTransactionId: string | null
  createdAt: string
  // Aggregates
  paidCount: number
  totalPaidMinor: number
  totalExpectedMinor: number
  remainingExpectedMinor: number
  nextItem: { sequence: number, dueDate: string, expectedAmountMinor: number, remainingMinor: number, status: InstallmentItemStatus } | null
  lateCount: number
}

export interface InstallmentDetailDto extends InstallmentDto {
  items: InstallmentItemDto[]
}

export interface InstallmentCalendarItem {
  installmentId: string
  installmentTitle: string
  itemId: string
  sequence: number
  count: number
  dueDate: string
  expectedAmountMinor: number
  paidMinor: number
  currency: string
  status: InstallmentItemStatus
}

// ---------------------------------------------------------------------------
// Recurring
// ---------------------------------------------------------------------------

export type RecurringOccurrenceStatus = 'upcoming' | 'due_today' | 'overdue'

export interface RecurringDto {
  id: string
  name: string
  type: 'income' | 'expense'
  amountMinor: number
  currency: string
  categoryId: string | null
  category: CategoryRef | null
  paymentMethodId: string
  paymentMethod: PaymentMethodRef | null
  merchantId: string | null
  merchant: MerchantRef | null
  frequency: RecurrenceFrequency
  startDate: string
  nextDueDate: string
  anchorDay: number
  active: boolean
  note: string | null
  occurrenceStatus: RecurringOccurrenceStatus
  lastConfirmedDate: string | null
  confirmedCount: number
  createdAt: string
}

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export interface BudgetDto {
  id: string
  categoryId: string
  category: CategoryRef | null
  amountMinor: number
  currency: string
  /** null = every month; 'YYYY-MM' = that month only. */
  month: string | null
  active: boolean
  // Computed for the requested month
  spentMinor: number
  remainingMinor: number
  percent: number
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------

export interface ReportSummary {
  currency: string
  startDate: string
  endDate: string
  incomeMinor: number
  expenseMinor: number
  netMinor: number
  transactionCount: number
  /** expected (not yet paid) in same period */
  upcomingInstallmentsMinor: number
  expectedRecurringMinor: number
}

export interface CategoryBreakdownRow {
  categoryId: string | null
  name: string
  icon: string | null
  color: string | null
  amountMinor: number
  count: number
  percent: number
}

export interface TrendPoint {
  bucket: string // YYYY-MM-DD or YYYY-MM
  incomeMinor: number
  expenseMinor: number
}

export interface PaymentMethodBreakdownRow {
  paymentMethodId: string | null
  name: string
  type: PaymentMethodType | null
  expenseMinor: number
  incomeMinor: number
  count: number
  percent: number
}

export interface MerchantBreakdownRow {
  merchantId: string | null
  name: string
  amountMinor: number
  count: number
  percent: number
}

export interface InstallmentReport {
  currency: string
  paidMinor: number
  paidCount: number
  upcomingMinor: number
  upcomingCount: number
  lateMinor: number
  lateCount: number
  items: InstallmentCalendarItem[]
}

export interface RecurringReport {
  currency: string
  expectedMinor: number
  expectedCount: number
  confirmedMinor: number
  confirmedCount: number
  rows: {
    recurringId: string
    name: string
    dueDate: string
    expectedAmountMinor: number
    confirmed: boolean
    actualAmountMinor: number | null
    type: 'income' | 'expense'
  }[]
}

// ---------------------------------------------------------------------------
// Insights
// ---------------------------------------------------------------------------

export type InsightTone = 'positive' | 'neutral' | 'warning'

export interface InsightDto {
  id: string
  tone: InsightTone
  icon: string
  title: string
  body: string
}

// ---------------------------------------------------------------------------
// AI
// ---------------------------------------------------------------------------

export interface AISettingsDto {
  configured: boolean
  provider: AIProviderName | null
  model: string | null
  keyMasked: string | null
  updatedAt: string | null
}

export interface AIAnalysisResult {
  id: string
  month: string
  provider: AIProviderName
  model: string
  content: string
  createdAt: string
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export interface DashboardData {
  month: string
  summary: ReportSummary
  recentTransactions: TransactionDto[]
  upcomingInstallments: InstallmentCalendarItem[]
  upcomingRecurring: RecurringReport['rows']
  budgets: BudgetDto[]
  insights: InsightDto[]
}

// ---------------------------------------------------------------------------
// Import / Export
// ---------------------------------------------------------------------------

export interface ImportRowPreview {
  row: number
  valid: boolean
  errors: string[]
  data: {
    type: TransactionType
    amountMinor: number
    currency: string
    date: string
    time: string | null
    categoryName: string | null
    paymentMethodName: string | null
    toPaymentMethodName: string | null
    merchantName: string | null
    note: string | null
  } | null
}

export interface ImportPreviewResponse {
  token: string
  fileName: string
  totalRows: number
  validRows: number
  invalidRows: number
  rows: ImportRowPreview[]
  newCategories: string[]
  newPaymentMethods: string[]
  newMerchants: string[]
}

export interface ImportCommitResponse {
  imported: number
  skipped: number
  createdCategories: number
  createdPaymentMethods: number
  createdMerchants: number
}
