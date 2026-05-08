import { format } from "date-fns";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Supabase = SupabaseClient<Database>;
type Instrument = Database["public"]["Tables"]["investment_instruments"]["Row"];
type RecurringPlan = Database["public"]["Tables"]["investment_recurring_plans"]["Row"];

const TWELVE_DATA_PRICE_URL = "https://api.twelvedata.com/price";
const PRICE_STALE_MS = 18 * 60 * 60 * 1000;

interface TwelveDataPriceResponse {
  price?: string;
  code?: number;
  message?: string;
  status?: string;
}

export interface InvestmentSyncResult {
  updated: number;
  skipped: number;
  failed: { id: string; symbol: string; reason: string }[];
}

export interface PacApplyResult {
  created: number;
  skipped: number;
  failed: { id: string; name: string; reason: string }[];
}

export function getInvestmentTodayParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Rome",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const byType = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const year = Number(byType.year);
  const month = Number(byType.month);
  const day = Number(byType.day);

  return {
    year,
    month,
    day,
    dateKey: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    monthKey: `${year}-${String(month).padStart(2, "0")}`,
  };
}

function lastDayOfMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

function shouldRefreshPrice(instrument: Instrument, force: boolean) {
  if (force) return true;
  if (!instrument.last_price_at || instrument.last_price === null) return true;
  return Date.now() - new Date(instrument.last_price_at).getTime() > PRICE_STALE_MS;
}

async function fetchTwelveDataPrice(instrument: Instrument, apiKey: string) {
  const params = new URLSearchParams({
    symbol: instrument.symbol,
    apikey: apiKey,
  });
  if (instrument.exchange) params.set("exchange", instrument.exchange);

  const response = await fetch(`${TWELVE_DATA_PRICE_URL}?${params.toString()}`, {
    headers: { Accept: "application/json" },
    next: { revalidate: 0 },
  });
  const body = (await response.json().catch(() => ({}))) as TwelveDataPriceResponse;
  if (!response.ok || body.status === "error" || body.code) {
    throw new Error(body.message || `Twelve Data ha risposto ${response.status}`);
  }

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error("Prezzo non valido da Twelve Data");
  }
  return price;
}

export async function syncInvestmentPricesForUser(
  supabase: Supabase,
  userId: string,
  options: { force?: boolean } = {},
): Promise<InvestmentSyncResult> {
  const apiKey = process.env.TWELVE_DATA_API_KEY;
  if (!apiKey) {
    return { updated: 0, skipped: 0, failed: [{ id: "config", symbol: "Twelve Data", reason: "TWELVE_DATA_API_KEY mancante" }] };
  }

  const { data: instruments, error } = await supabase
    .from("investment_instruments")
    .select("*")
    .eq("user_id", userId);

  if (error) throw new Error(error.message);

  const result: InvestmentSyncResult = { updated: 0, skipped: 0, failed: [] };
  for (const instrument of (instruments ?? []) as Instrument[]) {
    if (!shouldRefreshPrice(instrument, !!options.force)) {
      result.skipped += 1;
      continue;
    }

    try {
      const price = await fetchTwelveDataPrice(instrument, apiKey);
      const pricedAt = new Date().toISOString();

      await supabase
        .from("investment_prices")
        .upsert({
          user_id: userId,
          instrument_id: instrument.id,
          price,
          currency: instrument.currency,
          priced_at: pricedAt,
          source: "twelvedata",
        }, { onConflict: "instrument_id,source,priced_at" });

      const { error: updateError } = await supabase
        .from("investment_instruments")
        .update({
          last_price: price,
          last_price_at: pricedAt,
          last_price_source: "twelvedata",
        })
        .eq("id", instrument.id)
        .eq("user_id", userId);

      if (updateError) throw new Error(updateError.message);
      result.updated += 1;
    } catch (err) {
      result.failed.push({
        id: instrument.id,
        symbol: instrument.exchange ? `${instrument.symbol}.${instrument.exchange}` : instrument.symbol,
        reason: err instanceof Error ? err.message : "Errore sconosciuto",
      });
    }
  }

  return result;
}

function isPlanDue(plan: RecurringPlan, today: ReturnType<typeof getInvestmentTodayParts>) {
  if (!plan.is_active) return false;
  if (plan.start_month > today.monthKey) return false;
  if (plan.last_executed_month && plan.last_executed_month >= today.monthKey) return false;
  const dueDay = Math.min(plan.day_of_month, lastDayOfMonth(today.year, today.month));
  return today.day >= dueDay;
}

export async function applyDueInvestmentPlans(
  supabase: Supabase,
  userId: string,
): Promise<PacApplyResult> {
  const today = getInvestmentTodayParts();
  const { data: plans, error } = await supabase
    .from("investment_recurring_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(error.message);

  const result: PacApplyResult = { created: 0, skipped: 0, failed: [] };
  for (const plan of (plans ?? []) as RecurringPlan[]) {
    if (!isPlanDue(plan, today)) {
      result.skipped += 1;
      continue;
    }

    const { data: instrument, error: instrumentError } = await supabase
      .from("investment_instruments")
      .select("*")
      .eq("id", plan.instrument_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (instrumentError || !instrument) {
      result.failed.push({ id: plan.id, name: plan.name, reason: instrumentError?.message || "ETF non trovato" });
      continue;
    }

    const selectedInstrument = instrument as Instrument;
    const price = Number(selectedInstrument.last_price);
    if (!Number.isFinite(price) || price <= 0) {
      result.failed.push({ id: plan.id, name: plan.name, reason: "Prezzo ETF mancante: aggiorna i prezzi prima del PAC" });
      continue;
    }

    const shares = Number((Number(plan.amount) / price).toFixed(8));
    const tradeDate = today.dateKey;
    const { error: txError } = await supabase
      .from("investment_transactions")
      .insert({
        user_id: userId,
        account_id: plan.account_id,
        instrument_id: plan.instrument_id,
        recurring_plan_id: plan.id,
        type: "buy",
        trade_date: tradeDate,
        shares,
        price,
        fees: 0,
        currency: plan.currency,
        source: "pac",
      });

    if (txError) {
      if (txError.code === "23505") {
        result.skipped += 1;
      } else {
        result.failed.push({ id: plan.id, name: plan.name, reason: txError.message });
        continue;
      }
    } else {
      result.created += 1;
    }

    const { error: planError } = await supabase
      .from("investment_recurring_plans")
      .update({ last_executed_month: today.monthKey })
      .eq("id", plan.id)
      .eq("user_id", userId);

    if (planError) {
      result.failed.push({ id: plan.id, name: plan.name, reason: planError.message });
    }
  }

  return result;
}

export function defaultPacStartMonth() {
  return format(new Date(), "yyyy-MM");
}
