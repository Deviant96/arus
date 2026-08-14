import type { CategoryDto, CategoryRef, FavoriteDto, MerchantDto, MerchantRef, PaymentMethodDto, PaymentMethodRef, TransactionDto, UserDto } from '../../shared/types/api'
import type { CategoryRow, FavoriteRow, MerchantRow, PaymentMethodRow, TransactionRow, UserRow } from '../database/schema'

export function toUserDto(row: UserRow): UserDto {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    avatarUrl: row.avatarUrl,
    preferredCurrency: row.preferredCurrency,
    timezone: row.timezone,
    defaultPaymentMethodId: row.defaultPaymentMethodId,
    defaultCategoryId: row.defaultCategoryId,
    hasPassword: !!row.passwordHash,
    hasGoogle: !!row.googleId,
    createdAt: row.createdAt.toISOString(),
  }
}

export function toCategoryDto(row: CategoryRow): CategoryDto {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    parentId: row.parentId,
    active: row.active,
    isSystem: row.isSystem,
    sortOrder: row.sortOrder,
  }
}

export function toCategoryRef(row: CategoryRow | null | undefined): CategoryRef | null {
  if (!row) return null
  return { id: row.id, name: row.name, icon: row.icon, color: row.color }
}

export function toPaymentMethodDto(row: PaymentMethodRow): PaymentMethodDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    currency: row.currency,
    active: row.active,
    sortOrder: row.sortOrder,
  }
}

export function toPaymentMethodRef(row: PaymentMethodRow | null | undefined): PaymentMethodRef | null {
  if (!row) return null
  return { id: row.id, name: row.name, type: row.type }
}

export function toMerchantDto(row: MerchantRow, extra?: { transactionCount?: number, lastUsedAt?: Date | null }): MerchantDto {
  return {
    id: row.id,
    name: row.name,
    defaultCategoryId: row.defaultCategoryId,
    transactionCount: extra?.transactionCount,
    lastUsedAt: extra?.lastUsedAt ? extra.lastUsedAt.toISOString() : null,
  }
}

export function toMerchantRef(row: MerchantRow | null | undefined): MerchantRef | null {
  if (!row) return null
  return { id: row.id, name: row.name }
}

export interface TransactionJoins {
  category?: CategoryRow | null
  paymentMethod?: PaymentMethodRow | null
  fromPaymentMethod?: PaymentMethodRow | null
  toPaymentMethod?: PaymentMethodRow | null
  merchant?: MerchantRow | null
  installmentTitle?: string | null
}

export function toTransactionDto(row: TransactionRow, joins: TransactionJoins = {}): TransactionDto {
  return {
    id: row.id,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    occurredAt: row.occurredAt.toISOString(),
    date: row.localDate,
    time: row.localTime,
    categoryId: row.categoryId,
    category: toCategoryRef(joins.category),
    paymentMethodId: row.paymentMethodId,
    paymentMethod: toPaymentMethodRef(joins.paymentMethod),
    fromPaymentMethodId: row.fromPaymentMethodId,
    fromPaymentMethod: toPaymentMethodRef(joins.fromPaymentMethod),
    toPaymentMethodId: row.toPaymentMethodId,
    toPaymentMethod: toPaymentMethodRef(joins.toPaymentMethod),
    merchantId: row.merchantId,
    merchant: toMerchantRef(joins.merchant),
    note: row.note,
    tags: Array.isArray(row.tags) ? row.tags : [],
    installmentId: row.installmentId,
    installmentTitle: joins.installmentTitle ?? null,
    recurringId: row.recurringId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

export function toFavoriteDto(row: FavoriteRow, joins: { category?: CategoryRow | null, paymentMethod?: PaymentMethodRow | null, merchant?: MerchantRow | null } = {}): FavoriteDto {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    amountMinor: row.amountMinor,
    currency: row.currency,
    categoryId: row.categoryId,
    category: toCategoryRef(joins.category),
    paymentMethodId: row.paymentMethodId,
    paymentMethod: toPaymentMethodRef(joins.paymentMethod),
    merchantId: row.merchantId,
    merchant: toMerchantRef(joins.merchant),
    note: row.note,
    sortOrder: row.sortOrder,
  }
}
