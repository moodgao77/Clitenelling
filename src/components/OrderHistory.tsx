import type { Order } from '@/lib/types';

const fmt = (n: number, currency: string) =>
  new Intl.NumberFormat('en-AE', { style: 'currency', currency }).format(n);

const day = (iso: string) =>
  new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Read-only mirror of Shopify orders. This tool never writes to Shopify. */
export default function OrderHistory({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return <p className="text-sm text-neutral-500">No purchases yet.</p>;
  }
  const total = orders.reduce((sum, o) => sum + Number(o.total), 0);
  const currency = orders[0]?.currency ?? 'AED';

  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-neutral-500">
        {orders.length} {orders.length === 1 ? 'order' : 'orders'} · lifetime {fmt(total, currency)}
      </p>
      <ul className="flex flex-col gap-2">
        {orders.map((o) => (
          <li
            key={o.id}
            className="rounded-xl border border-neutral-200 p-3 dark:border-neutral-800"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">{o.order_number}</span>
              <span className="text-sm">{fmt(Number(o.total), o.currency)}</span>
            </div>
            <p className="mt-0.5 text-xs text-neutral-400">{day(o.ordered_at)}</p>
            {o.line_items?.length > 0 && (
              <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-300" dir="auto">
                {o.line_items.map((li) => li.title).join(', ')}
              </p>
            )}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-neutral-400">Read-only from Shopify.</p>
    </div>
  );
}
