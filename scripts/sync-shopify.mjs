// Shopify sync — READ-ONLY, one-directional. Pulls customers + order history
// FROM Shopify INTO the tool. Never writes back to Shopify (only GET requests).
//
// Run: npm run sync:shopify   (loads .env.local via --env-file)
// Requires: SHOPIFY_STORE_DOMAIN, SHOPIFY_ADMIN_TOKEN in .env.local
//   (optional) SHOPIFY_API_VERSION  — defaults to 2024-10
//
// Identity rule: match/merge on normalized phone. Stage from order history
// (>=1 order => purchased, else uncontacted). All records arrive Unassigned.

import { createClient } from '@supabase/supabase-js';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

const {
  NEXT_PUBLIC_SUPABASE_URL: SB_URL,
  SUPABASE_SERVICE_ROLE_KEY: SB_KEY,
  SHOPIFY_STORE_DOMAIN: DOMAIN,
  SHOPIFY_CLIENT_ID: CLIENT_ID,
  SHOPIFY_CLIENT_SECRET: CLIENT_SECRET,
  SHOPIFY_API_VERSION: VERSION = '2024-10',
} = process.env;

if (!SB_URL || !SB_KEY) {
  console.error('Missing Supabase env. Check .env.local.');
  process.exit(1);
}
if (!DOMAIN || !CLIENT_ID || !CLIENT_SECRET) {
  console.error('Missing SHOPIFY_STORE_DOMAIN / SHOPIFY_CLIENT_ID / SHOPIFY_CLIENT_SECRET.');
  process.exit(1);
}

const db = createClient(SB_URL, SB_KEY, { auth: { persistSession: false } });
const base = `https://${DOMAIN}/admin/api/${VERSION}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Dev Dashboard apps: exchange Client ID + Secret for a short-lived (24h)
// Admin API access token via the client-credentials grant. GET only after.
let TOKEN = null;
async function getToken() {
  const res = await fetch(`https://${DOMAIN}/admin/oauth/access_token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('Token exchange failed: ' + JSON.stringify(j));
  TOKEN = j.access_token;
  return j.scope || '(no scopes granted — approve read_customers & read_orders on the app)';
}

function normalizePhone(raw) {
  const p = parsePhoneNumberFromString((raw ?? '').trim(), 'AE');
  return p && p.isValid() ? p.number : null;
}

// GET with cursor pagination via the Link header. GET only — never mutates Shopify.
async function shopifyGet(path) {
  const res = await fetch(`${base}${path}`, {
    headers: { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) {
    await sleep(2000);
    return shopifyGet(path);
  }
  if (!res.ok) throw new Error(`Shopify GET ${path} -> ${res.status} ${await res.text()}`);
  const link = res.headers.get('link') || '';
  const next = /<[^>]*[?&]page_info=([^>&]+)[^>]*>;\s*rel="next"/.exec(link)?.[1] ?? null;
  return { body: await res.json(), next };
}

async function fetchAllCustomers() {
  const out = [];
  let path = '/customers.json?limit=250';
  for (;;) {
    const { body, next } = await shopifyGet(path);
    out.push(...(body.customers ?? []));
    if (!next) break;
    path = `/customers.json?limit=250&page_info=${next}`;
    await sleep(400); // stay under REST rate limits
  }
  return out;
}

async function fetchOrders(customerId) {
  const out = [];
  let path = `/orders.json?status=any&limit=250&customer_id=${customerId}`;
  for (;;) {
    const { body, next } = await shopifyGet(path);
    out.push(...(body.orders ?? []));
    if (!next) break;
    path = `/orders.json?status=any&limit=250&customer_id=${customerId}&page_info=${next}`;
    await sleep(400);
  }
  return out;
}

async function main() {
  console.log(`\nSyncing (READ-ONLY) from ${DOMAIN} …`);
  const scope = await getToken();
  console.log(`Granted scopes: ${scope}\n`);
  const { data: logRow } = await db
    .from('shopify_sync_log')
    .insert({ status: 'running' })
    .select()
    .single();

  let pulledCustomers = 0;
  let pulledOrders = 0;
  let skippedNoPhone = 0;
  let created = 0;
  let merged = 0;

  try {
    const customers = await fetchAllCustomers();
    for (const c of customers) {
      const rawPhone = c.phone || c.default_address?.phone || c.addresses?.[0]?.phone || '';
      const phone = normalizePhone(rawPhone);
      if (!phone) {
        skippedNoPhone++;
        continue;
      }
      pulledCustomers++;
      const fullName = [c.first_name, c.last_name].filter(Boolean).join(' ').trim();
      const hasOrders = (c.orders_count ?? 0) > 0;

      const { data: existing } = await db
        .from('people')
        .select('id, full_name')
        .eq('phone_e164', phone)
        .maybeSingle();

      let personId;
      if (existing) {
        // Merge: fill a blank name, link the Shopify id. Never clobber the
        // associate's owner or stage.
        await db
          .from('people')
          .update({
            full_name: existing.full_name || fullName,
            shopify_customer_id: String(c.id),
          })
          .eq('id', existing.id);
        personId = existing.id;
        merged++;
      } else {
        const { data: inserted, error } = await db
          .from('people')
          .insert({
            full_name: fullName,
            phone_e164: phone,
            phone_raw: rawPhone,
            source: 'shopify',
            owner_id: null, // Unassigned — Shopify has no associate
            stage: hasOrders ? 'purchased' : 'uncontacted',
            shopify_customer_id: String(c.id),
          })
          .select('id')
          .single();
        if (error) {
          // Likely a duplicate shopify_customer_id from a prior run — skip.
          continue;
        }
        personId = inserted.id;
        created++;
      }

      if (hasOrders) {
        const orders = await fetchOrders(c.id);
        for (const o of orders) {
          pulledOrders++;
          await db.from('orders').upsert(
            {
              person_id: personId,
              shopify_order_id: String(o.id),
              order_number: o.name ?? `#${o.order_number ?? o.id}`,
              total: Number(o.total_price ?? 0),
              currency: o.currency ?? 'AED',
              ordered_at: o.created_at,
              line_items: (o.line_items ?? []).map((li) => ({
                title: li.title,
                qty: li.quantity,
                price: Number(li.price ?? 0),
              })),
            },
            { onConflict: 'shopify_order_id' },
          );
        }
      }
    }

    await db
      .from('shopify_sync_log')
      .update({
        finished_at: new Date().toISOString(),
        customers_pulled: pulledCustomers,
        orders_pulled: pulledOrders,
        status: 'done',
      })
      .eq('id', logRow.id);

    console.log('Done:', { pulledCustomers, pulledOrders, created, merged, skippedNoPhone });
  } catch (e) {
    await db
      .from('shopify_sync_log')
      .update({ finished_at: new Date().toISOString(), status: 'error', error: String(e) })
      .eq('id', logRow.id);
    throw e;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
