import type { AnyPgColumn } from 'drizzle-orm/pg-core'
import { bigint, boolean, date, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const transactionTypeEnum = pgEnum('transaction_type', ['income', 'expense', 'transfer'])
export const paymentMethodTypeEnum = pgEnum('payment_method_type', ['cash', 'bank', 'e_wallet', 'credit_card', 'paylater', 'other'])
export const installmentStatusEnum = pgEnum('installment_status', ['active', 'completed'])
/** `late` is intentionally NOT stored — it is derived from due date vs today. */
export const installmentItemStatusEnum = pgEnum('installment_item_status', ['upcoming', 'partially_paid', 'paid', 'skipped'])
export const recurrenceFrequencyEnum = pgEnum('recurrence_frequency', ['weekly', 'monthly', 'quarterly', 'yearly'])
export const aiProviderEnum = pgEnum('ai_provider', ['openai', 'gemini'])
export const recurringTypeEnum = pgEnum('recurring_type', ['income', 'expense'])

const timestamps = {
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}

// ---------------------------------------------------------------------------
// Users & auth
// ---------------------------------------------------------------------------

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  googleId: text('google_id').unique(),
  avatarUrl: text('avatar_url'),
  preferredCurrency: text('preferred_currency').notNull().default('IDR'),
  timezone: text('timezone').notNull().default('Asia/Jakarta'),
  defaultPaymentMethodId: uuid('default_payment_method_id').references((): AnyPgColumn => paymentMethods.id, { onDelete: 'set null' }),
  defaultCategoryId: uuid('default_category_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
  ...timestamps,
})

export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  usedAt: timestamp('used_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('prt_user_idx').on(t.userId)])

export const aiSettings = pgTable('ai_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  provider: aiProviderEnum('provider').notNull(),
  model: text('model').notNull(),
  /** AES-256-GCM ciphertext (iv:tag:data, base64) — never returned to clients. */
  encryptedKey: text('encrypted_key').notNull(),
  keyLast4: text('key_last4').notNull(),
  ...timestamps,
})

// ---------------------------------------------------------------------------
// Reference entities
// ---------------------------------------------------------------------------

export const categories = pgTable('categories', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  icon: text('icon'),
  color: text('color'),
  parentId: uuid('parent_id').references((): AnyPgColumn => categories.id, { onDelete: 'set null' }),
  active: boolean('active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, t => [index('categories_user_idx').on(t.userId, t.active)])

export const paymentMethods = pgTable('payment_methods', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: paymentMethodTypeEnum('type').notNull().default('other'),
  currency: text('currency').notNull().default('IDR'),
  active: boolean('active').notNull().default(true),
  metadata: jsonb('metadata'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, t => [index('payment_methods_user_idx').on(t.userId, t.active)])

export const merchants = pgTable('merchants', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  normalizedName: text('normalized_name').notNull(),
  defaultCategoryId: uuid('default_category_id').references(() => categories.id, { onDelete: 'set null' }),
  ...timestamps,
}, t => [
  uniqueIndex('merchants_user_norm_unique').on(t.userId, t.normalizedName),
])

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

export const transactions = pgTable('transactions', {
  /** Client-generatable UUID (offline-first identity). */
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  type: transactionTypeEnum('type').notNull(),
  /** Always positive; the type decides the direction. */
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('IDR'),
  /** Exact instant (UTC) for ordering. */
  occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
  /** Calendar date/time in the user's timezone at entry — used for all reporting. */
  localDate: date('local_date').notNull(),
  localTime: text('local_time').notNull().default('00:00'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, { onDelete: 'restrict' }),
  fromPaymentMethodId: uuid('from_payment_method_id').references(() => paymentMethods.id, { onDelete: 'restrict' }),
  toPaymentMethodId: uuid('to_payment_method_id').references(() => paymentMethods.id, { onDelete: 'restrict' }),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  note: text('note'),
  tags: jsonb('tags').$type<string[]>(),
  /** Set when this transaction is an actual installment payment. */
  installmentId: uuid('installment_id').references((): AnyPgColumn => installments.id, { onDelete: 'set null' }),
  installmentPaymentId: uuid('installment_payment_id'),
  /** Set when this transaction was confirmed from a recurring rule. */
  recurringId: uuid('recurring_id').references((): AnyPgColumn => recurringRules.id, { onDelete: 'set null' }),
  /** Reserved for future receipt attachments. */
  attachmentId: uuid('attachment_id'),
  ...timestamps,
}, t => [
  index('tx_user_date_idx').on(t.userId, t.localDate),
  index('tx_user_occurred_idx').on(t.userId, t.occurredAt),
  index('tx_user_type_idx').on(t.userId, t.type),
  index('tx_category_idx').on(t.categoryId),
  index('tx_payment_method_idx').on(t.paymentMethodId),
  index('tx_merchant_idx').on(t.merchantId),
  index('tx_installment_idx').on(t.installmentId),
  index('tx_recurring_idx').on(t.recurringId),
])

export const favorites = pgTable('favorites', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: recurringTypeEnum('type').notNull().default('expense'),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('IDR'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'set null' }),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, { onDelete: 'set null' }),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  note: text('note'),
  sortOrder: integer('sort_order').notNull().default(0),
  ...timestamps,
}, t => [index('favorites_user_idx').on(t.userId)])

// ---------------------------------------------------------------------------
// Installments
// ---------------------------------------------------------------------------

export const installments = pgTable('installments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: installmentStatusEnum('status').notNull().default('active'),
  currency: text('currency').notNull().default('IDR'),
  totalAmountMinor: bigint('total_amount_minor', { mode: 'number' }).notNull(),
  downPaymentMinor: bigint('down_payment_minor', { mode: 'number' }).notNull().default(0),
  /** total - down payment */
  principalMinor: bigint('principal_minor', { mode: 'number' }).notNull(),
  interestMinor: bigint('interest_minor', { mode: 'number' }).notNull().default(0),
  feesMinor: bigint('fees_minor', { mode: 'number' }).notNull().default(0),
  count: integer('count').notNull(),
  expectedInstallmentMinor: bigint('expected_installment_minor', { mode: 'number' }).notNull(),
  firstDueDate: date('first_due_date').notNull(),
  /** Anchor day-of-month; months without it clamp to their last day. */
  dueDay: integer('due_day').notNull(),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'restrict' }),
  paymentMethodId: uuid('payment_method_id').notNull().references(() => paymentMethods.id, { onDelete: 'restrict' }),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  note: text('note'),
  /** The purchase / down-payment transaction, if recorded. */
  parentTransactionId: uuid('parent_transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  ...timestamps,
}, t => [
  index('installments_user_idx').on(t.userId, t.status),
])

export const installmentItems = pgTable('installment_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  installmentId: uuid('installment_id').notNull().references(() => installments.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  dueDate: date('due_date').notNull(),
  expectedAmountMinor: bigint('expected_amount_minor', { mode: 'number' }).notNull(),
  /** Denormalized: sum of payments against this item. */
  paidMinor: bigint('paid_minor', { mode: 'number' }).notNull().default(0),
  status: installmentItemStatusEnum('status').notNull().default('upcoming'),
  note: text('note'),
  ...timestamps,
}, t => [
  uniqueIndex('installment_items_seq_unique').on(t.installmentId, t.sequence),
  index('installment_items_user_due_idx').on(t.userId, t.dueDate),
  index('installment_items_status_idx').on(t.installmentId, t.status),
])

export const installmentPayments = pgTable('installment_payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  installmentId: uuid('installment_id').notNull().references(() => installments.id, { onDelete: 'cascade' }),
  itemId: uuid('item_id').notNull().references(() => installmentItems.id, { onDelete: 'cascade' }),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  paidDate: date('paid_date').notNull(),
  paidTime: text('paid_time').notNull().default('00:00'),
  paymentMethodId: uuid('payment_method_id').references(() => paymentMethods.id, { onDelete: 'restrict' }),
  note: text('note'),
  /** The actual expense transaction created for this payment. */
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'set null' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [
  index('installment_payments_item_idx').on(t.itemId),
  index('installment_payments_user_date_idx').on(t.userId, t.paidDate),
])

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

export const recurringRules = pgTable('recurring_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  type: recurringTypeEnum('type').notNull(),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('IDR'),
  categoryId: uuid('category_id').references(() => categories.id, { onDelete: 'restrict' }),
  paymentMethodId: uuid('payment_method_id').notNull().references(() => paymentMethods.id, { onDelete: 'restrict' }),
  merchantId: uuid('merchant_id').references(() => merchants.id, { onDelete: 'set null' }),
  frequency: recurrenceFrequencyEnum('frequency').notNull(),
  startDate: date('start_date').notNull(),
  /** Next expected occurrence (advanced on confirm/skip). */
  nextDueDate: date('next_due_date').notNull(),
  /** Anchor day-of-month (or start weekday for weekly). */
  anchorDay: integer('anchor_day').notNull(),
  active: boolean('active').notNull().default(true),
  note: text('note'),
  lastConfirmedDate: date('last_confirmed_date'),
  ...timestamps,
}, t => [
  index('recurring_user_idx').on(t.userId, t.active, t.nextDueDate),
])

// ---------------------------------------------------------------------------
// Budgets
// ---------------------------------------------------------------------------

export const budgets = pgTable('budgets', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  categoryId: uuid('category_id').notNull().references(() => categories.id, { onDelete: 'cascade' }),
  amountMinor: bigint('amount_minor', { mode: 'number' }).notNull(),
  currency: text('currency').notNull().default('IDR'),
  /** null = recurring monthly budget; 'YYYY-MM' = one specific month. */
  month: text('month'),
  active: boolean('active').notNull().default(true),
  ...timestamps,
}, t => [
  uniqueIndex('budgets_user_cat_month_unique').on(t.userId, t.categoryId, t.month),
  index('budgets_user_idx').on(t.userId, t.active),
])

// ---------------------------------------------------------------------------
// Attachments (schema-ready; upload/OCR is intentionally not a V1 feature)
// ---------------------------------------------------------------------------

export const attachments = pgTable('attachments', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  transactionId: uuid('transaction_id').references(() => transactions.id, { onDelete: 'cascade' }),
  fileName: text('file_name').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  storagePath: text('storage_path').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, t => [index('attachments_tx_idx').on(t.transactionId)])

// ---------------------------------------------------------------------------
// Inferred row types
// ---------------------------------------------------------------------------

export type UserRow = typeof users.$inferSelect
export type CategoryRow = typeof categories.$inferSelect
export type PaymentMethodRow = typeof paymentMethods.$inferSelect
export type MerchantRow = typeof merchants.$inferSelect
export type TransactionRow = typeof transactions.$inferSelect
export type FavoriteRow = typeof favorites.$inferSelect
export type InstallmentRow = typeof installments.$inferSelect
export type InstallmentItemRow = typeof installmentItems.$inferSelect
export type InstallmentPaymentRow = typeof installmentPayments.$inferSelect
export type RecurringRuleRow = typeof recurringRules.$inferSelect
export type BudgetRow = typeof budgets.$inferSelect
