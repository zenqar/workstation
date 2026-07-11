import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function csvCell(value: unknown) {
  let text = value == null ? '' : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  const businessId = new URL(request.url).searchParams.get('businessId');
  if (!businessId) return Response.json({ error: 'Missing businessId' }, { status: 400 });
  const { data: membership } = await supabase.from('business_memberships').select('id').eq('business_id', businessId).eq('user_id', user.id).eq('status', 'active').maybeSingle();
  if (!membership) return Response.json({ error: 'Access denied' }, { status: 403 });

  const { data, error } = await supabase.from('money_transactions').select('transaction_date,type,description,amount,currency,fx_rate_used,reference_table,reference_id,account:accounts(name)').eq('business_id', businessId).order('transaction_date', { ascending: false });
  if (error) return Response.json({ error: 'Could not export transactions' }, { status: 500 });
  const header = ['Date', 'Type', 'Description', 'Account', 'Amount', 'Currency', 'FX rate', 'Reference type', 'Reference ID'];
  const rows = (data || []).map(row => {
    const account = row.account as unknown as { name?: string } | Array<{ name?: string }> | null;
    const accountName = Array.isArray(account) ? account[0]?.name : account?.name;
    return [row.transaction_date, row.type, row.description, accountName, row.amount, row.currency, row.fx_rate_used, row.reference_table, row.reference_id];
  });
  const csv = [header, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n');
  const filename = `zenqar-transactions-${new Date().toISOString().slice(0, 10)}.csv`;
  return new Response(`\uFEFF${csv}`, { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'no-store' } });
}
