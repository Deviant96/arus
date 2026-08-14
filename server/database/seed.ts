/**
 * Development seed: a demo account with ~4 months of realistic activity.
 *   email: demo@arus.app
 *   password: demo1234
 *
 * Run: npm run db:seed
 */
import { eq } from 'drizzle-orm'
import { runMigrations } from './migrate'
import { useDb } from './client'
import { categories, merchants, paymentMethods, users } from './schema'
import { hashUserPassword } from '../utils/password'
import { bootstrapUserDefaults } from '../services/users'
import { createTransaction } from '../services/transactions'
import { createInstallment, recordInstallmentPayment, getInstallmentDetail } from '../services/installments'
import { confirmRecurring, createRecurring } from '../services/recurring'
import { createBudget } from '../services/budgets'
import { addDays, addMonthsClamped, todayInTz } from '../../shared/utils/dates'
import { favorites } from './schema'

// Deterministic RNG so the demo data is stable
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

async function seed() {
  await runMigrations()
  const db = await useDb()
  const rand = mulberry32(42)
  const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)]!

  // Fresh demo user
  const [existing] = await db.select().from(users).where(eq(users.email, 'demo@arus.app')).limit(1)
  if (existing) {
    console.log('Demo user already exists — deleting and reseeding…')
    await db.delete(users).where(eq(users.id, existing.id))
  }

  const [user] = await db.insert(users).values({
    name: 'Demo User',
    email: 'demo@arus.app',
    passwordHash: await hashUserPassword('demo1234'),
    preferredCurrency: 'IDR',
    timezone: 'Asia/Jakarta',
  }).returning()
  const u = user!
  console.log('Created demo user', u.email)

  await bootstrapUserDefaults(db, u.id)

  // Extra payment methods
  const pmDefs = [
    { name: 'BCA', type: 'bank' as const },
    { name: 'Mandiri', type: 'bank' as const },
    { name: 'GoPay', type: 'e_wallet' as const },
    { name: 'OVO', type: 'e_wallet' as const },
    { name: 'ShopeePay', type: 'e_wallet' as const },
    { name: 'BCA Credit Card', type: 'credit_card' as const },
  ]
  await db.insert(paymentMethods).values(pmDefs.map((p, i) => ({ userId: u.id, ...p, currency: 'IDR', sortOrder: i + 1 })))

  const pms = await db.select().from(paymentMethods).where(eq(paymentMethods.userId, u.id))
  const cats = await db.select().from(categories).where(eq(categories.userId, u.id))
  const pm = (name: string) => pms.find(p => p.name === name)!.id
  const cat = (name: string) => cats.find(c => c.name === name)!.id

  // Default payment method preference
  await db.update(users).set({ defaultPaymentMethodId: pm('BCA'), defaultCategoryId: cat('Food & Drinks') }).where(eq(users.id, u.id))

  // Merchants
  const merchantDefs: [string, string][] = [
    ['Starbucks', 'Food & Drinks'],
    ['Kopi Kenangan', 'Food & Drinks'],
    ['McDonald\'s', 'Food & Drinks'],
    ['Warteg Bahari', 'Food & Drinks'],
    ['Indomaret', 'Shopping'],
    ['Alfamart', 'Shopping'],
    ['Tokopedia', 'Shopping'],
    ['Shopee', 'Shopping'],
    ['Grab', 'Transportation'],
    ['Gojek', 'Transportation'],
    ['Pertamina', 'Transportation'],
    ['PLN', 'Bills'],
    ['Telkomsel', 'Bills'],
    ['Netflix', 'Subscription'],
    ['Spotify', 'Subscription'],
    ['Guardian', 'Health'],
  ]
  await db.insert(merchants).values(merchantDefs.map(([name, catName]) => ({
    userId: u.id,
    name,
    normalizedName: name.toLowerCase(),
    defaultCategoryId: cat(catName),
  })))
  const merchRows = await db.select().from(merchants).where(eq(merchants.userId, u.id))
  const merch = (name: string) => merchRows.find(m => m.name === name)!.id

  const today = todayInTz('Asia/Jakarta')
  const svc = { id: u.id, timezone: 'Asia/Jakarta', preferredCurrency: 'IDR' }

  // ------------------------------------------------------------------
  // ~4 months of daily expenses
  // ------------------------------------------------------------------
  const start = addMonthsClamped(today, -4)
  const foodSpots = [
    { m: 'Starbucks', min: 38, max: 65 },
    { m: 'Kopi Kenangan', min: 18, max: 30 },
    { m: 'McDonald\'s', min: 35, max: 75 },
    { m: 'Warteg Bahari', min: 12, max: 25 },
  ]
  const walletFor = (m: string) => (m === 'Grab' || m === 'Gojek' ? pick(['GoPay', 'OVO']) : pick(['BCA', 'GoPay', 'Cash', 'ShopeePay']))

  let d = start
  let txCount = 0
  while (d <= today) {
    const dow = new Date(`${d}T00:00:00Z`).getUTCDay()
    // 1-3 food/drink purchases per day
    const meals = 1 + Math.floor(rand() * (dow === 0 || dow === 6 ? 3 : 2))
    for (let i = 0; i < meals; i++) {
      const spot = pick(foodSpots)
      const amount = (spot.min + Math.floor(rand() * (spot.max - spot.min))) * 1000
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: amount, currency: 'IDR', date: d,
        time: `${String(8 + i * 5 + Math.floor(rand() * 3)).padStart(2, '0')}:${String(Math.floor(rand() * 60)).padStart(2, '0')}`,
        categoryId: cat('Food & Drinks'), paymentMethodId: pm(walletFor(spot.m)), merchantId: merch(spot.m),
      } as never)
      txCount++
    }
    // Transport on weekdays
    if (dow >= 1 && dow <= 5 && rand() < 0.8) {
      const m = pick(['Grab', 'Gojek'])
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: (15 + Math.floor(rand() * 35)) * 1000, currency: 'IDR', date: d, time: '08:15',
        categoryId: cat('Transportation'), paymentMethodId: pm(walletFor(m)), merchantId: merch(m),
      } as never)
      txCount++
    }
    // Occasional shopping / fuel / pharmacy
    if (rand() < 0.25) {
      const m = pick(['Indomaret', 'Alfamart', 'Tokopedia', 'Shopee'])
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: (25 + Math.floor(rand() * 250)) * 1000, currency: 'IDR', date: d, time: '19:30',
        categoryId: cat('Shopping'), paymentMethodId: pm(pick(['BCA', 'ShopeePay', 'BCA Credit Card'])), merchantId: merch(m),
      } as never)
      txCount++
    }
    if (rand() < 0.08) {
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: (50 + Math.floor(rand() * 150)) * 1000, currency: 'IDR', date: d, time: '17:00',
        categoryId: cat('Transportation'), paymentMethodId: pm('BCA'), merchantId: merch('Pertamina'), note: 'Fuel',
      } as never)
      txCount++
    }
    if (rand() < 0.05) {
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: (40 + Math.floor(rand() * 120)) * 1000, currency: 'IDR', date: d, time: '11:00',
        categoryId: cat('Health'), paymentMethodId: pm('Cash'), merchantId: merch('Guardian'),
      } as never)
      txCount++
    }
    d = addDays(d, 1)
  }

  // Monthly salary + bills + a transfer, for each of the last 4 months
  for (let i = 4; i >= 0; i--) {
    const monthDate = addMonthsClamped(today, -i, 25)
    if (monthDate > today) continue
    await createTransaction(db, svc, {
      type: 'income', amountMinor: 14_500_000, currency: 'IDR', date: monthDate, time: '09:00',
      categoryId: cat('Salary'), paymentMethodId: pm('BCA'), note: 'Monthly salary',
    } as never)
    const billDate = addMonthsClamped(today, -i, 5)
    if (billDate <= today) {
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: 450_000, currency: 'IDR', date: billDate, time: '10:00',
        categoryId: cat('Bills'), paymentMethodId: pm('BCA'), merchantId: merch('PLN'), note: 'Electricity',
      } as never)
      await createTransaction(db, svc, {
        type: 'expense', amountMinor: 150_000, currency: 'IDR', date: billDate, time: '10:05',
        categoryId: cat('Bills'), paymentMethodId: pm('BCA'), merchantId: merch('Telkomsel'), note: 'Mobile data',
      } as never)
      await createTransaction(db, svc, {
        type: 'transfer', amountMinor: 1_000_000, currency: 'IDR', date: billDate, time: '10:10',
        fromPaymentMethodId: pm('BCA'), toPaymentMethodId: pm('GoPay'), note: 'Top up e-wallet',
      } as never)
      txCount += 3
    }
  }

  // ------------------------------------------------------------------
  // Installments
  // ------------------------------------------------------------------
  // Laptop: started ~3 months ago, 12 months, one late payment, one partial
  const laptopFirstDue = addMonthsClamped(today, -3, 15)
  const laptop = await createInstallment(db, svc, {
    title: 'MacBook Air M4',
    categoryId: cat('Shopping'),
    paymentMethodId: pm('BCA Credit Card'),
    merchantId: merch('Tokopedia'),
    currency: 'IDR',
    totalAmountMinor: 18_500_000,
    downPaymentMinor: 2_500_000,
    interestMinor: 800_000,
    feesMinor: 100_000,
    count: 12,
    firstDueDate: laptopFirstDue,
    note: 'Office laptop upgrade',
    createDownPaymentTransaction: false,
    parentTransactionId: null,
    dueDay: 15,
    expectedInstallmentMinor: undefined,
  } as never)

  // Pay items: #1 on time, #2 five days late, #3 partial
  const laptopDetail = await getInstallmentDetail(db, svc, laptop.id)
  const [i1, i2, i3] = laptopDetail.items
  if (i1 && i1.dueDate <= today) {
    await recordInstallmentPayment(db, svc, laptop.id, i1.id, {
      amountMinor: i1.expectedAmountMinor, paidDate: i1.dueDate, paidTime: '09:30',
    } as never)
  }
  if (i2 && addDays(i2.dueDate, 5) <= today) {
    await recordInstallmentPayment(db, svc, laptop.id, i2.id, {
      amountMinor: i2.expectedAmountMinor, paidDate: addDays(i2.dueDate, 5), paidTime: '20:15', note: 'Paid late — travelling',
    } as never)
  }
  if (i3 && i3.dueDate <= today) {
    await recordInstallmentPayment(db, svc, laptop.id, i3.id, {
      amountMinor: Math.round(i3.expectedAmountMinor * 0.55), paidDate: i3.dueDate, paidTime: '13:00', note: 'Partial — rest next week',
    } as never)
  }

  // Phone: started last month, 6 months, first payment made early
  const phoneFirstDue = addMonthsClamped(today, -1, 28)
  const phone = await createInstallment(db, svc, {
    title: 'iPhone 17',
    categoryId: cat('Shopping'),
    paymentMethodId: pm('BCA'),
    merchantId: merch('Shopee'),
    currency: 'IDR',
    totalAmountMinor: 13_000_000,
    downPaymentMinor: 4_000_000,
    interestMinor: 0,
    feesMinor: 0,
    count: 6,
    firstDueDate: phoneFirstDue,
    createDownPaymentTransaction: false,
    parentTransactionId: null,
    dueDay: 28,
    note: null,
    expectedInstallmentMinor: undefined,
  } as never)
  const phoneDetail = await getInstallmentDetail(db, svc, phone.id)
  const p1 = phoneDetail.items[0]
  if (p1 && p1.dueDate <= today) {
    await recordInstallmentPayment(db, svc, phone.id, p1.id, {
      amountMinor: p1.expectedAmountMinor, paidDate: addDays(p1.dueDate, -3), paidTime: '08:00', note: 'Paid early',
    } as never)
  }

  // ------------------------------------------------------------------
  // Recurring rules
  // ------------------------------------------------------------------
  const netflix = await createRecurring(db, svc, {
    name: 'Netflix', type: 'expense', amountMinor: 186_000, currency: 'IDR',
    categoryId: cat('Subscription'), paymentMethodId: pm('BCA Credit Card'), merchantId: merch('Netflix'),
    frequency: 'monthly', startDate: addMonthsClamped(today, -3, 3), note: 'Premium plan',
  } as never)
  const spotify = await createRecurring(db, svc, {
    name: 'Spotify', type: 'expense', amountMinor: 65_000, currency: 'IDR',
    categoryId: cat('Subscription'), paymentMethodId: pm('GoPay'), merchantId: merch('Spotify'),
    frequency: 'monthly', startDate: addMonthsClamped(today, -3, 10), note: null,
  } as never)
  await createRecurring(db, svc, {
    name: 'Internet (IndiHome)', type: 'expense', amountMinor: 385_000, currency: 'IDR',
    categoryId: cat('Bills'), paymentMethodId: pm('BCA'), merchantId: null,
    frequency: 'monthly', startDate: addMonthsClamped(today, 0, 20) <= today ? addMonthsClamped(today, 1, 20) : addMonthsClamped(today, 0, 20), note: null,
  } as never)
  await createRecurring(db, svc, {
    name: 'Apartment rent', type: 'expense', amountMinor: 3_200_000, currency: 'IDR',
    categoryId: cat('Bills'), paymentMethodId: pm('Mandiri'), merchantId: null,
    frequency: 'monthly', startDate: addMonthsClamped(today, 0, 1) <= today ? addMonthsClamped(today, 1, 1) : addMonthsClamped(today, 0, 1), note: null,
  } as never)

  // Confirm a few past occurrences so expected-vs-actual has history
  for (const rule of [netflix, spotify]) {
    let due = rule.nextDueDate
    let guard = 0
    while (due <= today && guard < 6) {
      const updated = await confirmRecurring(db, svc, rule.id, {
        dueDate: due, amountMinor: rule.amountMinor, date: due, time: '07:00',
      } as never)
      due = updated.nextDueDate
      guard++
    }
  }

  // ------------------------------------------------------------------
  // Budgets & favorites
  // ------------------------------------------------------------------
  await createBudget(db, svc, { categoryId: cat('Food & Drinks'), amountMinor: 2_500_000, month: null })
  await createBudget(db, svc, { categoryId: cat('Transportation'), amountMinor: 1_000_000, month: null })
  await createBudget(db, svc, { categoryId: cat('Shopping'), amountMinor: 2_000_000, month: null })
  await createBudget(db, svc, { categoryId: cat('Subscription'), amountMinor: 300_000, month: null })

  await db.insert(favorites).values([
    { userId: u.id, name: 'Morning Coffee', type: 'expense' as const, amountMinor: 25_000, currency: 'IDR', categoryId: cat('Food & Drinks'), paymentMethodId: pm('GoPay'), merchantId: merch('Kopi Kenangan'), sortOrder: 0 },
    { userId: u.id, name: 'Commute', type: 'expense' as const, amountMinor: 24_000, currency: 'IDR', categoryId: cat('Transportation'), paymentMethodId: pm('GoPay'), merchantId: merch('Gojek'), sortOrder: 1 },
    { userId: u.id, name: 'Lunch warteg', type: 'expense' as const, amountMinor: 18_000, currency: 'IDR', categoryId: cat('Food & Drinks'), paymentMethodId: pm('Cash'), merchantId: merch('Warteg Bahari'), sortOrder: 2 },
  ])

  console.log(`Seed complete: ~${txCount} transactions, 2 installments, 4 recurring rules, 4 budgets.`)
  console.log('Login with demo@arus.app / demo1234')
}

seed().then(() => process.exit(0)).catch((e) => {
  console.error(e)
  process.exit(1)
})
