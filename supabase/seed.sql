-- =============================================================
-- Zenqar Seed Data
-- Sample data for development and demonstration
-- =============================================================

-- NOTE: Run this AFTER the migrations and AFTER creating a real
-- user through Supabase Auth. Replace the UUIDs below with actual
-- user IDs from auth.users.

-- The seed script uses variables for clarity.
-- In Supabase SQL Editor, run sections individually.

-- =============================================================
-- 1. Platform Admin User
-- After signing up, run this to elevate a user to platform admin:
-- =============================================================

-- Replace with real user ID from auth.users
-- insert into platform_admins (user_id, notes)
-- values ('YOUR_ADMIN_USER_ID', 'Initial platform admin');

-- =============================================================
-- 2. Sample Businesses
-- =============================================================

insert into businesses (
  id, name, legal_name, email, phone,
  address_line1, city, country,
  invoice_prefix, default_currency, default_language,
  created_at
) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Al-Rashid Trading Co.',
  'Al-Rashid General Trading LLC',
  'info@alrashid.iq',
  '+964 770 123 4567',
  '14 Karada Street',
  'Baghdad',
  'Iraq',
  'ART', 'IQD', 'ar',
  now() - interval '60 days'
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Kurdish Tech Solutions',
  'Kurdish Tech Solutions Ltd.',
  'hello@kurdishtech.com',
  '+964 750 987 6543',
  '7 Gulan Street',
  'Erbil',
  'Iraq',
  'KTS', 'USD', 'ku',
  now() - interval '30 days'
);

-- =============================================================
-- 3. Business Settings
-- (Auto-created by trigger but we can customize here)
-- =============================================================

update business_settings set
  invoice_due_days         = 30,
  invoice_footer_note      = 'Thank you for your business!',
  invoice_tax_label        = 'VAT',
  payout_bank_name         = 'Rasheed Bank',
  payout_account_name      = 'Al-Rashid Trading Co.',
  payout_account_number    = '****4521'
where business_id = 'a1b2c3d4-0001-0001-0001-000000000001';

update business_settings set
  invoice_due_days      = 14,
  invoice_footer_note   = 'Payment via bank transfer or cash.',
  payout_bank_name      = 'Kurdistan International Bank',
  payout_account_name   = 'Kurdish Tech Solutions',
  payout_account_number = '****8833'
where business_id = 'a1b2c3d4-0002-0002-0002-000000000002';

-- =============================================================
-- 4. Contacts
-- =============================================================

insert into contacts (
  id, business_id, type, name, company_name, email, phone, address, city
) values
-- Al-Rashid customers
(
  'c0000001-0000-0000-0000-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'customer', 'Mohammed Al-Saadi', 'Saadi Imports',
  'msaadi@saadi-imports.iq', '+964 771 111 2222', '22 Commercial Street', 'Baghdad'
),
(
  'c0000001-0000-0000-0000-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'customer', 'Noor Khalil', NULL,
  'noor.k@gmail.com', '+964 780 333 4444', '5 Mansour District', 'Baghdad'
),
(
  'c0000001-0000-0000-0000-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'supplier', 'Global Supplies FZCO', 'Global Supplies FZCO',
  'contact@globalsupplies.ae', '+971 4 123 4567', 'Jebel Ali Free Zone', 'Dubai'
),
-- Kurdish Tech customers
(
  'c0000002-0000-0000-0000-000000000001',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'customer', 'Sardar Ahmed', 'Erbil Startups Inc',
  'sardar@erbilstartups.com', '+964 750 555 6666', '12 Ankawa Road', 'Erbil'
),
(
  'c0000002-0000-0000-0000-000000000002',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'customer', 'Shirin Hassan', NULL,
  'shirin.h@email.com', '+964 751 777 8888', '3 Sulaymaniyah Center', 'Sulaymaniyah'
);

-- =============================================================
-- 5. Accounts
-- =============================================================

insert into accounts (id, business_id, name, account_type, currency, display_detail, bank_name) values
-- Al-Rashid accounts
(
  'acc00001-0000-0000-0000-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Cash IQD', 'cash', 'IQD', null, null
),
(
  'acc00001-0000-0000-0000-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Rasheed Bank IQD', 'bank', 'IQD', '****4521', 'Rasheed Bank'
),
(
  'acc00001-0000-0000-0000-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'Cash USD', 'cash', 'USD', null, null
),
-- Kurdish Tech accounts
(
  'acc00002-0000-0000-0000-000000000001',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Cash USD', 'cash', 'USD', null, null
),
(
  'acc00002-0000-0000-0000-000000000002',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'KIB USD Account', 'bank', 'USD', '****8833', 'Kurdistan International Bank'
),
(
  'acc00002-0000-0000-0000-000000000003',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'Cash IQD', 'cash', 'IQD', null, null
);

-- =============================================================
-- 6. Opening Balances (via money_transactions)
-- =============================================================

insert into money_transactions (
  business_id, account_id, type, amount, currency,
  description, transaction_date
) values
-- Al-Rashid
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'opening_balance', 5000000, 'IQD', 'Opening balance', current_date - 60
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000002',
  'opening_balance', 15000000, 'IQD', 'Opening balance', current_date - 60
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000003',
  'opening_balance', 2000, 'USD', 'Opening balance', current_date - 60
),
-- Kurdish Tech
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'acc00002-0000-0000-0000-000000000001',
  'opening_balance', 5000, 'USD', 'Opening balance', current_date - 30
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'acc00002-0000-0000-0000-000000000002',
  'opening_balance', 20000, 'USD', 'Opening balance', current_date - 30
);

-- =============================================================
-- 7. Invoices
-- =============================================================

insert into invoices (
  id, business_id, invoice_number, contact_id, status, currency,
  issue_date, due_date, subtotal, total, amount_paid,
  verification_token, notes
) values
-- Al-Rashid Invoice 1 (paid)
(
  'inv00001-0000-0000-0000-000000000001',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'ART-2026-0001',
  'c0000001-0000-0000-0000-000000000001',
  'paid', 'IQD',
  current_date - 45, current_date - 15,
  2500000, 2500000, 2500000,
  'verify-tok-0001-paid-alrashid-inv001',
  'Office supplies and stationery'
),
-- Al-Rashid Invoice 2 (partially paid)
(
  'inv00001-0000-0000-0000-000000000002',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'ART-2026-0002',
  'c0000001-0000-0000-0000-000000000002',
  'partially_paid', 'IQD',
  current_date - 20, current_date + 10,
  1800000, 1800000, 900000,
  'verify-tok-0002-partial-alrashid-inv002',
  'Consulting services Q1'
),
-- Al-Rashid Invoice 3 (overdue)
(
  'inv00001-0000-0000-0000-000000000003',
  'a1b2c3d4-0001-0001-0001-000000000001',
  'ART-2026-0003',
  'c0000001-0000-0000-0000-000000000001',
  'overdue', 'IQD',
  current_date - 50, current_date - 20,
  3200000, 3200000, 0,
  'verify-tok-0003-overdue-alrashid-inv003',
  null
),
-- Kurdish Tech Invoice 1 (issued)
(
  'inv00002-0000-0000-0000-000000000001',
  'a1b2c3d4-0002-0002-0002-000000000002',
  'KTS-2026-0001',
  'c0000002-0000-0000-0000-000000000001',
  'issued', 'USD',
  current_date - 5, current_date + 25,
  1500, 1500, 0,
  'verify-tok-0004-issued-kurdishtech-inv001',
  'Web development services'
);

-- =============================================================
-- 8. Invoice Items
-- =============================================================

insert into invoice_items (invoice_id, business_id, description, quantity, unit_price, sort_order) values
-- Invoice 1 items
('inv00001-0000-0000-0000-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'A4 Paper Reams (Box of 5)', 10, 125000, 0),
('inv00001-0000-0000-0000-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'Pens and Markers Set', 5, 50000, 1),
('inv00001-0000-0000-0000-000000000001', 'a1b2c3d4-0001-0001-0001-000000000001', 'File Folders (Pack of 20)', 25, 60000, 2),
-- Invoice 2 items
('inv00001-0000-0000-0000-000000000002', 'a1b2c3d4-0001-0001-0001-000000000001', 'Financial Consulting (Hours)', 12, 150000, 0),
-- Invoice 3 items
('inv00001-0000-0000-0000-000000000003', 'a1b2c3d4-0001-0001-0001-000000000001', 'Industrial Equipment Rental', 2, 1600000, 0),
-- KTS Invoice 1
('inv00002-0000-0000-0000-000000000001', 'a1b2c3d4-0002-0002-0002-000000000002', 'Website Design & Development', 1, 1200, 0),
('inv00002-0000-0000-0000-000000000001', 'a1b2c3d4-0002-0002-0002-000000000002', 'Hosting Setup (1 Year)', 1, 300, 1);

-- =============================================================
-- 9. Payments
-- =============================================================

insert into payments (
  business_id, invoice_id, account_id, amount, currency, payment_date, reference, note
) values
-- Payment for Invoice 1 (full)
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'inv00001-0000-0000-0000-000000000001',
  'acc00001-0000-0000-0000-000000000002',
  2500000, 'IQD', current_date - 15, 'TRF-2026-441', 'Full payment received'
),
-- Partial payment for Invoice 2
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'inv00001-0000-0000-0000-000000000002',
  'acc00001-0000-0000-0000-000000000001',
  900000, 'IQD', current_date - 5, null, 'Cash deposit, first installment'
);

-- Payment money transactions
insert into money_transactions (
  business_id, account_id, type, amount, currency,
  description, transaction_date
) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000002',
  'payment_received', 2500000, 'IQD',
  'Payment for ART-2026-0001', current_date - 15
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'payment_received', 900000, 'IQD',
  'Partial payment for ART-2026-0002', current_date - 5
);

-- =============================================================
-- 10. Expenses
-- =============================================================

insert into expenses (
  business_id, account_id, category, description, amount, currency, expense_date
) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'Utilities', 'Monthly electricity bill', 250000, 'IQD', current_date - 10
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'Transport', 'Delivery fuel expense', 75000, 'IQD', current_date - 5
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'acc00002-0000-0000-0000-000000000001',
  'Software', 'Monthly SaaS tools subscription', 150, 'USD', current_date - 3
);

-- Expense money transactions
insert into money_transactions (
  business_id, account_id, type, amount, currency, description, transaction_date
) values
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'expense_paid', -250000, 'IQD', 'Monthly electricity bill', current_date - 10
),
(
  'a1b2c3d4-0001-0001-0001-000000000001',
  'acc00001-0000-0000-0000-000000000001',
  'expense_paid', -75000, 'IQD', 'Delivery fuel expense', current_date - 5
),
(
  'a1b2c3d4-0002-0002-0002-000000000002',
  'acc00002-0000-0000-0000-000000000001',
  'expense_paid', -150, 'USD', 'Monthly SaaS tools subscription', current_date - 3
);

-- =============================================================
-- 11. FX Rate Snapshot
-- =============================================================

insert into fx_rate_snapshots (from_currency, to_currency, rate, source)
values ('USD', 'IQD', 1310.00, 'mock');

-- Update businesses to have correct sequence after seed
update businesses set invoice_sequence = 3 where id = 'a1b2c3d4-0001-0001-0001-000000000001';
update businesses set invoice_sequence = 1 where id = 'a1b2c3d4-0002-0002-0002-000000000002';
