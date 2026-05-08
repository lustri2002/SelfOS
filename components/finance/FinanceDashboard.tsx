"use client";

import { useState, useMemo, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "@/components/charts/recharts-dynamic";
import {
  Wallet, TrendingUp, TrendingDown, Plus, Trash2, X, Edit2,
  AlertCircle, ArrowUpCircle, ArrowDownCircle, Check,
  PiggyBank, Target, CreditCard, Calendar, Award,
  LayoutDashboard, RotateCcw, Landmark, Building, Home,
  Download, Activity, BarChart3, Zap, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { format, parseISO, subMonths, addMonths, isBefore, addDays } from "date-fns";
import { it } from "date-fns/locale";
import { cn } from "@/lib/utils/cn";
import ModalShell from "@/components/ui/ModalShell";
import { fmt, fmtShort, getMonthLabel, getShortMonthLabel, nextMonth, prevMonth } from "@/lib/finance/format";
import type { Database } from "@/types/database";

/* ── Types ─────────────────────────────────────────────────── */

type Account = Database["public"]["Tables"]["accounts"]["Row"];
type Snapshot = Database["public"]["Tables"]["balance_snapshots"]["Row"];
type Recurring = Database["public"]["Tables"]["recurring_expenses"]["Row"];
type Commitment = Database["public"]["Tables"]["financial_commitments"]["Row"];
type Income = Database["public"]["Tables"]["monthly_income"]["Row"];
type MonthlyNote = Database["public"]["Tables"]["monthly_notes"]["Row"];
type BudgetCycle = Database["public"]["Tables"]["budget_cycles"]["Row"];
type InvestmentInstrument = Database["public"]["Tables"]["investment_instruments"]["Row"];
type InvestmentTransaction = Database["public"]["Tables"]["investment_transactions"]["Row"];
type InvestmentPlan = Database["public"]["Tables"]["investment_recurring_plans"]["Row"];
type RecurringInput = Omit<Database["public"]["Tables"]["recurring_expenses"]["Insert"], "user_id">;
type CommitmentInput = Omit<Database["public"]["Tables"]["financial_commitments"]["Insert"], "user_id">;
type AccountInput = Omit<Database["public"]["Tables"]["accounts"]["Insert"], "user_id">;
type InvestmentInstrumentInput = Omit<Database["public"]["Tables"]["investment_instruments"]["Insert"], "user_id">;
type InvestmentTransactionInput = Omit<Database["public"]["Tables"]["investment_transactions"]["Insert"], "user_id">;
type InvestmentPlanInput = Omit<Database["public"]["Tables"]["investment_recurring_plans"]["Insert"], "user_id">;
type ChartDatum = Record<string, string | number>;
type InvestmentPosition = {
  instrument: InvestmentInstrument;
  accountId: string;
  shares: number;
  netCost: number;
  value: number;
  pnl: number;
  pnlPct: number;
  avgPrice: number;
};

type Tab = "dashboard" | "monthly" | "recurring" | "commitments" | "accounts" | "portfolio" | "analytics" | "scenarios";

export interface FinanceDashboardProps {
  userId: string;
  accounts: Account[];
  snapshots: Snapshot[];
  recurring: Recurring[];
  commitments: Commitment[];
  income: Income[];
  monthlyNotes: MonthlyNote[];
  budgetCycles: BudgetCycle[];
  investmentInstruments: InvestmentInstrument[];
  investmentTransactions: InvestmentTransaction[];
  investmentPlans: InvestmentPlan[];
}

/* ── Constants ─────────────────────────────────────────────── */

const TABS: { id: Tab; label: string; icon: typeof LayoutDashboard }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "monthly", label: "Bilancio", icon: Calendar },
  { id: "recurring", label: "Ricorrenti", icon: RotateCcw },
  { id: "commitments", label: "Impegni", icon: Target },
  { id: "accounts", label: "Conti", icon: Building },
  { id: "portfolio", label: "ETF", icon: TrendingUp },
  { id: "analytics", label: "Analisi", icon: BarChart3 },
  { id: "scenarios", label: "Scenari", icon: Zap },
];

const MILESTONE_THRESHOLDS = [1000, 5000, 10000, 25000, 50000, 100000, 250000, 500000];

/* ── Main Component ────────────────────────────────────────── */

export default function FinanceDashboard({
  accounts: initAccounts,
  snapshots: initSnapshots,
  recurring: initRecurring,
  commitments: initCommitments,
  income: initIncome,
  monthlyNotes: initMonthlyNotes,
  budgetCycles: initBudgetCycles,
  investmentInstruments: initInvestmentInstruments,
  investmentTransactions: initInvestmentTransactions,
  investmentPlans: initInvestmentPlans,
}: FinanceDashboardProps) {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [accounts, setAccounts] = useState(initAccounts);
  const [snapshots, setSnapshots] = useState(initSnapshots);
  const [recurring, setRecurring] = useState(initRecurring);
  const [commitments, setCommitments] = useState(initCommitments);
  const [income, setIncome] = useState(initIncome);
  const [monthlyNotes, setMonthlyNotes] = useState(initMonthlyNotes);
  const [budgetCycles, setBudgetCycles] = useState(initBudgetCycles);
  const [investmentInstruments, setInvestmentInstruments] = useState(initInvestmentInstruments);
  const [investmentTransactions, setInvestmentTransactions] = useState(initInvestmentTransactions);
  const [investmentPlans, setInvestmentPlans] = useState(initInvestmentPlans);

  // Modals
  const [showAddIncome, setShowAddIncome] = useState(false);
  const [showAddRecurring, setShowAddRecurring] = useState(false);
  const [editRecurring, setEditRecurring] = useState<Recurring | null>(null);
  const [showAddCommitment, setShowAddCommitment] = useState(false);
  const [editCommitment, setEditCommitment] = useState<Commitment | null>(null);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [showAddSnapshot, setShowAddSnapshot] = useState(false);
  const [showAddInvestment, setShowAddInvestment] = useState(false);
  const [showAddInvestmentTx, setShowAddInvestmentTx] = useState(false);
  const [showAddInvestmentPlan, setShowAddInvestmentPlan] = useState(false);
  const [syncingInvestments, setSyncingInvestments] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: string; id: string } | null>(null);
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const needsDashboardData = tab === "dashboard";
  const needsFinanceInsights = tab === "dashboard" || tab === "analytics" || tab === "scenarios";

  /* ── Computed data ───────────────────────────────────────── */

  // Balance per account per month
  const balanceByMonth = useMemo(() => {
    const map: Record<string, Record<string, number>> = {}; // month -> accountId -> balance
    const sorted = [...snapshots].sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month));
    sorted.forEach((s) => {
      const m = s.snapshot_month.slice(0, 7);
      if (!map[m]) map[m] = {};
      map[m][s.account_id] = Number(s.balance);
    });
    return map;
  }, [snapshots]);

  // Total balance for a given month
  const totalBalance = useCallback((month: string) => {
    const m = balanceByMonth[month];
    if (!m) return null;
    return Object.values(m).reduce((s, b) => s + b, 0);
  }, [balanceByMonth]);

  const liquidAccountIds = useMemo(
    () => new Set(accounts.filter((account) => account.type !== "other").map((account) => account.id)),
    [accounts],
  );

  const totalLiquidBalance = useCallback((month: string) => {
    const m = balanceByMonth[month];
    if (!m) return null;
    return Object.entries(m).reduce((sum, [accountId, balance]) => {
      return liquidAccountIds.has(accountId) ? sum + balance : sum;
    }, 0);
  }, [balanceByMonth, liquidAccountIds]);

  // Total income for a given month
  const totalIncome = useCallback((month: string) => {
    return income.filter((i) => i.month === month).reduce((s, i) => s + Number(i.amount), 0);
  }, [income]);

  const totalBudgetIncome = useCallback((month: string) => {
    return income
      .filter((i) => (i.budget_month || i.month) === month)
      .reduce((s, i) => s + Number(i.amount), 0);
  }, [income]);

  // Deduced expenses for a month
  const deducedExpenses = useCallback((month: string) => {
    const bal = totalLiquidBalance(month);
    const prevBal = totalLiquidBalance(prevMonth(month));
    const inc = totalBudgetIncome(month);
    if (bal === null || prevBal === null) return null;
    // Envelope mode: actual expenses = budget assigned to the month - real savings.
    return inc - (bal - prevBal);
  }, [totalLiquidBalance, totalBudgetIncome]);

  // Latest balances (most recent per account)
  const latestBalances = useMemo(() => {
    const byAccount: Record<string, number> = {};
    const sorted = [...snapshots].sort((a, b) => a.snapshot_month.localeCompare(b.snapshot_month));
    sorted.forEach((s) => { byAccount[s.account_id] = Number(s.balance); });
    return byAccount;
  }, [snapshots]);

  const investmentPositions = useMemo<InvestmentPosition[]>(() => {
    return investmentInstruments.map((instrument) => {
      const rows = investmentTransactions.filter((tx) => tx.instrument_id === instrument.id);
      const shares = rows.reduce((sum, tx) => sum + (tx.type === "buy" ? 1 : -1) * Number(tx.shares), 0);
      const buys = rows.filter((tx) => tx.type === "buy");
      const invested = buys.reduce((sum, tx) => sum + Number(tx.shares) * Number(tx.price) + Number(tx.fees), 0);
      const soldCost = rows
        .filter((tx) => tx.type === "sell")
        .reduce((sum, tx) => sum + Number(tx.shares) * Number(tx.price) - Number(tx.fees), 0);
      const netCost = invested - soldCost;
      const price = Number(instrument.last_price ?? 0);
      const value = shares > 0 && price > 0 ? shares * price : 0;
      const pnl = value - netCost;
      const accountId = rows[0]?.account_id ?? "";
      return {
        instrument,
        accountId,
        shares,
        netCost,
        value,
        pnl,
        pnlPct: netCost > 0 ? (pnl / netCost) * 100 : 0,
        avgPrice: shares > 0 ? netCost / shares : 0,
      };
    }).filter((position) => position.shares > 0.00000001);
  }, [investmentInstruments, investmentTransactions]);

  const investmentValueByAccount = useMemo(() => {
    const map: Record<string, number> = {};
    investmentPositions.forEach((position) => {
      if (!position.accountId) return;
      map[position.accountId] = (map[position.accountId] ?? 0) + position.value;
    });
    return map;
  }, [investmentPositions]);

  const latestAssetBalances = useMemo(() => {
    const values = { ...latestBalances };
    accounts.forEach((account) => {
      const investmentValue = investmentValueByAccount[account.id];
      if (account.type === "investment" && investmentValue !== undefined) {
        values[account.id] = investmentValue;
      }
    });
    return values;
  }, [accounts, investmentValueByAccount, latestBalances]);

  const currentTotalAssets = Object.values(latestAssetBalances).reduce((s, b) => s + b, 0);
  const currentLiquidAssets = accounts
    .filter((account) => account.type !== "other")
    .reduce((sum, account) => sum + (latestAssetBalances[account.id] ?? 0), 0);
  const totalLiabilities = commitments.filter((c) => c.goal_type === "debt").reduce((s, c) => s + Number(c.remaining_amount), 0);
  const netWorth = currentTotalAssets - totalLiabilities;
  const monthlyRecurringTotal = recurring.reduce((s, r) => {
    const a = Number(r.amount);
    if (r.frequency === "monthly") return s + a;
    if (r.frequency === "quarterly") return s + a / 3;
    if (r.frequency === "annual") return s + a / 12;
    return s;
  }, 0);

  // Chart data: last 6 months
  const chartData = useMemo(() => {
    if (!needsDashboardData) return [];
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) months.push(format(subMonths(new Date(), i), "yyyy-MM"));
    return months.map((m) => {
      const inc = totalIncome(m);
      const exp = deducedExpenses(m);
      const bal = totalLiquidBalance(m);
      return {
        month: getShortMonthLabel(m),
        Budget: inc,
        Spese: exp ?? 0,
        Liquidita: bal ?? 0,
      };
    });
  }, [deducedExpenses, needsDashboardData, totalIncome, totalLiquidBalance]);

  // Net worth chart
  const netWorthChart = useMemo(() => {
    if (!needsDashboardData) return [];
    const months = Array.from(new Set(snapshots.map((s) => s.snapshot_month.slice(0, 7)))).sort();
    return months.map((m) => ({
      month: getShortMonthLabel(m),
      Patrimonio: totalBalance(m) ?? 0,
    }));
  }, [needsDashboardData, snapshots, totalBalance]);

  // Upcoming dues
  const upcomingDues = recurring.filter((r) => {
    try { return isBefore(parseISO(r.next_due_date), addDays(new Date(), 7)); }
    catch { return false; }
  });

  // Moving averages (last 3 and 6 months with data)
  const movingAverages = useMemo(() => {
    const empty = { expenses3m: null, expenses6m: null, income3m: null, income6m: null, monthsUsed3: 0, monthsUsed6: 0 };
    if (!needsFinanceInsights) return empty;
    const months: string[] = [];
    for (let i = 1; i <= 12; i++) months.push(format(subMonths(new Date(), i), "yyyy-MM"));
    const withData = months.filter((m) => deducedExpenses(m) !== null);

    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : null;

    const last3 = withData.slice(0, 3);
    const last6 = withData.slice(0, 6);

    return {
      expenses3m: avg(last3.map((m) => deducedExpenses(m)!)),
      expenses6m: avg(last6.map((m) => deducedExpenses(m)!)),
      income3m: avg(last3.map((m) => totalBudgetIncome(m))),
      income6m: avg(last6.map((m) => totalBudgetIncome(m))),
      monthsUsed3: last3.length,
      monthsUsed6: last6.length,
    };
  }, [deducedExpenses, needsFinanceInsights, totalBudgetIncome]);

  // Year-end projection
  const yearProjection = useMemo(() => {
    if (!needsDashboardData) return null;
    const avgIncome = movingAverages.income6m ?? movingAverages.income3m;
    const avgExpense = movingAverages.expenses6m ?? movingAverages.expenses3m;
    if (avgIncome === null || avgExpense === null) return null;

    const now = new Date();
    const currentMonth = now.getMonth(); // 0-indexed
    const remainingMonths = 12 - currentMonth - 1; // months left after current

    // What we've already saved this year (from months with data)
    let savedSoFar = 0;
    for (let i = 0; i <= currentMonth; i++) {
      const m = format(new Date(now.getFullYear(), i, 1), "yyyy-MM");
      const inc = totalBudgetIncome(m);
      const exp = deducedExpenses(m);
      if (exp !== null) savedSoFar += inc - exp;
    }

    const projectedRemaining = remainingMonths * (avgIncome - avgExpense);
    return {
      totalProjected: savedSoFar + projectedRemaining,
      savedSoFar,
      projectedRemaining,
      monthlyAvgSaving: avgIncome - avgExpense,
      remainingMonths,
    };
  }, [deducedExpenses, movingAverages, needsDashboardData, totalBudgetIncome]);

  // Net worth milestones
  const reachedMilestones = useMemo(() => {
    if (!needsDashboardData) return [];
    const reached: { amount: number; month: string }[] = [];
    const months = Array.from(new Set(snapshots.map((s) => s.snapshot_month.slice(0, 7)))).sort();
    let prevTotal = 0;
    for (const m of months) {
      const total = totalBalance(m) ?? 0;
      for (const ms of MILESTONE_THRESHOLDS) {
        if (total >= ms && prevTotal < ms) reached.push({ amount: ms, month: m });
      }
      prevTotal = total;
    }
    return reached;
  }, [needsDashboardData, snapshots, totalBalance]);

  // Health score
  const healthScore = useMemo(() => {
    if (tab !== "analytics") return null;
    let score = 0;
    let maxScore = 0;
    const details: { label: string; points: number; max: number; tip: string }[] = [];

    // 1. Savings rate (30 pts)
    const latestMonthsWithData: string[] = [];
    for (let i = 1; i <= 6; i++) {
      const m = format(subMonths(new Date(), i), "yyyy-MM");
      if (deducedExpenses(m) !== null && totalIncome(m) > 0) { latestMonthsWithData.push(m); break; }
    }
    if (latestMonthsWithData.length > 0) {
      const m = latestMonthsWithData[0];
      const inc = totalIncome(m);
      const exp = deducedExpenses(m)!;
      const rate = (inc - exp) / inc;
      maxScore += 30;
      const pts = rate >= 0.2 ? 30 : rate >= 0.1 ? 20 : rate > 0 ? 10 : 0;
      score += pts;
      details.push({ label: "Tasso di risparmio", points: pts, max: 30, tip: `${(rate * 100).toFixed(0)}%` });
    }

    // 2. Fixed costs ratio (20 pts)
    const latestInc = latestMonthsWithData.length > 0 ? totalIncome(latestMonthsWithData[0]) : 0;
    if (latestInc > 0) {
      const ratio = monthlyRecurringTotal / latestInc;
      maxScore += 20;
      const pts = ratio <= 0.4 ? 20 : ratio <= 0.6 ? 15 : ratio <= 0.75 ? 10 : 0;
      score += pts;
      details.push({ label: "Costi fissi", points: pts, max: 20, tip: `${(ratio * 100).toFixed(0)}% delle entrate` });
    }

    // 3. Debt ratio (20 pts)
    maxScore += 20;
    const debtPts = totalLiabilities === 0 ? 20 : currentTotalAssets > 0 && totalLiabilities / currentTotalAssets < 0.3 ? 15 : currentTotalAssets > 0 && totalLiabilities / currentTotalAssets < 0.6 ? 10 : 5;
    score += debtPts;
    details.push({ label: "Rapporto debiti", points: debtPts, max: 20, tip: totalLiabilities === 0 ? "Nessun debito" : `${((totalLiabilities / Math.max(currentTotalAssets, 1)) * 100).toFixed(0)}%` });

    // 4. Emergency fund (30 pts)
    const avgExp = movingAverages.expenses6m ?? movingAverages.expenses3m;
    if (avgExp && avgExp > 0) {
      const monthsCovered = currentLiquidAssets / avgExp;
      maxScore += 30;
      const pts = monthsCovered >= 6 ? 30 : monthsCovered >= 3 ? 20 : monthsCovered >= 1 ? 10 : 0;
      score += pts;
      details.push({ label: "Fondo emergenza", points: pts, max: 30, tip: `${monthsCovered.toFixed(1)} mesi coperti` });
    }

    return maxScore > 0 ? { score, maxScore, pct: (score / maxScore) * 100, details } : null;
  }, [currentLiquidAssets, currentTotalAssets, deducedExpenses, monthlyRecurringTotal, movingAverages, tab, totalIncome, totalLiabilities]);

  // Export CSV
  function exportCSV() {
    const months = Array.from(new Set(snapshots.map((s) => s.snapshot_month.slice(0, 7)))).sort();
    const rows = [["Mese", "Budget", "Spese effettive", "Risparmio reale", "Liquidita"]];
    for (const m of months) {
      const inc = totalBudgetIncome(m);
      const exp = deducedExpenses(m);
      const bal = totalLiquidBalance(m);
      rows.push([
        m,
        inc.toFixed(2),
        exp !== null ? exp.toFixed(2) : "",
        exp !== null ? (inc - exp).toFixed(2) : "",
        bal !== null ? bal.toFixed(2) : "",
      ]);
    }
    const csv = rows.map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `finanze_${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ── CRUD ────────────────────────────────────────────────── */

  async function financeRecord<T>(body: { table: string; action: string; id?: string; data?: Record<string, unknown> }) {
    const response = await fetch("/api/finance/records", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json()) as { row?: T; error?: string };
    if (!response.ok) {
      toast.error(result.error || "Operazione non riuscita");
      throw new Error(result.error || "Finance operation failed");
    }
    return result.row as T;
  }

  // Income
  async function addIncome(data: { month: string; budget_month: string; label: string; amount: number }) {
    const row = await financeRecord<Income>({ table: "monthly_income", action: "insert", data });
    if (row) setIncome((prev) => [row, ...prev]);
    setShowAddIncome(false);
  }

  async function deleteIncome(id: string) {
    await financeRecord({ table: "monthly_income", action: "delete", id });
    setIncome((prev) => prev.filter((i) => i.id !== id));
  }

  // Snapshots — upsert because (account_id, snapshot_month) is UNIQUE
  async function addSnapshot(data: { account_id: string; balance: number; snapshot_month: string }) {
    const month = data.snapshot_month.slice(0, 7); // ensure YYYY-MM format
    const response = await fetch("/api/finance/balance-snapshots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...data, snapshot_month: month }),
    });
    const result = (await response.json()) as { snapshot?: Snapshot; error?: string };

    if (!response.ok || !result.snapshot) {
      toast.error(result.error || "Non sono riuscito a salvare il saldo");
      throw new Error(result.error || "Snapshot save failed");
    }

    const row = result.snapshot;
    if (row) {
      setSnapshots((prev) => {
        const existing = prev.findIndex((s) => s.account_id === data.account_id && s.snapshot_month.slice(0, 7) === month);
        if (existing >= 0) {
          const copy = [...prev];
          copy[existing] = row as Snapshot;
          return copy;
        }
        return [...prev, row as Snapshot];
      });
      toast.success("Saldo salvato");
    }
    setShowAddSnapshot(false);
  }

  // Recurring
  async function addRecurringExpense(data: { name: string; amount: number; frequency: "monthly" | "quarterly" | "annual"; category: string; next_due_date: string }) {
    const row = await financeRecord<Recurring>({ table: "recurring_expenses", action: "insert", data });
    if (row) setRecurring((prev) => [row, ...prev]);
    setShowAddRecurring(false);
  }

  async function updateRecurring(id: string, data: Partial<Recurring>) {
    const row = await financeRecord<Recurring>({ table: "recurring_expenses", action: "update", id, data: data as Record<string, unknown> });
    if (row) setRecurring((prev) => prev.map((r) => (r.id === id ? row : r)));
    setEditRecurring(null);
  }

  async function deleteRecurringItem(id: string) {
    await financeRecord({ table: "recurring_expenses", action: "delete", id });
    setRecurring((prev) => prev.filter((r) => r.id !== id));
    setDeleteConfirm(null);
  }

  // Commitments
  async function addCommitment(data: CommitmentInput) {
    const row = await financeRecord<Commitment>({ table: "financial_commitments", action: "insert", data: data as Record<string, unknown> });
    if (row) setCommitments((prev) => [row, ...prev]);
    setShowAddCommitment(false);
  }

  async function updateCommitment(id: string, data: Partial<Commitment>) {
    const row = await financeRecord<Commitment>({ table: "financial_commitments", action: "update", id, data: data as Record<string, unknown> });
    if (row) setCommitments((prev) => prev.map((c) => (c.id === id ? row : c)));
    setEditCommitment(null);
  }

  async function deleteCommitmentItem(id: string) {
    await financeRecord({ table: "financial_commitments", action: "delete", id });
    setCommitments((prev) => prev.filter((c) => c.id !== id));
    setDeleteConfirm(null);
  }

  // Accounts
  async function addAccount(data: AccountInput) {
    const row = await financeRecord<Account>({ table: "accounts", action: "insert", data: data as Record<string, unknown> });
    if (row) setAccounts((prev) => [row, ...prev]);
    setShowAddAccount(false);
  }

  async function deleteAccount(id: string) {
    await financeRecord({ table: "accounts", action: "update", id, data: { is_active: false } });
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    setDeleteConfirm(null);
  }

  // Monthly notes — upsert because (user_id, month) is UNIQUE
  async function saveMonthlyNote(month: string, note: string) {
    const row = await financeRecord<MonthlyNote>({ table: "monthly_notes", action: "upsert_monthly_note", data: { month, note } });
    if (row) {
      setMonthlyNotes((prev) => {
        const idx = prev.findIndex((n) => n.month === month);
        if (idx >= 0) { const copy = [...prev]; copy[idx] = row as MonthlyNote; return copy; }
        return [row as MonthlyNote, ...prev];
      });
    }
  }

  // Helper to get note for a month
  const getMonthNote = useCallback((month: string) => {
    return monthlyNotes.find((n) => n.month === month)?.note || "";
  }, [monthlyNotes]);

  async function saveBudgetCycle(month: string, data: { planned_savings: number; planned_variable_spending: number; notes: string }) {
    const row = await financeRecord<BudgetCycle>({
      table: "budget_cycles",
      action: "upsert_budget_cycle",
      data: { month, ...data },
    });
    if (row) {
      setBudgetCycles((prev) => {
        const idx = prev.findIndex((cycle) => cycle.month === month);
        if (idx >= 0) {
          const copy = [...prev];
          copy[idx] = row;
          return copy;
        }
        return [row, ...prev];
      });
      toast.success("Piano mensile salvato");
    }
  }

  const getBudgetCycle = useCallback((month: string) => {
    return budgetCycles.find((cycle) => cycle.month === month) || null;
  }, [budgetCycles]);

  async function addInvestmentInstrument(data: InvestmentInstrumentInput) {
    const row = await financeRecord<InvestmentInstrument>({
      table: "investment_instruments",
      action: "insert",
      data: data as Record<string, unknown>,
    });
    if (row) setInvestmentInstruments((prev) => [...prev, row]);
    setShowAddInvestment(false);
    toast.success("ETF aggiunto");
  }

  async function addInvestmentTransaction(data: InvestmentTransactionInput) {
    const row = await financeRecord<InvestmentTransaction>({
      table: "investment_transactions",
      action: "insert",
      data: data as Record<string, unknown>,
    });
    if (row) setInvestmentTransactions((prev) => [row, ...prev]);
    setShowAddInvestmentTx(false);
    toast.success(data.source === "pac" ? "Quota PAC registrata" : "Movimento ETF salvato");
  }

  async function addInvestmentPlan(data: InvestmentPlanInput) {
    const row = await financeRecord<InvestmentPlan>({
      table: "investment_recurring_plans",
      action: "insert",
      data: data as Record<string, unknown>,
    });
    if (row) setInvestmentPlans((prev) => [row, ...prev]);
    setShowAddInvestmentPlan(false);
    toast.success("PAC creato");
  }

  async function deleteInvestmentPlan(id: string) {
    const row = await financeRecord<InvestmentPlan>({
      table: "investment_recurring_plans",
      action: "update",
      id,
      data: { is_active: false },
    });
    if (row) setInvestmentPlans((prev) => prev.map((plan) => (plan.id === id ? row : plan)));
    setDeleteConfirm(null);
  }

  async function syncInvestments() {
    setSyncingInvestments(true);
    try {
      const response = await fetch("/api/finance/investments/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true, applyPac: true }),
      });
      const result = (await response.json()) as {
        error?: string;
        prices?: { updated: number; skipped: number; failed: unknown[] };
        pac?: { created: number; skipped: number; failed: unknown[] } | null;
      };
      if (!response.ok) throw new Error(result.error || "Sync non riuscita");
      toast.success(`Prezzi aggiornati: ${result.prices?.updated ?? 0}. PAC creati: ${result.pac?.created ?? 0}.`);
      window.location.reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync investimenti non riuscita");
    } finally {
      setSyncingInvestments(false);
    }
  }

  /* ── Render ──────────────────────────────────────────────── */
  return (
    <div className="flex h-full flex-col">
      {/* Header + Tabs */}
      <div className="sticky top-0 z-20 border-b border-[var(--sb-glass-border)] sb-glass">
        <div className="px-4 pb-0 pt-4 md:px-6">
          <div className="sb-hero sb-module-finance mb-4 flex flex-col gap-4 p-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-bold leading-tight text-[var(--sb-text)] md:text-4xl">Finanze</h1>
              <p className="mt-2 text-sm text-[var(--sb-muted)]">Patrimonio, flussi e traiettoria finanziaria.</p>
            </div>
            <div className="grid grid-cols-2 gap-2 md:ml-auto">
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className={cn("text-lg font-bold tabular-nums", netWorth >= 0 ? "text-emerald-300" : "text-red-300")}>{fmt(netWorth)}</p>
                <p className="text-[10px] uppercase text-[var(--sb-muted)]">Net worth</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/[0.04] px-3 py-2">
                <p className="text-lg font-bold tabular-nums text-cyan-300">{fmt(monthlyRecurringTotal)}</p>
                <p className="text-[10px] uppercase text-[var(--sb-muted)]">Fissi/mese</p>
              </div>
            </div>
          </div>
          <div className="-mb-px flex items-end justify-between gap-3">
            <div className="flex min-w-0 gap-1 overflow-x-auto pb-0">
              {TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setTab(id)}
                  className={cn(
                    "sb-focus flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-t-lg px-3 py-2 text-xs font-medium transition-all",
                    tab === id
                      ? "border-b-2 border-[var(--sb-accent)] bg-[var(--sb-bg)] text-[var(--sb-text)]"
                      : "text-[var(--sb-muted)] hover:text-[var(--sb-text)]"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{label}</span>
                </button>
              ))}
            </div>
            <button onClick={exportCSV} className="sb-focus sb-row mb-1 flex min-h-8 shrink-0 cursor-pointer items-center gap-1.5 border border-[var(--sb-border)] bg-[var(--sb-surface)] px-2.5 py-1.5 text-xs text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]" title="Esporta CSV">
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Esporta CSV</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
        {tab === "dashboard" && (
          <DashboardTab
            netWorth={netWorth}
            currentTotalAssets={currentTotalAssets}
            totalLiabilities={totalLiabilities}
            monthlyRecurringTotal={monthlyRecurringTotal}
            selectedMonth={selectedMonth}
            totalIncome={totalBudgetIncome(selectedMonth)}
            deducedExpenses={deducedExpenses(selectedMonth)}
            chartData={chartData}
            netWorthChart={netWorthChart}
            upcomingDues={upcomingDues}
            commitments={commitments}
            totalIncomeFn={totalBudgetIncome}
            deducedExpensesFn={deducedExpenses}
            snapshots={snapshots}
            movingAverages={movingAverages}
            yearProjection={yearProjection}
            accounts={accounts}
            latestBalances={latestBalances}
            reachedMilestones={reachedMilestones}
          />
        )}
        {tab === "monthly" && (
          <MonthlyTab
            selectedMonth={selectedMonth}
            setSelectedMonth={setSelectedMonth}
            income={income}
            accounts={accounts}
            balanceByMonth={balanceByMonth}
            monthlyRecurringTotal={monthlyRecurringTotal}
            totalIncomeFn={totalIncome}
            totalBudgetIncomeFn={totalBudgetIncome}
            totalBalanceFn={totalBalance}
            deducedExpensesFn={deducedExpenses}
            onAddIncome={() => setShowAddIncome(true)}
            onDeleteIncome={deleteIncome}
            onAddSnapshot={() => setShowAddSnapshot(true)}
            onSaveSnapshot={addSnapshot}
            monthNote={getMonthNote(selectedMonth)}
            onSaveNote={(note) => saveMonthlyNote(selectedMonth, note)}
            budgetCycle={getBudgetCycle(selectedMonth)}
            onSaveBudgetCycle={(data) => saveBudgetCycle(selectedMonth, data)}
          />
        )}
        {tab === "recurring" && (
          <RecurringTab
            recurring={recurring}
            monthlyTotal={monthlyRecurringTotal}
            latestMonthlyIncome={totalIncome(selectedMonth)}
            onAdd={() => setShowAddRecurring(true)}
            onEdit={setEditRecurring}
            onDelete={(id) => setDeleteConfirm({ type: "recurring", id })}
          />
        )}
        {tab === "commitments" && (
          <CommitmentsTab
            commitments={commitments}
            onAdd={() => setShowAddCommitment(true)}
            onEdit={setEditCommitment}
            onDelete={(id) => setDeleteConfirm({ type: "commitment", id })}
            onUpdateSaved={updateCommitment}
          />
        )}
        {tab === "accounts" && (
          <AccountsTab
            accounts={accounts}
            latestBalances={latestAssetBalances}
            onAddAccount={() => setShowAddAccount(true)}
            onAddSnapshot={() => setShowAddSnapshot(true)}
            onDeleteAccount={(id) => setDeleteConfirm({ type: "account", id })}
          />
        )}
        {tab === "portfolio" && (
          <PortfolioTab
            accounts={accounts}
            instruments={investmentInstruments}
            transactions={investmentTransactions}
            plans={investmentPlans}
            positions={investmentPositions}
            syncing={syncingInvestments}
            onSync={syncInvestments}
            onAddInstrument={() => setShowAddInvestment(true)}
            onAddTransaction={() => setShowAddInvestmentTx(true)}
            onAddPlan={() => setShowAddInvestmentPlan(true)}
            onDeletePlan={(id) => setDeleteConfirm({ type: "investmentPlan", id })}
          />
        )}
        {tab === "analytics" && (
          <AnalyticsTab
            healthScore={healthScore}
            totalIncomeFn={totalIncome}
            deducedExpensesFn={deducedExpenses}
            snapshots={snapshots}
            recurring={recurring}
            monthlyRecurringTotal={monthlyRecurringTotal}
            currentTotalAssets={currentTotalAssets}
            movingAverages={movingAverages}
            commitments={commitments}
          />
        )}
        {tab === "scenarios" && (
          <ScenarioPlannerTab
            netWorth={netWorth}
            monthlyIncome={totalBudgetIncome(selectedMonth) || totalIncome(selectedMonth) || movingAverages.income3m || 0}
            monthlyFixedCosts={monthlyRecurringTotal}
            monthlyExpenses={deducedExpenses(selectedMonth) || movingAverages.expenses3m || monthlyRecurringTotal}
            commitments={commitments}
          />
        )}
      </div>

      {/* Modals */}
      {showAddIncome && (
        <IncomeForm month={selectedMonth} onSave={addIncome} onClose={() => setShowAddIncome(false)} />
      )}
      {showAddSnapshot && (
        <SnapshotForm accounts={accounts} month={selectedMonth} existingBalances={balanceByMonth[selectedMonth] || {}} onSave={addSnapshot} onClose={() => setShowAddSnapshot(false)} />
      )}
      {(showAddRecurring || editRecurring) && (
        <RecurringForm initial={editRecurring} onSave={(data) => editRecurring ? updateRecurring(editRecurring.id, data) : addRecurringExpense(data)} onClose={() => { setShowAddRecurring(false); setEditRecurring(null); }} />
      )}
      {(showAddCommitment || editCommitment) && (
        <CommitmentForm initial={editCommitment} onSave={(data) => editCommitment ? updateCommitment(editCommitment.id, data) : addCommitment(data)} onClose={() => { setShowAddCommitment(false); setEditCommitment(null); }} />
      )}
      {showAddAccount && (
        <AccountForm onSave={addAccount} onClose={() => setShowAddAccount(false)} />
      )}
      {showAddInvestment && (
        <InvestmentInstrumentForm onSave={addInvestmentInstrument} onClose={() => setShowAddInvestment(false)} />
      )}
      {showAddInvestmentTx && (
        <InvestmentTransactionForm accounts={accounts} instruments={investmentInstruments} onSave={addInvestmentTransaction} onClose={() => setShowAddInvestmentTx(false)} />
      )}
      {showAddInvestmentPlan && (
        <InvestmentPlanForm accounts={accounts} instruments={investmentInstruments} onSave={addInvestmentPlan} onClose={() => setShowAddInvestmentPlan(false)} />
      )}
      {deleteConfirm && (
        <DeleteDialog
          onConfirm={() => {
            if (deleteConfirm.type === "recurring") deleteRecurringItem(deleteConfirm.id);
            else if (deleteConfirm.type === "commitment") deleteCommitmentItem(deleteConfirm.id);
            else if (deleteConfirm.type === "account") deleteAccount(deleteConfirm.id);
            else if (deleteConfirm.type === "investmentPlan") deleteInvestmentPlan(deleteConfirm.id);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   useCallback import fix — we need it above
   ════════════════════════════════════════════════════════════ */

// (useCallback is already imported at top)

function ScenarioPlannerTab({
  netWorth,
  monthlyIncome,
  monthlyFixedCosts,
  monthlyExpenses,
  commitments,
}: {
  netWorth: number;
  monthlyIncome: number;
  monthlyFixedCosts: number;
  monthlyExpenses: number;
  commitments: Commitment[];
}) {
  const [extraIncome, setExtraIncome] = useState(0);
  const [expenseCut, setExpenseCut] = useState(150);
  const [oneOffPurchase, setOneOffPurchase] = useState(0);
  const [monthlyInvestment, setMonthlyInvestment] = useState(250);
  const [months, setMonths] = useState(12);

  const totalDebtPayments = commitments
    .filter((commitment) => commitment.goal_type === "debt")
    .reduce((sum, commitment) => sum + Number(commitment.monthly_payment), 0);
  const baselineMonthlySavings = monthlyIncome - monthlyExpenses;
  const scenarioMonthlySavings = monthlyIncome + extraIncome - Math.max(0, monthlyExpenses - expenseCut) - monthlyInvestment;
  const projectedBaseline = netWorth + baselineMonthlySavings * months;
  const projectedScenario = netWorth - oneOffPurchase + scenarioMonthlySavings * months + monthlyInvestment * months;
  const delta = projectedScenario - projectedBaseline;
  const runway = Math.max(0, monthlyExpenses - expenseCut) > 0
    ? (netWorth - oneOffPurchase) / Math.max(1, monthlyExpenses - expenseCut)
    : 0;
  const series = Array.from({ length: Math.min(months, 24) + 1 }, (_, index) => ({
    month: index === 0 ? "Ora" : `M${index}`,
    Base: Math.round(netWorth + baselineMonthlySavings * index),
    Scenario: Math.round(netWorth - oneOffPurchase + (scenarioMonthlySavings + monthlyInvestment) * index),
  }));

  return (
    <div className="space-y-6">
      <div className="sb-hero sb-module-finance p-5">
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="sb-eyebrow mb-3">Scenario Planner</p>
            <h2 className="text-2xl font-bold text-[var(--sb-text)] md:text-3xl">Simula una decisione prima di viverla.</h2>
            <p className="mt-2 max-w-2xl text-sm text-[var(--sb-muted)]">
              Usa entrate, spese, acquisti e investimenti per vedere la traiettoria nei prossimi mesi.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <ScenarioMetric label="Delta" value={fmt(delta)} positive={delta >= 0} />
            <ScenarioMetric label="Runway" value={`${runway.toFixed(1)} mesi`} positive={runway >= 6} />
            <ScenarioMetric label="Risparmio/mese" value={fmt(scenarioMonthlySavings)} positive={scenarioMonthlySavings >= 0} />
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <div className="space-y-3">
          <SliderCard label="Orizzonte" value={months} suffix=" mesi" min={3} max={36} step={3} onChange={setMonths} />
          <SliderCard label="Entrate extra" value={extraIncome} prefix="€" min={0} max={2500} step={50} onChange={setExtraIncome} />
          <SliderCard label="Taglio spese" value={expenseCut} prefix="€" min={0} max={1500} step={25} onChange={setExpenseCut} />
          <SliderCard label="Acquisto una tantum" value={oneOffPurchase} prefix="€" min={0} max={10000} step={100} onChange={setOneOffPurchase} />
          <SliderCard label="Investimento mensile" value={monthlyInvestment} prefix="€" min={0} max={2500} step={50} onChange={setMonthlyInvestment} />
        </div>

        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <SummaryTile label="Patrimonio ora" value={fmt(netWorth)} />
            <SummaryTile label="Base futura" value={fmt(projectedBaseline)} />
            <SummaryTile label="Scenario futuro" value={fmt(projectedScenario)} />
            <SummaryTile label="Debiti/mese" value={fmt(totalDebtPayments + monthlyFixedCosts)} />
          </div>

          <div className="sb-chart-card sb-module-finance h-80 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--sb-border)" />
                <XAxis dataKey="month" stroke="var(--sb-muted)" fontSize={11} />
                <YAxis stroke="var(--sb-muted)" fontSize={11} tickFormatter={(value: number | string) => fmtShort(Number(value))} />
                <Tooltip formatter={(value: number | string) => fmt(Number(value))} contentStyle={{ background: "var(--sb-surface-solid)", border: "1px solid var(--sb-border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="Base" stroke="#64748b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="Scenario" stroke="#10b981" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
            <p className="text-sm font-semibold text-[var(--sb-text)]">Lettura del sistema</p>
            <p className="mt-2 text-sm leading-relaxed text-[var(--sb-muted)]">
              {delta >= 0
                ? `Questo scenario migliora la traiettoria di ${fmt(delta)} in ${months} mesi. La leva principale e il margine mensile: tienilo sopra zero e il piano resta sostenibile.`
                : `Questo scenario brucia ${fmt(Math.abs(delta))} rispetto alla base. Riduci l'acquisto, aumenta entrate o abbassa l'investimento mensile finche il margine torna positivo.`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ScenarioMetric({ label, value, positive }: { label: string; value: string; positive: boolean }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.04] p-3">
      <p className={cn("text-lg font-bold tabular-nums", positive ? "text-emerald-300" : "text-red-300")}>{value}</p>
      <p className="text-[10px] uppercase text-[var(--sb-muted)]">{label}</p>
    </div>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
      <p className="text-xs text-[var(--sb-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-[var(--sb-text)]">{value}</p>
    </div>
  );
}

function SliderCard({
  label,
  value,
  min,
  max,
  step,
  onChange,
  prefix = "",
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block rounded-lg border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
      <span className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-[var(--sb-text)]">{label}</span>
        <span className="text-sm font-semibold tabular-nums text-[var(--sb-accent)]">{prefix}{value}{suffix}</span>
      </span>
      <input
        className="mt-4 w-full accent-[var(--sb-accent)]"
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

/* ════════════════════════════════════════════════════════════
   Dashboard Tab
   ════════════════════════════════════════════════════════════ */

function DashboardTab({
  netWorth, currentTotalAssets, totalLiabilities, monthlyRecurringTotal,
  selectedMonth, totalIncome, deducedExpenses,
  chartData, netWorthChart, upcomingDues, commitments,
  movingAverages, yearProjection,
  totalIncomeFn, deducedExpensesFn, snapshots,
  accounts, latestBalances, reachedMilestones,
}: {
  netWorth: number; currentTotalAssets: number; totalLiabilities: number;
  monthlyRecurringTotal: number; selectedMonth: string;
  totalIncome: number; deducedExpenses: number | null;
  chartData: ChartDatum[]; netWorthChart: ChartDatum[];
  upcomingDues: Recurring[]; commitments: Commitment[];
  movingAverages: { expenses3m: number | null; expenses6m: number | null; income3m: number | null; income6m: number | null; monthsUsed3: number; monthsUsed6: number };
  yearProjection: { totalProjected: number; savedSoFar: number; projectedRemaining: number; monthlyAvgSaving: number; remainingMonths: number } | null;
  totalIncomeFn: (m: string) => number;
  deducedExpensesFn: (m: string) => number | null;
  snapshots: Snapshot[];
  accounts: Account[];
  latestBalances: Record<string, number>;
  reachedMilestones: { amount: number; month: string }[];
}) {
  const savings = commitments.filter((c) => c.goal_type === "savings");

  // Fixed costs as % of income
  const fixedCostsPct = totalIncome > 0 ? (monthlyRecurringTotal / totalIncome) * 100 : null;

  // Best/worst months by savings (income - expenses)
  const bestWorst = useMemo(() => {
    const months = Array.from(new Set(snapshots.map((s) => s.snapshot_month.slice(0, 7)))).sort();
    const withSavings = months
      .map((m) => {
        const inc = totalIncomeFn(m);
        const exp = deducedExpensesFn(m);
        if (exp === null || inc === 0) return null;
        return { month: m, saved: inc - exp, income: inc, expenses: exp };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);

    if (withSavings.length < 2) return null;

    const best = withSavings.reduce((a, b) => (b.saved > a.saved ? b : a));
    const worst = withSavings.reduce((a, b) => (b.saved < a.saved ? b : a));
    return { best, worst };
  }, [snapshots, totalIncomeFn, deducedExpensesFn]);

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard icon={<Wallet className="h-4 w-4" />} label="Patrimonio netto" value={fmt(netWorth)} tone={netWorth >= 0 ? "positive" : "negative"} />
        <KpiCard icon={<ArrowUpCircle className="h-4 w-4" />} label="Budget mese" value={fmt(totalIncome)} tone="positive" />
        <KpiCard icon={<ArrowDownCircle className="h-4 w-4" />} label="Spese dedotte" value={deducedExpenses !== null ? fmt(deducedExpenses) : "—"} tone="negative" />
        <KpiCard icon={<RotateCcw className="h-4 w-4" />} label="Costi fissi/mese" value={fmt(monthlyRecurringTotal)} tone="neutral" />
      </div>

      {/* Daily cost of living */}
      {(() => {
        const avgExp = movingAverages.expenses6m ?? movingAverages.expenses3m;
        if (avgExp === null || avgExp <= 0) return null;
        const daily = avgExp / 30;
        return (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400 shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div>
                <p className="text-[10px] text-[var(--sb-muted)] uppercase">Costo della vita giornaliero</p>
                <p className="text-xs text-[var(--sb-muted)]">Media basata sugli ultimi {movingAverages.monthsUsed6 > 3 ? movingAverages.monthsUsed6 : movingAverages.monthsUsed3} mesi</p>
              </div>
            </div>
            <p className="text-lg font-bold tabular-nums text-amber-400">{fmt(daily)}</p>
          </div>
        );
      })()}

      {/* Net worth breakdown when physical assets exist */}
      {(() => {
        const assetValue = accounts.filter((a) => a.type === "other").reduce((s, a) => s + (latestBalances[a.id] ?? 0), 0);
        if (assetValue === 0) return null;
        const liquidValue = currentTotalAssets - assetValue;
        return (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
            <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-2">Composizione patrimonio netto</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <p className="text-[10px] text-[var(--sb-muted)]">Liquidità</p>
                <p className="text-xs font-semibold tabular-nums text-indigo-400">{fmt(liquidValue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--sb-muted)]">Asset fisici</p>
                <p className="text-xs font-semibold tabular-nums text-amber-400">{fmt(assetValue)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--sb-muted)]">Debiti</p>
                <p className="text-xs font-semibold tabular-nums text-red-400">−{fmt(totalLiabilities)}</p>
              </div>
              <div>
                <p className="text-[10px] text-[var(--sb-muted)]">Netto</p>
                <p className={cn("text-xs font-bold tabular-nums", netWorth >= 0 ? "text-emerald-400" : "text-red-400")}>{fmt(netWorth)}</p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Balance & savings ratio */}
      {deducedExpenses !== null && totalIncome > 0 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--sb-muted)]">Tasso di risparmio — {getMonthLabel(selectedMonth)}</span>
            <span className={cn("text-sm font-semibold tabular-nums", (totalIncome - deducedExpenses) >= 0 ? "text-emerald-400" : "text-red-400")}>
              {((1 - deducedExpenses / totalIncome) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", (totalIncome - deducedExpenses) >= 0 ? "bg-emerald-500" : "bg-red-500")}
              style={{ width: `${Math.min(Math.max((1 - deducedExpenses / totalIncome) * 100, 0), 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[var(--sb-muted)]">
            <span>Risparmiato: {fmt(totalIncome - deducedExpenses)}</span>
            <span>Speso: {fmt(deducedExpenses)}</span>
          </div>
        </div>
      )}

      {/* Fixed costs % of income */}
      {fixedCostsPct !== null && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[var(--sb-muted)]">Spese fisse su entrate</span>
            <span className={cn("text-sm font-semibold tabular-nums", fixedCostsPct <= 50 ? "text-emerald-400" : fixedCostsPct <= 75 ? "text-amber-400" : "text-red-400")}>
              {fixedCostsPct.toFixed(0)}%
            </span>
          </div>
          <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
            <div
              className={cn("h-full rounded-full transition-all duration-500", fixedCostsPct <= 50 ? "bg-emerald-500" : fixedCostsPct <= 75 ? "bg-amber-500" : "bg-red-500")}
              style={{ width: `${Math.min(fixedCostsPct, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[10px] text-[var(--sb-muted)]">
            <span>Costi fissi: {fmt(monthlyRecurringTotal)}</span>
            <span>Budget: {fmt(totalIncome)}</span>
          </div>
        </div>
      )}

      {/* Best / worst month */}
      {bestWorst && (
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <Award className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-[10px] text-[var(--sb-muted)] uppercase">Mese migliore</span>
            </div>
            <p className="text-sm font-semibold text-[var(--sb-text)] capitalize">{getMonthLabel(bestWorst.best.month)}</p>
            <p className="text-xs text-emerald-400 font-medium tabular-nums mt-0.5">+{fmt(bestWorst.best.saved)}</p>
          </div>
          <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
            <div className="flex items-center gap-1.5 mb-2">
              <TrendingDown className="h-3.5 w-3.5 text-red-400" />
              <span className="text-[10px] text-[var(--sb-muted)] uppercase">Mese peggiore</span>
            </div>
            <p className="text-sm font-semibold text-[var(--sb-text)] capitalize">{getMonthLabel(bestWorst.worst.month)}</p>
            <p className="text-xs text-red-400 font-medium tabular-nums mt-0.5">{bestWorst.worst.saved >= 0 ? "+" : ""}{fmt(bestWorst.worst.saved)}</p>
          </div>
        </div>
      )}

      {/* Moving averages */}
      {(movingAverages.expenses3m !== null || movingAverages.expenses6m !== null) && (
        <div className="grid md:grid-cols-2 gap-3">
          {movingAverages.expenses3m !== null && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-2">Media ultimi {movingAverages.monthsUsed3} mesi</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-[var(--sb-muted)]">Spese</p>
                  <p className="text-sm font-semibold tabular-nums text-red-400">{fmt(movingAverages.expenses3m)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--sb-muted)]">Budget</p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmt(movingAverages.income3m!)}</p>
                </div>
              </div>
            </div>
          )}
          {movingAverages.expenses6m !== null && movingAverages.monthsUsed6 > 3 && (
            <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
              <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-2">Media ultimi {movingAverages.monthsUsed6} mesi</p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-[10px] text-[var(--sb-muted)]">Spese</p>
                  <p className="text-sm font-semibold tabular-nums text-red-400">{fmt(movingAverages.expenses6m)}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-[var(--sb-muted)]">Budget</p>
                  <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmt(movingAverages.income6m!)}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Year-end projection */}
      {yearProjection && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-3">Proiezione fine anno</p>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-xs text-[var(--sb-muted)]">Risparmio stimato a dicembre</p>
              <p className={cn("text-xl font-bold tabular-nums", yearProjection.totalProjected >= 0 ? "text-emerald-400" : "text-red-400")}>
                {fmt(yearProjection.totalProjected)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[var(--sb-muted)]">Media risparmio/mese</p>
              <p className={cn("text-sm font-semibold tabular-nums", yearProjection.monthlyAvgSaving >= 0 ? "text-emerald-400" : "text-red-400")}>
                {yearProjection.monthlyAvgSaving >= 0 ? "+" : ""}{fmt(yearProjection.monthlyAvgSaving)}
              </p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-lg bg-[var(--sb-card)] p-2.5 text-center">
              <p className="text-[10px] text-[var(--sb-muted)]">Già risparmiato</p>
              <p className="text-sm font-medium tabular-nums text-[var(--sb-text)]">{fmt(yearProjection.savedSoFar)}</p>
            </div>
            <div className="rounded-lg bg-[var(--sb-card)] p-2.5 text-center">
              <p className="text-[10px] text-[var(--sb-muted)]">Previsti ({yearProjection.remainingMonths} mesi)</p>
              <p className="text-sm font-medium tabular-nums text-[var(--sb-muted)]">{fmt(yearProjection.projectedRemaining)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Alerts */}
      {upcomingDues.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-center gap-2 mb-2 text-amber-400">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm font-medium">Scadenze nei prossimi 7 giorni</span>
          </div>
          <div className="space-y-1">
            {upcomingDues.map((r) => (
              <div key={r.id} className="flex justify-between text-sm">
                <span className="text-[var(--sb-text)]">{r.name}</span>
                <span className="text-amber-400 font-medium tabular-nums">
                  {fmt(Number(r.amount), r.currency)} — {format(parseISO(r.next_due_date), "d MMM", { locale: it })}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {chartData.some((d) => Number(d.Budget) > 0 || Number(d.Spese) > 0) && (
          <div className="sb-chart-card sb-module-finance p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--sb-text)]">Budget vs Spese</h3>
                <p className="text-[11px] text-[var(--sb-muted)]">Ultimi 6 mesi</p>
              </div>
              <BarChart3 className="h-4 w-4 text-emerald-300" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData}>
                <defs>
                  <linearGradient id="incomeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#34d399" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0.38} />
                  </linearGradient>
                  <linearGradient id="expenseGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#fb7185" stopOpacity={0.95} />
                    <stop offset="100%" stopColor="#ef4444" stopOpacity={0.35} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 8" stroke="var(--sb-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--sb-muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--sb-muted)", fontSize: 10 }} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface-solid)", border: "1px solid var(--sb-border-strong)", borderRadius: 8, fontSize: 12, boxShadow: "var(--sb-shadow-lg)" }} formatter={(v: unknown) => fmt(Number(v))} />
                <Bar dataKey="Budget" fill="url(#incomeGradient)" radius={[6, 6, 2, 2]} />
                <Bar dataKey="Spese" fill="url(#expenseGradient)" radius={[6, 6, 2, 2]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {netWorthChart.length > 1 && (
          <div className="sb-chart-card sb-module-finance p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[var(--sb-text)]">Andamento patrimonio</h3>
                <p className="text-[11px] text-[var(--sb-muted)]">Traiettoria net worth</p>
              </div>
              <Activity className="h-4 w-4 text-cyan-300" />
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={netWorthChart}>
                <defs>
                  <linearGradient id="netWorthStroke" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor="#10b981" />
                    <stop offset="100%" stopColor="#06b6d4" />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} strokeDasharray="3 8" stroke="var(--sb-border)" />
                <XAxis dataKey="month" tick={{ fill: "var(--sb-muted)", fontSize: 10 }} />
                <YAxis tick={{ fill: "var(--sb-muted)", fontSize: 10 }} tickFormatter={fmtShort} />
                <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface-solid)", border: "1px solid var(--sb-border-strong)", borderRadius: 8, fontSize: 12, boxShadow: "var(--sb-shadow-lg)" }} formatter={(v: unknown) => fmt(Number(v))} />
                <Line type="monotone" dataKey="Patrimonio" stroke="url(#netWorthStroke)" strokeWidth={3} dot={{ fill: "#10b981", r: 3 }} activeDot={{ r: 5, fill: "#06b6d4" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Savings goals */}
      {savings.length > 0 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3 flex items-center gap-1.5">
            <PiggyBank className="h-3.5 w-3.5" /> Obiettivi di risparmio
          </h3>
          <div className="space-y-3">
            {savings.map((c) => {
              const target = Number(c.target_amount) || Number(c.original_amount);
              const saved = Number(c.current_saved);
              const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[var(--sb-text)]">{c.name}</span>
                    <span className="text-[var(--sb-muted)] tabular-nums text-xs">{fmt(saved)} / {fmt(target)}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">{pct.toFixed(0)}%</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Asset distribution pie chart */}
      {accounts.length > 1 && currentTotalAssets > 0 && (() => {
        const PIE_COLORS = ["#6366f1", "#22c55e", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#14b8a6"];
        const pieData = accounts
          .filter((a) => (latestBalances[a.id] ?? 0) > 0)
          .map((a) => ({ name: a.name, value: latestBalances[a.id] ?? 0 }));
        if (pieData.length === 0) return null;
        return (
          <div className="sb-chart-card sb-module-finance p-4">
            <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3 flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Distribuzione patrimonio
            </h3>
            <div className="flex items-center gap-4">
              <ResponsiveContainer width={140} height={140}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" cx="50%" cy="50%" outerRadius={60} innerRadius={35} strokeWidth={0}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "var(--sb-surface-solid)", border: "1px solid var(--sb-border-strong)", borderRadius: 8, fontSize: 12, boxShadow: "var(--sb-shadow-lg)" }} formatter={(v: unknown) => fmt(Number(v))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-1.5">
                {pieData.map((d, i) => (
                  <div key={d.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="text-xs text-[var(--sb-text)]">{d.name}</span>
                    </div>
                    <span className="text-xs text-[var(--sb-muted)] tabular-nums">{((d.value / currentTotalAssets) * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Milestones */}
      {reachedMilestones.length > 0 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" /> Traguardi raggiunti
          </h3>
          <div className="flex flex-wrap gap-2">
            {reachedMilestones.map((ms) => (
              <div key={ms.amount} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 px-3 py-2">
                <Award className="h-4 w-4 text-amber-400" />
                <div>
                  <p className="text-xs font-semibold text-[var(--sb-text)]">{fmt(ms.amount)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)] capitalize">{getMonthLabel(ms.month)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Monthly Tab — the core: income + balances → deduced expenses
   ════════════════════════════════════════════════════════════ */

function MonthlyTab({
  selectedMonth, setSelectedMonth, income, accounts, balanceByMonth, monthlyRecurringTotal,
  totalIncomeFn, totalBudgetIncomeFn, totalBalanceFn, deducedExpensesFn,
  onAddIncome, onDeleteIncome, onAddSnapshot, onSaveSnapshot,
  monthNote, onSaveNote, budgetCycle, onSaveBudgetCycle,
}: {
  selectedMonth: string;
  setSelectedMonth: (m: string) => void;
  income: Income[];
  accounts: Account[];
  balanceByMonth: Record<string, Record<string, number>>;
  monthlyRecurringTotal: number;
  totalIncomeFn: (m: string) => number;
  totalBudgetIncomeFn: (m: string) => number;
  totalBalanceFn: (m: string) => number | null;
  deducedExpensesFn: (m: string) => number | null;
  onAddIncome: () => void;
  onDeleteIncome: (id: string) => void;
  onAddSnapshot: () => void;
  onSaveSnapshot: (data: { account_id: string; balance: number; snapshot_month: string }) => void | Promise<void>;
  monthNote: string;
  onSaveNote: (note: string) => void;
  budgetCycle: BudgetCycle | null;
  onSaveBudgetCycle: (data: { planned_savings: number; planned_variable_spending: number; notes: string }) => void | Promise<void>;
}) {
  const [editingNote, setEditingNote] = useState(false);
  const [noteText, setNoteText] = useState(monthNote);
  const [editingPlan, setEditingPlan] = useState(false);
  const [planSavings, setPlanSavings] = useState(String(budgetCycle?.planned_savings ?? 0));
  const [planVariable, setPlanVariable] = useState(String(budgetCycle?.planned_variable_spending ?? 0));
  const [planNotes, setPlanNotes] = useState(budgetCycle?.notes ?? "");
  const [editingBalance, setEditingBalance] = useState<{ accountId: string; value: string } | null>(null);
  const [savingBalanceId, setSavingBalanceId] = useState<string | null>(null);

  // Sync note text when month changes
  const [prevSelectedMonth, setPrevSelectedMonth] = useState(selectedMonth);
  if (selectedMonth !== prevSelectedMonth) {
    setPrevSelectedMonth(selectedMonth);
    setNoteText(monthNote);
    setPlanSavings(String(budgetCycle?.planned_savings ?? 0));
    setPlanVariable(String(budgetCycle?.planned_variable_spending ?? 0));
    setPlanNotes(budgetCycle?.notes ?? "");
    setEditingNote(false);
    setEditingPlan(false);
    setEditingBalance(null);
  }

  const monthIncome = income.filter((i) => i.month === selectedMonth);
  const budgetIncomeEntries = income.filter((i) => (i.budget_month || i.month) === selectedMonth);
  const totalInc = totalIncomeFn(selectedMonth);
  const totalBudgetInc = totalBudgetIncomeFn(selectedMonth);
  const totalBal = totalBalanceFn(selectedMonth);
  const previousBal = totalBalanceFn(prevMonth(selectedMonth));
  const expenses = deducedExpensesFn(selectedMonth);
  const monthBalances = balanceByMonth[selectedMonth] || {};
  const realSavings = totalBal !== null && previousBal !== null ? totalBal - previousBal : null;
  const plannedSavings = Number(budgetCycle?.planned_savings ?? 0);
  const plannedVariable = Number(budgetCycle?.planned_variable_spending ?? 0);
  const plannedFree = totalBudgetInc - monthlyRecurringTotal - plannedSavings - plannedVariable;
  const savingsDelta = realSavings !== null ? realSavings - plannedSavings : null;

  async function savePlan() {
    await onSaveBudgetCycle({
      planned_savings: Number(planSavings) || 0,
      planned_variable_spending: Number(planVariable) || 0,
      notes: planNotes,
    });
    setEditingPlan(false);
  }

  function startBalanceEdit(accountId: string, currentBalance: number | undefined) {
    setEditingBalance({ accountId, value: currentBalance !== undefined ? String(currentBalance) : "" });
  }

  async function saveInlineBalance(accountId: string) {
    if (!editingBalance || editingBalance.accountId !== accountId) return;
    const value = editingBalance.value.trim();
    if (value === "") return;
    const balance = Number(value);
    if (!Number.isFinite(balance)) return;

    setSavingBalanceId(accountId);
    try {
      await onSaveSnapshot({ account_id: accountId, balance, snapshot_month: selectedMonth });
      setEditingBalance(null);
    } finally {
      setSavingBalanceId(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <div className="flex items-center justify-center gap-3">
        <button onClick={() => setSelectedMonth(prevMonth(selectedMonth))} className="p-2 rounded-lg hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] cursor-pointer transition-colors">
          ←
        </button>
        <h2 className="text-sm font-semibold text-[var(--sb-text)] capitalize min-w-[160px] text-center">
          {getMonthLabel(selectedMonth)}
        </h2>
        <button onClick={() => setSelectedMonth(nextMonth(selectedMonth))} className="p-2 rounded-lg hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] cursor-pointer transition-colors">
          →
        </button>
      </div>

      {/* Monthly note */}
      <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-3">
        {editingNote ? (
          <div className="flex gap-2">
            <input
              type="text" value={noteText} onChange={(e) => setNoteText(e.target.value)}
              className="flex-1 rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] px-3 py-1.5 text-xs text-[var(--sb-text)] focus:border-indigo-500 focus:outline-none"
              placeholder="Es: Vacanza, bonus, spesa imprevista..."
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") { onSaveNote(noteText); setEditingNote(false); } if (e.key === "Escape") { setNoteText(monthNote); setEditingNote(false); } }}
            />
            <button onClick={() => { onSaveNote(noteText); setEditingNote(false); }} className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs hover:bg-indigo-500 transition-colors cursor-pointer">Salva</button>
            <button onClick={() => { setNoteText(monthNote); setEditingNote(false); }} className="px-2.5 py-1.5 rounded-lg border border-[var(--sb-border)] text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer">Annulla</button>
          </div>
        ) : (
          <button onClick={() => setEditingNote(true)} className="w-full text-left flex items-center gap-2 cursor-pointer group">
            <Edit2 className="h-3 w-3 text-[var(--sb-muted)] group-hover:text-indigo-400 shrink-0 transition-colors" />
            {monthNote ? (
              <span className="text-xs text-[var(--sb-text)]">{monthNote}</span>
            ) : (
              <span className="text-xs text-[var(--sb-muted)] italic group-hover:text-indigo-400 transition-colors">Aggiungi una nota per questo mese...</span>
            )}
          </button>
        )}
      </div>

      {/* Envelope plan */}
      <section className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-[var(--sb-text)]">Busta mensile</h3>
            <p className="mt-1 text-xs text-[var(--sb-muted)]">Piano semplice: budget assegnato, costi fissi, risparmio target, spesa variabile.</p>
          </div>
          {editingPlan ? (
            <div className="flex gap-2">
              <button onClick={savePlan} className="rounded-lg bg-cyan-600 px-3 py-1.5 text-xs text-white hover:bg-cyan-500">Salva</button>
              <button onClick={() => setEditingPlan(false)} className="rounded-lg border border-[var(--sb-border)] px-3 py-1.5 text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)]">Annulla</button>
            </div>
          ) : (
            <button onClick={() => setEditingPlan(true)} className="rounded-lg border border-[var(--sb-border)] px-3 py-1.5 text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]">
              Modifica piano
            </button>
          )}
        </div>

        {editingPlan ? (
          <div className="grid gap-3 md:grid-cols-3">
            <label>
              <span className="mb-1 block text-xs text-[var(--sb-muted)]">Obiettivo risparmio</span>
              <input type="number" value={planSavings} onChange={(e) => setPlanSavings(e.target.value)} className={inputCls} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--sb-muted)]">Spesa variabile pianificata</span>
              <input type="number" value={planVariable} onChange={(e) => setPlanVariable(e.target.value)} className={inputCls} />
            </label>
            <label>
              <span className="mb-1 block text-xs text-[var(--sb-muted)]">Nota piano</span>
              <input type="text" value={planNotes} onChange={(e) => setPlanNotes(e.target.value)} className={inputCls} placeholder="Es. mese leggero, vacanza, extra..." />
            </label>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <PlanTile label="Budget mese" value={fmt(totalBudgetInc)} tone="cyan" />
              <PlanTile label="Costi fissi" value={fmt(monthlyRecurringTotal)} tone="amber" />
              <PlanTile label="Risparmio target" value={fmt(plannedSavings)} tone="emerald" />
              <PlanTile label="Margine libero" value={fmt(plannedFree)} tone={plannedFree >= 0 ? "slate" : "red"} />
              <PlanTile label="Scostamento" value={savingsDelta !== null ? `${savingsDelta >= 0 ? "+" : ""}${fmt(savingsDelta)}` : "—"} tone={savingsDelta === null ? "slate" : savingsDelta >= 0 ? "emerald" : "red"} />
            </div>
            {budgetCycle?.notes && <p className="mt-3 text-xs text-[var(--sb-muted)]">{budgetCycle.notes}</p>}
          </>
        )}
      </section>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 text-center">
          <ArrowUpCircle className="h-4 w-4 text-emerald-400 mx-auto mb-1.5" />
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-0.5">Incassi reali</p>
          <p className="text-base font-semibold tabular-nums text-emerald-400">{fmt(totalInc)}</p>
        </div>
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 text-center">
          <Wallet className="h-4 w-4 text-cyan-400 mx-auto mb-1.5" />
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-0.5">Budget disponibile</p>
          <p className="text-base font-semibold tabular-nums text-cyan-400">{fmt(totalBudgetInc)}</p>
        </div>
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 text-center">
          <ArrowDownCircle className="h-4 w-4 text-red-400 mx-auto mb-1.5" />
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-0.5">Spese dedotte</p>
          <p className="text-base font-semibold tabular-nums text-red-400">{expenses !== null ? fmt(expenses) : "—"}</p>
        </div>
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 text-center">
          <TrendingUp className="h-4 w-4 text-indigo-400 mx-auto mb-1.5" />
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-0.5">Risparmio reale</p>
          <p className={cn("text-base font-semibold tabular-nums", realSavings !== null && realSavings >= 0 ? "text-emerald-400" : "text-red-400")}>
            {realSavings !== null ? (realSavings >= 0 ? "+" : "") + fmt(realSavings) : "—"}
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-4">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-4 w-4 shrink-0 text-cyan-400" />
          <div>
            <p className="text-sm font-medium text-[var(--sb-text)]">Budget operativo del mese</p>
            <p className="mt-1 text-xs leading-relaxed text-[var(--sb-muted)]">
              Spese effettive = budget assegnato al mese - risparmio reale dai saldi. Tu devi solo assegnare lo stipendio alla busta giusta e aggiornare i saldi.
            </p>
          </div>
        </div>
      </div>

      {/* Month-over-month comparison */}
      {(() => {
        const prev = prevMonth(selectedMonth);
        const prevInc = totalBudgetIncomeFn(prev);
        const prevExp = deducedExpensesFn(prev);
        if (expenses === null || prevExp === null) return null;
        const incDiff = totalBudgetInc - prevInc;
        const expDiff = expenses - prevExp;
        const savedThis = totalBudgetInc - expenses;
        const savedPrev = prevInc - prevExp;
        const saveDiff = savedThis - savedPrev;
        return (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
            <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-2">Rispetto al mese scorso</p>
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {incDiff >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                  <span className={cn("text-xs font-semibold tabular-nums", incDiff >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {incDiff >= 0 ? "+" : ""}{fmt(incDiff)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">Budget</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {expDiff <= 0 ? <TrendingDown className="h-3 w-3 text-emerald-400" /> : <TrendingUp className="h-3 w-3 text-red-400" />}
                  <span className={cn("text-xs font-semibold tabular-nums", expDiff <= 0 ? "text-emerald-400" : "text-red-400")}>
                    {expDiff >= 0 ? "+" : ""}{fmt(expDiff)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">Spese</p>
              </div>
              <div className="text-center">
                <div className="flex items-center justify-center gap-1">
                  {saveDiff >= 0 ? <TrendingUp className="h-3 w-3 text-emerald-400" /> : <TrendingDown className="h-3 w-3 text-red-400" />}
                  <span className={cn("text-xs font-semibold tabular-nums", saveDiff >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {saveDiff >= 0 ? "+" : ""}{fmt(saveDiff)}
                  </span>
                </div>
                <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">Risparmio</p>
              </div>
            </div>
          </div>
        );
      })()}

      {expenses === null && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center">
          <AlertCircle className="h-5 w-5 text-amber-400 mx-auto mb-2" />
          <p className="text-sm text-[var(--sb-text)]">Inserisci i saldi di questo mese e del mese precedente per calcolare le spese</p>
          <p className="text-xs text-[var(--sb-muted)] mt-1">Spese = Budget del mese − (Saldo fine mese − Saldo mese precedente)</p>
        </div>
      )}

      {/* Income entries */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--sb-text)] flex items-center gap-1.5">
            <ArrowUpCircle className="h-3.5 w-3.5 text-emerald-400" />
            Entrate del mese
          </h3>
          <button onClick={onAddIncome} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white hover:bg-emerald-500 transition-colors cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Aggiungi
          </button>
        </div>
        {monthIncome.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-6 text-center">
            <p className="text-xs text-[var(--sb-muted)]">Nessuna entrata registrata per questo mese</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
            {monthIncome.map((inc, i) => (
              <div key={inc.id} className={cn("flex items-center gap-3 px-4 py-3 group", i < monthIncome.length - 1 && "border-b border-[var(--sb-border)]")}>
                <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400 shrink-0">
                  <ArrowUpCircle className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--sb-text)]">{inc.label}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">
                    Finanzia {getMonthLabel(inc.budget_month || inc.month)}
                  </p>
                </div>
                <span className="text-sm font-medium tabular-nums text-emerald-400">+{fmt(Number(inc.amount))}</span>
                <button onClick={() => onDeleteIncome(inc.id)} className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 cursor-pointer transition-all">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Budget funded by income entries */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--sb-text)] flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
            Budget che finanzia questo mese
          </h3>
          <span className="text-xs font-semibold tabular-nums text-cyan-400">{fmt(totalBudgetInc)}</span>
        </div>
        {budgetIncomeEntries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-6 text-center">
            <p className="text-xs text-[var(--sb-muted)]">Nessuna entrata assegnata come budget per questo mese</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
            {budgetIncomeEntries.map((inc, i) => (
              <div key={inc.id} className={cn("flex items-center gap-3 px-4 py-3", i < budgetIncomeEntries.length - 1 && "border-b border-[var(--sb-border)]")}>
                <div className="w-8 h-8 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-400 shrink-0">
                  <Wallet className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-[var(--sb-text)]">{inc.label}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Incassato in {getMonthLabel(inc.month)}</p>
                </div>
                <span className="text-sm font-medium tabular-nums text-cyan-400">{fmt(Number(inc.amount))}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Account balances for this month */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-medium text-[var(--sb-text)] flex items-center gap-1.5">
            <Wallet className="h-3.5 w-3.5 text-indigo-400" />
            Saldi fine mese
          </h3>
          <button onClick={onAddSnapshot} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 transition-colors cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Aggiorna saldo
          </button>
        </div>
        {accounts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-6 text-center">
            <p className="text-xs text-[var(--sb-muted)]">Crea prima un conto nella tab &quot;Conti&quot;</p>
          </div>
        ) : (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
            {accounts.map((acc, i) => {
              const bal = monthBalances[acc.id];
              const prevMonthBal = (balanceByMonth[prevMonth(selectedMonth)] || {})[acc.id];
              const change = bal !== undefined && prevMonthBal !== undefined ? bal - prevMonthBal : null;
              const isEditing = editingBalance?.accountId === acc.id;
              const isSaving = savingBalanceId === acc.id;
              return (
                <div key={acc.id} className={cn("flex items-center gap-3 px-4 py-3", i < accounts.length - 1 && "border-b border-[var(--sb-border)]")}>
                  <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                    <Landmark className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-[var(--sb-text)]">{acc.name}</p>
                  </div>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <input
                        type="number"
                        step="0.01"
                        value={editingBalance.value}
                        onChange={(e) => setEditingBalance({ accountId: acc.id, value: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveInlineBalance(acc.id);
                          if (e.key === "Escape") setEditingBalance(null);
                        }}
                        className="h-9 w-32 rounded-lg border border-indigo-500/40 bg-[var(--sb-card)] px-2 text-right text-sm tabular-nums text-[var(--sb-text)] outline-none focus:border-indigo-400"
                        placeholder="0.00"
                        autoFocus
                        disabled={isSaving}
                      />
                      <button
                        onClick={() => saveInlineBalance(acc.id)}
                        disabled={isSaving || editingBalance.value.trim() === ""}
                        className="sb-focus flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-600 text-white transition-colors hover:bg-indigo-500 disabled:opacity-50"
                        aria-label={`Salva saldo ${acc.name}`}
                        title="Salva"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setEditingBalance(null)}
                        disabled={isSaving}
                        className="sb-focus flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--sb-border)] text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]"
                        aria-label={`Annulla modifica saldo ${acc.name}`}
                        title="Annulla"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => startBalanceEdit(acc.id, bal)}
                      className="group flex min-w-[128px] items-center justify-end gap-2 rounded-lg px-2 py-1 text-right transition-colors hover:bg-[var(--sb-hover)]"
                      aria-label={`${bal !== undefined ? "Modifica" : "Inserisci"} saldo ${acc.name}`}
                    >
                      {bal !== undefined ? (
                        <div>
                          <p className="text-sm font-medium tabular-nums text-[var(--sb-text)]">{fmt(bal, acc.currency)}</p>
                          {change !== null && (
                            <p className={cn("text-[10px] tabular-nums", change >= 0 ? "text-emerald-400" : "text-red-400")}>
                              {change >= 0 ? "+" : ""}{fmt(change, acc.currency)}
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-[var(--sb-muted)] group-hover:text-indigo-400">Inserisci</span>
                      )}
                      <Edit2 className="h-3.5 w-3.5 text-[var(--sb-muted)] opacity-70 transition-colors group-hover:text-indigo-400" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {totalBal !== null && (
          <div className="flex justify-between items-center mt-2 px-4">
            <span className="text-xs text-[var(--sb-muted)]">Totale</span>
            <span className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">{fmt(totalBal)}</span>
          </div>
        )}
      </section>
    </div>
  );
}

function PlanTile({ label, value, tone }: { label: string; value: string; tone: "cyan" | "amber" | "emerald" | "slate" | "red" }) {
  const toneClass = {
    cyan: "text-cyan-400",
    amber: "text-amber-400",
    emerald: "text-emerald-400",
    slate: "text-[var(--sb-text)]",
    red: "text-red-400",
  }[tone];

  return (
    <div className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-3">
      <p className="text-[10px] uppercase text-[var(--sb-muted)]">{label}</p>
      <p className={cn("mt-1 text-base font-semibold tabular-nums", toneClass)}>{value}</p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Recurring Tab
   ════════════════════════════════════════════════════════════ */

const CATEGORY_BAR_COLORS: Record<string, string> = {
  casa: "bg-indigo-500", trasporti: "bg-amber-500", cibo: "bg-emerald-500",
  salute: "bg-red-500", abbigliamento: "bg-pink-500", intrattenimento: "bg-purple-500",
  istruzione: "bg-blue-500", tecnologia: "bg-cyan-500", abbonamenti: "bg-orange-500",
  assicurazioni: "bg-slate-500", tasse: "bg-red-600", viaggi: "bg-teal-500", altro: "bg-slate-400",
};

function RecurringTab({
  recurring, monthlyTotal, latestMonthlyIncome, onAdd, onEdit, onDelete,
}: {
  recurring: Recurring[];
  monthlyTotal: number;
  latestMonthlyIncome: number;
  onAdd: () => void;
  onEdit: (r: Recurring) => void;
  onDelete: (id: string) => void;
}) {
  const freqLabel = { monthly: "mensile", quarterly: "trimestrale", annual: "annuale" };

  // Group by category with monthly equivalent
  const categoryTotals = useMemo(() => {
    const cats: Record<string, number> = {};
    recurring.forEach((r) => {
      const a = Number(r.amount);
      let monthly = a;
      if (r.frequency === "quarterly") monthly = a / 3;
      if (r.frequency === "annual") monthly = a / 12;
      cats[r.category] = (cats[r.category] || 0) + monthly;
    });
    return Object.entries(cats).sort((a, b) => b[1] - a[1]);
  }, [recurring]);

  const maxCatAmount = categoryTotals.length > 0 ? categoryTotals[0][1] : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--sb-muted)]">Costo mensile equivalente</p>
          <p className="text-lg font-semibold tabular-nums text-[var(--sb-text)]">{fmt(monthlyTotal)}</p>
        </div>
        <button onClick={onAdd} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 transition-colors cursor-pointer">
          <Plus className="h-3.5 w-3.5" /> Aggiungi
        </button>
      </div>

      {/* Category breakdown with horizontal bars + % of income */}
      {categoryTotals.length > 0 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-3">Per categoria (equivalente mensile)</p>
          <div className="space-y-2.5">
            {categoryTotals.map(([cat, amount]) => {
              const pct = maxCatAmount > 0 ? (amount / maxCatAmount) * 100 : 0;
              const incPct = latestMonthlyIncome > 0 ? (amount / latestMonthlyIncome) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-[var(--sb-text)] capitalize flex items-center gap-1.5">
                      {cat}
                      {incPct > 15 && <AlertCircle className="h-3 w-3 text-amber-400" />}
                    </span>
                    <span className="text-xs font-medium tabular-nums text-[var(--sb-muted)]">
                      {fmt(amount)}
                      {latestMonthlyIncome > 0 && <span className={cn("ml-1.5", incPct > 15 ? "text-amber-400" : "")}>{incPct.toFixed(0)}%</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
                    <div
                      className={cn("h-full rounded-full transition-all duration-500", CATEGORY_BAR_COLORS[cat] || "bg-slate-500")}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          {latestMonthlyIncome > 0 && (
            <p className="text-[10px] text-[var(--sb-muted)] mt-3 pt-2 border-t border-[var(--sb-border)]">
              Le percentuali indicano il peso di ogni categoria sulle entrate mensili ({fmt(latestMonthlyIncome)})
            </p>
          )}
        </div>
      )}

      {/* Item list */}
      {recurring.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
          <RotateCcw className="h-8 w-8 text-[var(--sb-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--sb-muted)]">Nessuna spesa ricorrente</p>
        </div>
      ) : (
        <div className="space-y-2">
          {recurring.map((r) => (
            <div key={r.id} className="group rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 hover:bg-[var(--sb-hover)] transition-all">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-[var(--sb-text)]">{r.name}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--sb-card)] text-[var(--sb-muted)] capitalize">{r.category}</span>
                    <span className="text-[10px] text-[var(--sb-muted)] capitalize">{freqLabel[r.frequency]}</span>
                    <span className="text-[10px] text-[var(--sb-muted)]">
                      Prossima: {format(parseISO(r.next_due_date), "d MMM yyyy", { locale: it })}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">{fmt(Number(r.amount), r.currency)}</span>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => onEdit(r)} className="p-1 rounded hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] cursor-pointer"><Edit2 className="h-3 w-3" /></button>
                    <button onClick={() => onDelete(r.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Commitments Tab
   ════════════════════════════════════════════════════════════ */

function CommitmentsTab({
  commitments, onAdd, onEdit, onDelete, onUpdateSaved,
}: {
  commitments: Commitment[];
  onAdd: () => void;
  onEdit: (c: Commitment) => void;
  onDelete: (id: string) => void;
  onUpdateSaved: (id: string, data: Partial<Commitment>) => void;
}) {
  const debts = commitments.filter((c) => c.goal_type !== "savings");
  const savings = commitments.filter((c) => c.goal_type === "savings");
  const typeLabels: Record<string, string> = { mortgage: "Mutuo", loan: "Prestito", lease: "Leasing", other: "Altro" };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--sb-text)]">Debiti & Obiettivi</h2>
        <button onClick={onAdd} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 transition-colors cursor-pointer">
          <Plus className="h-3.5 w-3.5" /> Aggiungi
        </button>
      </div>

      {debts.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-2 flex items-center gap-1.5">
            <CreditCard className="h-3.5 w-3.5" /> Debiti & Rate
          </h3>
          <div className="space-y-2">
            {debts.map((c) => {
              const pct = c.total_installments && c.total_installments > 0
                ? (c.paid_installments / c.total_installments) * 100
                : Number(c.original_amount) > 0
                  ? ((Number(c.original_amount) - Number(c.remaining_amount)) / Number(c.original_amount)) * 100
                  : 0;
              return (
                <div key={c.id} className="group rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--sb-text)]">{c.name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[10px] text-[var(--sb-muted)]">{typeLabels[c.type] || c.type}</span>
                        <span className="text-[10px] text-[var(--sb-muted)]">Rata: {fmt(Number(c.monthly_payment), c.currency)}</span>
                        {c.due_day && <span className="text-[10px] text-[var(--sb-muted)]">il {c.due_day} del mese</span>}
                        {c.total_installments && <span className="text-[10px] text-[var(--sb-muted)]">{c.paid_installments}/{c.total_installments} rate</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-[var(--sb-muted)]">{fmt(Number(c.remaining_amount), c.currency)}</span>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(c)} className="p-1 rounded hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] cursor-pointer"><Edit2 className="h-3 w-3" /></button>
                        <button onClick={() => onDelete(c.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full bg-[var(--sb-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-[var(--sb-muted)]">
                      {pct.toFixed(0)}% completato · Residuo: {fmt(Number(c.remaining_amount), c.currency)}
                    </p>
                    {c.total_installments && c.paid_installments < c.total_installments && (
                      <button
                        onClick={() => {
                          const newPaid = c.paid_installments + 1;
                          const newRemaining = Math.max(0, (c.total_installments! - newPaid) * Number(c.monthly_payment));
                          onUpdateSaved(c.id, {
                            paid_installments: newPaid,
                            remaining_amount: newRemaining,
                            last_auto_paid_month: format(new Date(), "yyyy-MM"),
                          });
                        }}
                        className="flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-colors cursor-pointer"
                      >
                        <Check className="h-3 w-3" /> Ho pagato una rata
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {savings.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-2 flex items-center gap-1.5">
            <PiggyBank className="h-3.5 w-3.5" /> Obiettivi di risparmio
          </h3>
          <div className="space-y-2">
            {savings.map((c) => {
              const target = Number(c.target_amount) || Number(c.original_amount);
              const saved = Number(c.current_saved);
              const pct = target > 0 ? Math.min((saved / target) * 100, 100) : 0;
              return (
                <div key={c.id} className="group rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-[var(--sb-text)]">{c.name}</p>
                      <p className="text-[10px] text-[var(--sb-muted)] mt-0.5">{fmt(saved)} / {fmt(target)}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          const add = prompt("Quanto vuoi aggiungere?");
                          if (add && !isNaN(Number(add))) onUpdateSaved(c.id, { current_saved: saved + Number(add) });
                        }}
                        className="text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                      >+ Aggiungi</button>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => onEdit(c)} className="p-1 rounded hover:bg-[var(--sb-hover)] text-[var(--sb-muted)] cursor-pointer"><Edit2 className="h-3 w-3" /></button>
                        <button onClick={() => onDelete(c.id)} className="p-1 rounded hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 cursor-pointer"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all" style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[10px] text-[var(--sb-muted)]">{pct.toFixed(0)}% raggiunto</p>
                    {Number(c.monthly_payment) > 0 && saved < target && (() => {
                      const remaining = target - saved;
                      const monthsLeft = Math.ceil(remaining / Number(c.monthly_payment));
                      const projDate = addMonths(new Date(), monthsLeft);
                      return (
                        <p className="text-[10px] text-indigo-400 flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {format(projDate, "MMMM yyyy", { locale: it })}
                        </p>
                      );
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {commitments.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
          <Target className="h-8 w-8 text-[var(--sb-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--sb-muted)]">Nessun impegno finanziario</p>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   ETF Portfolio Tab
   ════════════════════════════════════════════════════════════ */

function PortfolioTab({
  accounts, instruments, transactions, plans, positions, syncing,
  onSync, onAddInstrument, onAddTransaction, onAddPlan, onDeletePlan,
}: {
  accounts: Account[];
  instruments: InvestmentInstrument[];
  transactions: InvestmentTransaction[];
  plans: InvestmentPlan[];
  positions: InvestmentPosition[];
  syncing: boolean;
  onSync: () => void;
  onAddInstrument: () => void;
  onAddTransaction: () => void;
  onAddPlan: () => void;
  onDeletePlan: (id: string) => void;
}) {
  const investmentAccounts = accounts.filter((account) => account.type === "investment");
  const totalValue = positions.reduce((sum, position) => sum + position.value, 0);
  const totalCost = positions.reduce((sum, position) => sum + position.netCost, 0);
  const totalPnl = totalValue - totalCost;
  const activePlans = plans.filter((plan) => plan.is_active);
  const accountName = (id: string) => accounts.find((account) => account.id === id)?.name || "Conto investimento";
  const instrumentName = (id: string) => instruments.find((instrument) => instrument.id === id)?.name || "ETF";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <MetricCard label="Valore ETF" value={fmt(totalValue)} tone="positive" />
        <MetricCard label="Investito netto" value={fmt(totalCost)} />
        <MetricCard label="P/L totale" value={`${totalPnl >= 0 ? "+" : ""}${fmt(totalPnl)}`} tone={totalPnl >= 0 ? "positive" : "negative"} />
        <MetricCard label="PAC attivi" value={String(activePlans.length)} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[var(--sb-text)]">Portafoglio ETF</h2>
          <p className="mt-1 text-xs text-[var(--sb-muted)]">Prezzi da Twelve Data, movimenti manuali e PAC mensili automatici.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={onSync} disabled={syncing || instruments.length === 0} className="flex items-center gap-1 rounded-lg border border-[var(--sb-border)] px-3 py-1.5 text-xs text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)] disabled:opacity-50">
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} /> Aggiorna prezzi
          </button>
          <button onClick={onAddInstrument} className="flex items-center gap-1 rounded-lg border border-[var(--sb-border)] px-3 py-1.5 text-xs text-[var(--sb-muted)] transition-colors hover:bg-[var(--sb-hover)] hover:text-[var(--sb-text)]">
            <Plus className="h-3.5 w-3.5" /> ETF
          </button>
          <button onClick={onAddTransaction} disabled={investmentAccounts.length === 0 || instruments.length === 0} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-indigo-500 disabled:opacity-50">
            <Plus className="h-3.5 w-3.5" /> Movimento
          </button>
          <button onClick={onAddPlan} disabled={investmentAccounts.length === 0 || instruments.length === 0} className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs text-white transition-colors hover:bg-emerald-500 disabled:opacity-50">
            <RotateCcw className="h-3.5 w-3.5" /> PAC
          </button>
        </div>
      </div>

      {investmentAccounts.length === 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
          <p className="text-sm font-medium text-[var(--sb-text)]">Crea un conto di tipo Investimento</p>
          <p className="mt-1 text-xs text-[var(--sb-muted)]">Gli ETF e i PAC vengono collegati a un conto investimento nella tab Conti.</p>
        </div>
      )}

      {positions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
          <TrendingUp className="mx-auto mb-2 h-8 w-8 text-[var(--sb-muted)] opacity-40" />
          <p className="text-sm text-[var(--sb-muted)]">Aggiungi un ETF e registra il primo acquisto.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
          {positions.map((position, index) => {
            const updatedAt = position.instrument.last_price_at ? format(parseISO(position.instrument.last_price_at), "dd/MM HH:mm") : null;
            return (
              <div key={position.instrument.id} className={cn("grid gap-3 px-4 py-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr]", index < positions.length - 1 && "border-b border-[var(--sb-border)]")}>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--sb-text)]">{position.instrument.name}</p>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">
                    {position.instrument.symbol}{position.instrument.exchange ? ` · ${position.instrument.exchange}` : ""} · {accountName(position.accountId)}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">Quote</p>
                  <p className="text-sm font-medium tabular-nums text-[var(--sb-text)]">{position.shares.toFixed(6)}</p>
                </div>
                <div>
                  <p className="text-[10px] uppercase text-[var(--sb-muted)]">Prezzo</p>
                  <p className="text-sm font-medium tabular-nums text-[var(--sb-text)]">{position.instrument.last_price ? fmt(Number(position.instrument.last_price), position.instrument.currency) : "—"}</p>
                  {updatedAt && <p className="text-[10px] text-[var(--sb-muted)]">{updatedAt}</p>}
                </div>
                <div className="md:text-right">
                  <p className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">{fmt(position.value, position.instrument.currency)}</p>
                  <p className={cn("text-xs tabular-nums", position.pnl >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {position.pnl >= 0 ? "+" : ""}{fmt(position.pnl, position.instrument.currency)} · {position.pnlPct.toFixed(1)}%
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-[var(--sb-text)] flex items-center gap-1.5">
            <RotateCcw className="h-3.5 w-3.5 text-emerald-400" /> PAC configurati
          </h3>
          <span className="text-xs text-[var(--sb-muted)]">{activePlans.length} attivi</span>
        </div>
        {activePlans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-6 text-center">
            <p className="text-xs text-[var(--sb-muted)]">Nessun PAC configurato.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activePlans.map((plan) => (
              <div key={plan.id} className="group flex items-center gap-3 rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-400">
                  <RotateCcw className="h-4 w-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-[var(--sb-text)]">{plan.name}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">
                    Giorno {plan.day_of_month} · {instrumentName(plan.instrument_id)} · {accountName(plan.account_id)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmt(Number(plan.amount), plan.currency)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">Ultimo: {plan.last_executed_month || "mai"}</p>
                </div>
                <button onClick={() => onDeletePlan(plan.id)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 transition-all cursor-pointer">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {transactions.length > 0 && (
        <section>
          <h3 className="mb-3 text-sm font-medium text-[var(--sb-text)]">Ultimi movimenti</h3>
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] overflow-hidden">
            {transactions.slice(0, 8).map((tx, index) => (
              <div key={tx.id} className={cn("flex items-center gap-3 px-4 py-3", index < Math.min(transactions.length, 8) - 1 && "border-b border-[var(--sb-border)]")}>
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", tx.type === "buy" ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400")}>
                  {tx.type === "buy" ? <ArrowUpCircle className="h-4 w-4" /> : <ArrowDownCircle className="h-4 w-4" />}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm text-[var(--sb-text)]">{instrumentName(tx.instrument_id)}</p>
                  <p className="text-[10px] text-[var(--sb-muted)]">{format(parseISO(tx.trade_date), "dd/MM/yyyy")} · {tx.source === "pac" ? "PAC" : "manuale"}</p>
                </div>
                <p className="text-sm font-medium tabular-nums text-[var(--sb-text)]">{Number(tx.shares).toFixed(6)} quote</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Accounts Tab
   ════════════════════════════════════════════════════════════ */

function AccountsTab({
  accounts, latestBalances, onAddAccount, onAddSnapshot, onDeleteAccount,
}: {
  accounts: Account[];
  latestBalances: Record<string, number>;
  onAddAccount: () => void;
  onAddSnapshot: () => void;
  onDeleteAccount: (id: string) => void;
}) {
  const typeLabels: Record<string, string> = { checking: "Conto corrente", savings: "Risparmio", investment: "Investimento", other: "Asset fisico" };
  const typeIcons: Record<string, typeof Wallet> = { checking: Landmark, savings: PiggyBank, investment: TrendingUp, other: Home };

  // Split accounts into liquid vs physical assets
  const liquidAccounts = accounts.filter((a) => a.type !== "other");
  const assetAccounts = accounts.filter((a) => a.type === "other");
  const liquidTotal = liquidAccounts.reduce((s, a) => s + (latestBalances[a.id] ?? 0), 0);
  const assetTotal = assetAccounts.reduce((s, a) => s + (latestBalances[a.id] ?? 0), 0);
  const total = liquidTotal + assetTotal;

  const renderAccountList = (list: Account[]) => (
    <div className="space-y-2">
      {list.map((acc) => {
        const Icon = typeIcons[acc.type] || Wallet;
        const isAsset = acc.type === "other";
        return (
          <div key={acc.id} className="group rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-full flex items-center justify-center shrink-0", isAsset ? "bg-amber-500/10 text-amber-400" : "bg-indigo-500/10 text-indigo-400")}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-[var(--sb-text)]">{acc.name}</p>
              <p className="text-[10px] text-[var(--sb-muted)]">{typeLabels[acc.type]}</p>
            </div>
            <span className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">
              {fmt(latestBalances[acc.id] ?? 0, acc.currency)}
            </span>
            <button onClick={() => onDeleteAccount(acc.id)} className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/10 text-[var(--sb-muted)] hover:text-red-400 transition-all cursor-pointer">
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-[var(--sb-muted)]">Patrimonio totale</p>
          <p className="text-lg font-semibold tabular-nums text-[var(--sb-text)]">{fmt(total)}</p>
          {assetTotal > 0 && (
            <div className="flex gap-3 mt-0.5">
              <span className="text-[10px] text-[var(--sb-muted)]">Liquidità: {fmt(liquidTotal)}</span>
              <span className="text-[10px] text-amber-400">Asset: {fmt(assetTotal)}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onAddSnapshot} className="flex items-center gap-1 rounded-lg border border-[var(--sb-border)] px-3 py-1.5 text-xs text-[var(--sb-muted)] hover:text-[var(--sb-text)] transition-colors cursor-pointer">
            <Calendar className="h-3.5 w-3.5" /> Aggiorna saldo
          </button>
          <button onClick={onAddAccount} className="flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs text-white hover:bg-indigo-500 transition-colors cursor-pointer">
            <Plus className="h-3.5 w-3.5" /> Nuovo conto
          </button>
        </div>
      </div>

      {accounts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--sb-border)] p-8 text-center">
          <Building className="h-8 w-8 text-[var(--sb-muted)] mx-auto mb-2 opacity-40" />
          <p className="text-sm text-[var(--sb-muted)]">Nessun conto configurato</p>
        </div>
      ) : (
        <>
          {/* Liquid accounts */}
          {liquidAccounts.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-2 flex items-center gap-1.5">
                <Landmark className="h-3.5 w-3.5" /> Conti & Investimenti
              </h3>
              {renderAccountList(liquidAccounts)}
            </section>
          )}

          {/* Physical assets */}
          {assetAccounts.length > 0 && (
            <section>
              <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-2 flex items-center gap-1.5">
                <Home className="h-3.5 w-3.5" /> Asset fisici
              </h3>
              {renderAccountList(assetAccounts)}
            </section>
          )}
        </>
      )}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Analytics Tab
   ════════════════════════════════════════════════════════════ */

const ESSENTIAL_CATEGORIES = new Set(["casa", "trasporti", "cibo", "salute", "assicurazioni", "tasse"]);
const HEATMAP_COLORS = ["bg-slate-800", "bg-red-900", "bg-red-700", "bg-amber-600", "bg-emerald-700", "bg-emerald-500"];

function AnalyticsTab({
  healthScore, totalIncomeFn, deducedExpensesFn, snapshots,
  recurring, monthlyRecurringTotal, currentTotalAssets, movingAverages, commitments,
}: {
  healthScore: { score: number; maxScore: number; pct: number; details: { label: string; points: number; max: number; tip: string }[] } | null;
  totalIncomeFn: (m: string) => number;
  deducedExpensesFn: (m: string) => number | null;
  snapshots: Snapshot[];
  recurring: Recurring[];
  monthlyRecurringTotal: number;
  currentTotalAssets: number;
  movingAverages: { expenses3m: number | null; expenses6m: number | null; income3m: number | null; income6m: number | null; monthsUsed3: number; monthsUsed6: number };
  commitments: Commitment[];
}) {
  // What-if state
  const [extraSaving, setExtraSaving] = useState(0);
  const [whatIfMonths, setWhatIfMonths] = useState(12);

  // YoY data
  const yoyData = useMemo(() => {
    const thisYear = new Date().getFullYear();
    const months: { monthLabel: string; thisIncome: number; thisExpenses: number | null; prevIncome: number; prevExpenses: number | null; thisSaved: number | null; prevSaved: number | null }[] = [];
    for (let m = 0; m < 12; m++) {
      const thisM = `${thisYear}-${String(m + 1).padStart(2, "0")}`;
      const prevM = `${thisYear - 1}-${String(m + 1).padStart(2, "0")}`;
      const thisInc = totalIncomeFn(thisM);
      const thisExp = deducedExpensesFn(thisM);
      const prevInc = totalIncomeFn(prevM);
      const prevExp = deducedExpensesFn(prevM);
      months.push({
        monthLabel: format(new Date(thisYear, m, 1), "MMM", { locale: it }),
        thisIncome: thisInc, thisExpenses: thisExp,
        prevIncome: prevInc, prevExpenses: prevExp,
        thisSaved: thisExp !== null ? thisInc - thisExp : null,
        prevSaved: prevExp !== null ? prevInc - prevExp : null,
      });
    }
    return months;
  }, [totalIncomeFn, deducedExpensesFn]);

  const hasYoYData = yoyData.some((m) => m.thisExpenses !== null || m.prevExpenses !== null);

  // Seasonal trends (heatmap)
  const seasonalGrid = useMemo(() => {
    const allMonths = Array.from(new Set(snapshots.map((s) => s.snapshot_month.slice(0, 7)))).sort();
    const years = Array.from(new Set(allMonths.map((m) => m.slice(0, 4)))).sort();
    if (years.length < 1) return null;

    const grid: { year: string; months: { month: number; saved: number | null }[] }[] = [];
    for (const y of years) {
      const months: { month: number; saved: number | null }[] = [];
      for (let m = 0; m < 12; m++) {
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        const inc = totalIncomeFn(key);
        const exp = deducedExpensesFn(key);
        months.push({ month: m, saved: exp !== null ? inc - exp : null });
      }
      grid.push({ year: y, months });
    }
    return grid;
  }, [snapshots, totalIncomeFn, deducedExpensesFn]);

  // 50/30/20 breakdown
  const rule503020 = useMemo(() => {
    const avgInc = movingAverages.income6m ?? movingAverages.income3m;
    const avgExp = movingAverages.expenses6m ?? movingAverages.expenses3m;
    if (!avgInc || avgInc <= 0 || avgExp === null) return null;

    let needs = 0;
    let wants = 0;
    recurring.forEach((r) => {
      const a = Number(r.amount);
      let monthly = a;
      if (r.frequency === "quarterly") monthly = a / 3;
      if (r.frequency === "annual") monthly = a / 12;
      if (ESSENTIAL_CATEGORIES.has(r.category)) needs += monthly;
      else wants += monthly;
    });

    // Untracked spending = deduced expenses - recurring total
    const untracked = Math.max(0, avgExp - monthlyRecurringTotal);
    wants += untracked; // conservative: untracked goes to wants

    const savings = avgInc - avgExp;

    return {
      needs, wants, savings,
      needsPct: (needs / avgInc) * 100,
      wantsPct: (wants / avgInc) * 100,
      savingsPct: (savings / avgInc) * 100,
      income: avgInc,
    };
  }, [movingAverages, recurring, monthlyRecurringTotal]);

  // What-if projections
  const whatIfData = useMemo(() => {
    const avgSaving = movingAverages.income6m && movingAverages.expenses6m
      ? movingAverages.income6m - movingAverages.expenses6m
      : movingAverages.income3m && movingAverages.expenses3m
        ? movingAverages.income3m - movingAverages.expenses3m
        : null;
    if (avgSaving === null) return null;

    const baseFuture = currentTotalAssets + avgSaving * whatIfMonths;
    const extraFuture = currentTotalAssets + (avgSaving + extraSaving) * whatIfMonths;

    // Impact on savings goals
    const savingsGoals = commitments.filter((c) => c.goal_type === "savings");
    const goalImpacts = savingsGoals.map((c) => {
      const target = Number(c.target_amount) || Number(c.original_amount);
      const saved = Number(c.current_saved);
      const rate = Number(c.monthly_payment);
      const remaining = target - saved;
      if (remaining <= 0 || rate <= 0) return null;
      const baseMonths = Math.ceil(remaining / rate);
      const boostedMonths = Math.ceil(remaining / (rate + extraSaving / Math.max(savingsGoals.length, 1)));
      return { name: c.name, baseMonths, boostedMonths, saved: baseMonths - boostedMonths };
    }).filter((x): x is NonNullable<typeof x> => x !== null);

    return { avgSaving, baseFuture, extraFuture, diff: extraFuture - baseFuture, goalImpacts };
  }, [movingAverages, currentTotalAssets, whatIfMonths, extraSaving, commitments]);

  // Health score color
  const scoreColor = healthScore
    ? healthScore.pct >= 75 ? "text-emerald-400" : healthScore.pct >= 50 ? "text-amber-400" : "text-red-400"
    : "";
  const scoreBg = healthScore
    ? healthScore.pct >= 75 ? "bg-emerald-500" : healthScore.pct >= 50 ? "bg-amber-500" : "bg-red-500"
    : "";

  const MONTH_LABELS = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];

  return (
    <div className="space-y-6">
      {/* Health Score */}
      {healthScore && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-4 w-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-[var(--sb-text)]">Salute finanziaria</h3>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="var(--sb-border)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={healthScore.pct >= 75 ? "#22c55e" : healthScore.pct >= 50 ? "#f59e0b" : "#ef4444"} strokeWidth="3" strokeDasharray={`${healthScore.pct * 0.974} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={cn("text-lg font-bold", scoreColor)}>{Math.round(healthScore.pct)}</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {healthScore.details.map((d) => (
                <div key={d.label}>
                  <div className="flex justify-between text-xs mb-0.5">
                    <span className="text-[var(--sb-muted)]">{d.label}</span>
                    <span className="text-[var(--sb-text)] tabular-nums">{d.points}/{d.max} · {d.tip}</span>
                  </div>
                  <div className="h-1 rounded-full bg-[var(--sb-border)] overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", scoreBg)} style={{ width: `${(d.points / d.max) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 50/30/20 Rule */}
      {rule503020 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3">Regola 50/30/20</h3>
          <div className="h-4 rounded-full bg-[var(--sb-border)] overflow-hidden flex">
            <div className="h-full bg-blue-500 transition-all" style={{ width: `${Math.max(rule503020.needsPct, 0)}%` }} />
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${Math.max(rule503020.wantsPct, 0)}%` }} />
            <div className="h-full bg-emerald-500 transition-all" style={{ width: `${Math.max(rule503020.savingsPct, 0)}%` }} />
          </div>
          <div className="grid grid-cols-3 gap-3 mt-3">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] text-[var(--sb-muted)] uppercase">Necessità</span>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", rule503020.needsPct <= 50 ? "text-emerald-400" : "text-red-400")}>
                {rule503020.needsPct.toFixed(0)}%
              </p>
              <p className="text-[10px] text-[var(--sb-muted)]">target 50%</p>
              <p className="text-[10px] text-[var(--sb-muted)] tabular-nums">{fmt(rule503020.needs)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" />
                <span className="text-[10px] text-[var(--sb-muted)] uppercase">Desideri</span>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", rule503020.wantsPct <= 30 ? "text-emerald-400" : "text-amber-400")}>
                {rule503020.wantsPct.toFixed(0)}%
              </p>
              <p className="text-[10px] text-[var(--sb-muted)]">target 30%</p>
              <p className="text-[10px] text-[var(--sb-muted)] tabular-nums">{fmt(rule503020.wants)}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] text-[var(--sb-muted)] uppercase">Risparmio</span>
              </div>
              <p className={cn("text-sm font-semibold tabular-nums", rule503020.savingsPct >= 20 ? "text-emerald-400" : "text-red-400")}>
                {rule503020.savingsPct.toFixed(0)}%
              </p>
              <p className="text-[10px] text-[var(--sb-muted)]">target 20%</p>
              <p className="text-[10px] text-[var(--sb-muted)] tabular-nums">{fmt(rule503020.savings)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Year-over-Year comparison */}
      {hasYoYData && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4 overflow-x-auto">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3">
            Confronto anno su anno ({new Date().getFullYear() - 1} vs {new Date().getFullYear()})
          </h3>
          <table className="w-full text-[10px]">
            <thead>
              <tr className="text-[var(--sb-muted)]">
                <th className="text-left py-1.5 pr-2 font-medium">Mese</th>
                <th className="text-right py-1.5 px-1 font-medium">{new Date().getFullYear() - 1}</th>
                <th className="text-right py-1.5 px-1 font-medium">{new Date().getFullYear()}</th>
                <th className="text-right py-1.5 pl-1 font-medium">Diff</th>
              </tr>
            </thead>
            <tbody>
              {yoyData.map((m, i) => {
                if (m.thisSaved === null && m.prevSaved === null) return null;
                const diff = m.thisSaved !== null && m.prevSaved !== null ? m.thisSaved - m.prevSaved : null;
                return (
                  <tr key={i} className="border-t border-[var(--sb-border)]">
                    <td className="py-1.5 pr-2 text-[var(--sb-text)] uppercase font-medium">{m.monthLabel}</td>
                    <td className="py-1.5 px-1 text-right tabular-nums text-[var(--sb-muted)]">
                      {m.prevSaved !== null ? fmt(m.prevSaved) : "—"}
                    </td>
                    <td className="py-1.5 px-1 text-right tabular-nums text-[var(--sb-text)]">
                      {m.thisSaved !== null ? fmt(m.thisSaved) : "—"}
                    </td>
                    <td className={cn("py-1.5 pl-1 text-right tabular-nums font-medium", diff !== null && diff >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {diff !== null ? (diff >= 0 ? "+" : "") + fmt(diff) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Seasonal trends heatmap */}
      {seasonalGrid && seasonalGrid.length > 0 && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-3">Trend stagionali (risparmio mensile)</h3>
          <div className="space-y-1.5">
            {/* Month header */}
            <div className="flex gap-1">
              <span className="w-10 shrink-0" />
              {MONTH_LABELS.map((l) => (
                <span key={l} className="flex-1 text-center text-[9px] text-[var(--sb-muted)]">{l}</span>
              ))}
            </div>
            {seasonalGrid.map((row) => (
              <div key={row.year} className="flex gap-1 items-center">
                <span className="w-10 shrink-0 text-[10px] text-[var(--sb-muted)] tabular-nums">{row.year}</span>
                {row.months.map((cell) => {
                  let colorClass = "bg-[var(--sb-card)]";
                  if (cell.saved !== null) {
                    if (cell.saved <= -500) colorClass = HEATMAP_COLORS[1];
                    else if (cell.saved < 0) colorClass = HEATMAP_COLORS[2];
                    else if (cell.saved < 200) colorClass = HEATMAP_COLORS[3];
                    else if (cell.saved < 500) colorClass = HEATMAP_COLORS[4];
                    else colorClass = HEATMAP_COLORS[5];
                  }
                  return (
                    <div
                      key={cell.month}
                      title={cell.saved !== null ? `${MONTH_LABELS[cell.month]} ${row.year}: ${fmt(cell.saved)}` : "Nessun dato"}
                      className={cn("flex-1 h-6 rounded-sm transition-colors", colorClass)}
                    />
                  );
                })}
              </div>
            ))}
            {/* Legend */}
            <div className="flex items-center justify-center gap-3 mt-2 pt-2 border-t border-[var(--sb-border)]">
              <span className="text-[9px] text-[var(--sb-muted)]">Perdita</span>
              {HEATMAP_COLORS.slice(1).map((c, i) => (
                <span key={i} className={cn("w-4 h-3 rounded-sm", c)} />
              ))}
              <span className="text-[9px] text-[var(--sb-muted)]">Risparmio alto</span>
            </div>
          </div>
        </div>
      )}

      {/* What-if simulator */}
      {whatIfData && (
        <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
          <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-4 flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5" /> Simulatore &quot;What if&quot;
          </h3>

          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--sb-muted)]">Risparmio extra mensile</span>
                <span className="text-emerald-400 font-medium tabular-nums">+{fmt(extraSaving)}</span>
              </div>
              <input
                type="range" min="0" max="2000" step="50" value={extraSaving}
                onChange={(e) => setExtraSaving(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-[var(--sb-border)] accent-indigo-500 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[var(--sb-muted)]">Orizzonte temporale</span>
                <span className="text-indigo-400 font-medium">{whatIfMonths} mesi</span>
              </div>
              <input
                type="range" min="6" max="60" step="6" value={whatIfMonths}
                onChange={(e) => setWhatIfMonths(Number(e.target.value))}
                className="w-full h-1.5 rounded-full appearance-none bg-[var(--sb-border)] accent-indigo-500 cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-[var(--sb-card)] p-3 text-center">
                <p className="text-[10px] text-[var(--sb-muted)] mb-1">Senza extra</p>
                <p className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">{fmt(whatIfData.baseFuture)}</p>
              </div>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-3 text-center">
                <p className="text-[10px] text-[var(--sb-muted)] mb-1">Con extra</p>
                <p className="text-sm font-semibold tabular-nums text-emerald-400">{fmt(whatIfData.extraFuture)}</p>
              </div>
            </div>

            {extraSaving > 0 && (
              <p className="text-xs text-center text-emerald-400">
                +{fmt(whatIfData.diff)} in {whatIfMonths} mesi risparmiando {fmt(extraSaving)}/mese in più
              </p>
            )}

            {/* Impact on savings goals */}
            {whatIfData.goalImpacts.length > 0 && extraSaving > 0 && (
              <div className="border-t border-[var(--sb-border)] pt-3 mt-2">
                <p className="text-[10px] text-[var(--sb-muted)] uppercase mb-2">Impatto sugli obiettivi</p>
                <div className="space-y-1.5">
                  {whatIfData.goalImpacts.map((g) => (
                    <div key={g.name} className="flex items-center justify-between text-xs">
                      <span className="text-[var(--sb-text)]">{g.name}</span>
                      <span className="text-emerald-400 tabular-nums">
                        {g.saved > 0 ? `-${g.saved} mesi` : "invariato"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FIRE Calculator */}
      {(() => {
        const avgInc = movingAverages.income6m ?? movingAverages.income3m;
        const avgExp = movingAverages.expenses6m ?? movingAverages.expenses3m;
        if (!avgInc || avgInc <= 0 || !avgExp || avgExp <= 0) return null;

        const annualExpenses = avgExp * 12;
        const fireTarget = annualExpenses * 25; // 4% rule
        const monthlySaving = avgInc - avgExp;
        if (monthlySaving <= 0) return null;

        const annualSaving = monthlySaving * 12;
        // Years to FIRE assuming 5% real return
        const realReturn = 0.05;
        const monthlyReturn = realReturn / 12;
        // FV of savings = current + PMT * ((1+r)^n - 1) / r = fireTarget
        // Solve for n (months)
        const monthlyPMT = monthlySaving;
        const target = fireTarget - currentTotalAssets;
        let fireMonths: number;
        if (target <= 0) {
          fireMonths = 0;
        } else if (monthlyReturn > 0) {
          // n = ln((target * r / PMT) + 1) / ln(1+r)
          fireMonths = Math.log((target * monthlyReturn / monthlyPMT) + 1) / Math.log(1 + monthlyReturn);
        } else {
          fireMonths = target / monthlyPMT;
        }
        const fireYears = Math.max(0, Math.ceil(fireMonths / 12));
        const fireDate = new Date();
        fireDate.setMonth(fireDate.getMonth() + Math.ceil(fireMonths));
        const progressPct = fireTarget > 0 ? Math.min((currentTotalAssets / fireTarget) * 100, 100) : 0;

        return (
          <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
            <h3 className="text-xs font-medium text-[var(--sb-muted)] mb-4 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-amber-400" /> Indipendenza finanziaria (FIRE)
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-[var(--sb-card)] p-3 text-center">
                <p className="text-[10px] text-[var(--sb-muted)] mb-1">Obiettivo FIRE</p>
                <p className="text-sm font-semibold tabular-nums text-[var(--sb-text)]">{fmt(fireTarget)}</p>
                <p className="text-[10px] text-[var(--sb-muted)]">25× spese annuali</p>
              </div>
              <div className="rounded-lg bg-[var(--sb-card)] p-3 text-center">
                <p className="text-[10px] text-[var(--sb-muted)] mb-1">Anni stimati</p>
                <p className={cn("text-sm font-semibold tabular-nums", fireYears <= 15 ? "text-emerald-400" : fireYears <= 25 ? "text-amber-400" : "text-red-400")}>
                  {fireYears === 0 ? "Raggiunto!" : `~${fireYears} anni`}
                </p>
                <p className="text-[10px] text-[var(--sb-muted)]">
                  {fireYears > 0 ? format(fireDate, "MMMM yyyy", { locale: it }) : ""}
                </p>
              </div>
            </div>
            <div className="mb-2">
              <div className="flex justify-between text-[10px] text-[var(--sb-muted)] mb-1">
                <span>Progresso</span>
                <span className="tabular-nums">{progressPct.toFixed(1)}%</span>
              </div>
              <div className="h-2 rounded-full bg-[var(--sb-border)] overflow-hidden">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" style={{ width: `${progressPct}%` }} />
              </div>
              <div className="flex justify-between text-[10px] text-[var(--sb-muted)] mt-1">
                <span>Attuale: {fmt(currentTotalAssets)}</span>
                <span>Target: {fmt(fireTarget)}</span>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 pt-3 border-t border-[var(--sb-border)]">
              <div className="text-center">
                <p className="text-[10px] text-[var(--sb-muted)]">Spese annuali</p>
                <p className="text-xs font-medium tabular-nums text-[var(--sb-text)]">{fmt(annualExpenses)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-[var(--sb-muted)]">Risparmio annuale</p>
                <p className="text-xs font-medium tabular-nums text-emerald-400">{fmt(annualSaving)}</p>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-[var(--sb-muted)]">Tasso risparmio</p>
                <p className="text-xs font-medium tabular-nums text-[var(--sb-text)]">{((monthlySaving / avgInc) * 100).toFixed(0)}%</p>
              </div>
            </div>
            <p className="text-[10px] text-[var(--sb-muted)] italic mt-3">Stima basata sulla regola del 4% e un rendimento reale del 5% annuo</p>
          </div>
        );
      })()}
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   Forms / Modals
   ════════════════════════════════════════════════════════════ */

const inputCls = "w-full rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] px-3 py-2 text-sm text-[var(--sb-text)] focus:border-indigo-500 focus:outline-none transition-colors";
const labelCls = "block text-xs text-[var(--sb-muted)] mb-1";
const btnCls = "w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500 transition-colors cursor-pointer disabled:opacity-50";

function IncomeForm({ month, onSave, onClose }: { month: string; onSave: (data: { month: string; budget_month: string; label: string; amount: number }) => void; onClose: () => void }) {
  const [label, setLabel] = useState("Stipendio");
  const [amount, setAmount] = useState("");
  const [budgetMonth, setBudgetMonth] = useState(nextMonth(month));

  const presets = ["Stipendio", "Freelance", "Bonus", "Investimenti", "Rimborso", "Altro"];

  return (
    <ModalShell title={`Entrata — ${getMonthLabel(month)}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="rounded-lg border border-cyan-500/20 bg-cyan-500/5 p-3">
          <p className="text-xs font-medium text-cyan-300">Mese di incasso vs mese finanziato</p>
          <p className="mt-1 text-[11px] leading-relaxed text-[var(--sb-muted)]">
            Se ricevi lo stipendio a fine {getMonthLabel(month)}, lascialo incassato qui e fallo finanziare {getMonthLabel(nextMonth(month))}.
          </p>
        </div>
        <div>
          <label className={labelCls}>Tipo</label>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {presets.map((p) => (
              <button
                key={p}
                onClick={() => setLabel(p)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                  label === p ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-[var(--sb-border)]"
                )}
              >{p}</button>
            ))}
          </div>
          <input type="text" value={label} onChange={(e) => setLabel(e.target.value)} className={inputCls} placeholder="Es: Stipendio" />
        </div>
        <div>
          <label className={labelCls}>Importo</label>
          <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="0.00" autoFocus />
        </div>
        <div>
          <label className={labelCls}>Finanzia il mese</label>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <button
              type="button"
              onClick={() => setBudgetMonth(month)}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs transition-colors",
                budgetMonth === month ? "border-emerald-500/30 bg-emerald-500/15 text-emerald-300" : "border-[var(--sb-border)] bg-[var(--sb-card)] text-[var(--sb-muted)]",
              )}
            >
              Questo mese
            </button>
            <button
              type="button"
              onClick={() => setBudgetMonth(nextMonth(month))}
              className={cn(
                "rounded-lg border px-3 py-2 text-xs transition-colors",
                budgetMonth === nextMonth(month) ? "border-cyan-500/30 bg-cyan-500/15 text-cyan-300" : "border-[var(--sb-border)] bg-[var(--sb-card)] text-[var(--sb-muted)]",
              )}
            >
              Mese successivo
            </button>
          </div>
          <input type="month" value={budgetMonth} onChange={(e) => setBudgetMonth(e.target.value)} className={inputCls} />
        </div>
        <button onClick={() => onSave({ month, budget_month: budgetMonth || month, label, amount: Number(amount) })} disabled={!amount || Number(amount) <= 0 || !budgetMonth} className={btnCls}>
          Aggiungi entrata
        </button>
      </div>
    </ModalShell>
  );
}

function SnapshotForm({ accounts, month, existingBalances, onSave, onClose }: { accounts: Account[]; month: string; existingBalances: Record<string, number>; onSave: (data: { account_id: string; balance: number; snapshot_month: string }) => void; onClose: () => void }) {
  const firstId = accounts[0]?.id || "";
  const [accountId, setAccountId] = useState(firstId);
  const [balance, setBalance] = useState(() => {
    const existing = existingBalances[firstId];
    return existing !== undefined ? String(existing) : "";
  });

  function handleAccountChange(id: string) {
    setAccountId(id);
    const existing = existingBalances[id];
    setBalance(existing !== undefined ? String(existing) : "");
  }

  return (
    <ModalShell title={`Saldo — ${getMonthLabel(month)}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Conto</label>
          <select value={accountId} onChange={(e) => handleAccountChange(e.target.value)} className={inputCls}>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Saldo a fine mese</label>
          <input type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className={inputCls} placeholder="0.00" autoFocus />
        </div>
        <button onClick={() => onSave({ account_id: accountId, balance: Number(balance), snapshot_month: month })} disabled={!accountId || !balance} className={btnCls}>
          Salva saldo
        </button>
      </div>
    </ModalShell>
  );
}

const EXPENSE_CATEGORIES = ["casa", "trasporti", "cibo", "salute", "abbigliamento", "intrattenimento", "istruzione", "tecnologia", "abbonamenti", "assicurazioni", "tasse", "viaggi", "altro"];

function RecurringForm({ initial, onSave, onClose }: { initial: Recurring | null; onSave: (data: RecurringInput) => void; onClose: () => void }) {
  const [name, setName] = useState(initial?.name || "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [frequency, setFrequency] = useState<"monthly" | "quarterly" | "annual">(initial?.frequency || "monthly");
  const [category, setCategory] = useState(initial?.category || "abbonamenti");
  const [nextDue, setNextDue] = useState(initial?.next_due_date || format(new Date(), "yyyy-MM-dd"));

  return (
    <ModalShell title={initial ? "Modifica spesa ricorrente" : "Nuova spesa ricorrente"} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Es: Netflix, Palestra..." />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Importo</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Frequenza</label>
            <select value={frequency} onChange={(e) => setFrequency(e.target.value as Recurring["frequency"])} className={inputCls}>
              <option value="monthly">Mensile</option>
              <option value="quarterly">Trimestrale</option>
              <option value="annual">Annuale</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Categoria</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className={inputCls}>
              {EXPENSE_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Prossima scadenza</label>
            <input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button onClick={() => onSave({ name, amount: Number(amount), frequency, category, next_due_date: nextDue })} disabled={!name || !amount} className={btnCls}>
          {initial ? "Salva" : "Aggiungi"}
        </button>
      </div>
    </ModalShell>
  );
}

function CommitmentForm({ initial, onSave, onClose }: { initial: Commitment | null; onSave: (data: CommitmentInput) => void; onClose: () => void }) {
  const [goalType, setGoalType] = useState<"debt" | "savings">(initial?.goal_type || "debt");
  const [name, setName] = useState(initial?.name || "");
  const [type, setType] = useState<"mortgage" | "loan" | "lease" | "other">(initial?.type || "loan");
  const [originalAmount, setOriginalAmount] = useState(initial ? String(initial.original_amount) : "");
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthly_payment) : "");
  const [totalInst, setTotalInst] = useState(initial?.total_installments ? String(initial.total_installments) : "");
  const [paidInst, setPaidInst] = useState(initial ? String(initial.paid_installments) : "0");
  const [dueDay, setDueDay] = useState(initial?.due_day ? String(initial.due_day) : "");
  const [targetAmount, setTargetAmount] = useState(initial?.target_amount ? String(initial.target_amount) : "");
  const [currentSaved, setCurrentSaved] = useState(initial ? String(initial.current_saved) : "0");

  // Derived
  const paid = Number(paidInst) || 0;
  const total = Number(totalInst) || 0;
  const remaining = Math.max(0, total - paid);
  const rate = Number(monthlyPayment) || 0;
  const remainingAmount = remaining * rate;
  const pct = total > 0 ? (paid / total) * 100 : 0;
  const dueDayNum = Number(dueDay) || null;
  const initialAutoPaidMonth = (() => {
    if (initial?.last_auto_paid_month) return initial.last_auto_paid_month;
    if (goalType !== "debt" || !dueDayNum) return null;
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    return now.getDate() >= Math.min(dueDayNum, lastDay) ? format(now, "yyyy-MM") : null;
  })();

  return (
    <ModalShell title={initial ? "Modifica impegno" : "Nuovo impegno"} onClose={onClose}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-[var(--sb-border)] overflow-hidden">
          <button onClick={() => setGoalType("debt")} className={cn("flex-1 py-2 text-xs font-medium transition-colors cursor-pointer", goalType === "debt" ? "bg-red-500/15 text-red-400" : "text-[var(--sb-muted)]")}>
            Debito / Rata
          </button>
          <button onClick={() => setGoalType("savings")} className={cn("flex-1 py-2 text-xs font-medium transition-colors cursor-pointer", goalType === "savings" ? "bg-emerald-500/15 text-emerald-400" : "text-[var(--sb-muted)]")}>
            Obiettivo risparmio
          </button>
        </div>
        <div>
          <label className={labelCls}>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder={goalType === "debt" ? "Es: Prestito auto" : "Es: Fondo emergenza"} />
        </div>
        {goalType === "debt" ? (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Tipo</label>
                <select value={type} onChange={(e) => setType(e.target.value as Commitment["type"])} className={inputCls}>
                  <option value="mortgage">Mutuo</option>
                  <option value="loan">Prestito</option>
                  <option value="lease">Leasing</option>
                  <option value="other">Altro</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Importo finanziato</label>
                <input type="number" step="0.01" value={originalAmount} onChange={(e) => setOriginalAmount(e.target.value)} className={inputCls} placeholder="10000" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Importo rata</label>
                <input type="number" step="0.01" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} className={inputCls} placeholder="267.04" />
              </div>
              <div>
                <label className={labelCls}>Giorno scadenza rata</label>
                <input type="number" min="1" max="31" value={dueDay} onChange={(e) => setDueDay(e.target.value)} className={inputCls} placeholder="15" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Rate totali</label>
                <input type="number" step="1" value={totalInst} onChange={(e) => setTotalInst(e.target.value)} className={inputCls} placeholder="48" />
              </div>
              <div>
                <label className={labelCls}>Rate già pagate</label>
                <input type="number" step="1" value={paidInst} onChange={(e) => setPaidInst(e.target.value)} className={inputCls} placeholder="0" />
              </div>
            </div>

            {/* Riepilogo calcolato */}
            {total > 0 && rate > 0 && (
              <div className="rounded-lg bg-[var(--sb-card)] border border-[var(--sb-border)] p-3 space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--sb-muted)]">Già pagato</span>
                  <span className="text-emerald-400 font-medium tabular-nums">{fmt(paid * rate)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--sb-muted)]">Residuo</span>
                  <span className="text-[var(--sb-text)] font-medium tabular-nums">{fmt(remainingAmount)}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[var(--sb-muted)]">Rate rimanenti</span>
                  <span className="text-[var(--sb-text)] tabular-nums">{remaining}</span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--sb-border)] overflow-hidden mt-1">
                  <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-[10px] text-[var(--sb-muted)] text-right">{pct.toFixed(0)}% completato</p>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Obiettivo</label>
                <input type="number" step="0.01" value={targetAmount} onChange={(e) => setTargetAmount(e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Già risparmiato</label>
                <input type="number" step="0.01" value={currentSaved} onChange={(e) => setCurrentSaved(e.target.value)} className={inputCls} />
              </div>
            </div>
            <div>
              <label className={labelCls}>Risparmio mensile</label>
              <input type="number" step="0.01" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} className={inputCls} />
            </div>
          </>
        )}
        <button
          onClick={() => onSave({
            name, type: goalType === "savings" ? "other" : type,
            original_amount: goalType === "savings" ? Number(targetAmount) || 0 : Number(originalAmount) || 0,
            remaining_amount: goalType === "savings" ? 0 : remainingAmount,
            monthly_payment: Number(monthlyPayment) || 0,
            interest_rate: null,
            end_date: null,
            goal_type: goalType,
            target_amount: goalType === "savings" ? Number(targetAmount) || 0 : null,
            current_saved: goalType === "savings" ? Number(currentSaved) || 0 : 0,
            total_installments: goalType === "debt" ? (Number(totalInst) || null) : null,
            paid_installments: goalType === "debt" ? (Number(paidInst) || 0) : 0,
            due_day: goalType === "debt" ? dueDayNum : null,
            last_auto_paid_month: initialAutoPaidMonth,
          })}
          disabled={!name}
          className={btnCls}
        >
          {initial ? "Salva" : "Aggiungi"}
        </button>
      </div>
    </ModalShell>
  );
}

function AccountForm({ onSave, onClose }: { onSave: (data: AccountInput) => void; onClose: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"checking" | "savings" | "investment" | "other">("checking");

  const assetPresets = ["Casa", "Auto", "Moto", "Garage", "Terreno"];

  return (
    <ModalShell title="Nuovo conto o asset" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Tipo</label>
          <select value={type} onChange={(e) => { setType(e.target.value as Account["type"]); setName(""); }} className={inputCls}>
            <option value="checking">Conto corrente</option>
            <option value="savings">Risparmio</option>
            <option value="investment">Investimento</option>
            <option value="other">Immobile / Asset fisico</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Nome</label>
          {type === "other" && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {assetPresets.map((p) => (
                <button
                  key={p}
                  onClick={() => setName(p)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs transition-colors cursor-pointer",
                    name === p ? "bg-amber-500/15 text-amber-400 border border-amber-500/30" : "bg-[var(--sb-card)] text-[var(--sb-muted)] border border-[var(--sb-border)]"
                  )}
                >{p}</button>
              ))}
            </div>
          )}
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls}
            placeholder={type === "other" ? "Es: Casa di proprietà, Auto..." : "Es: Conto principale"}
          />
        </div>
        {type === "other" && (
          <p className="text-[10px] text-[var(--sb-muted)] bg-[var(--sb-card)] rounded-lg p-2.5">
            Gli asset fisici vengono inclusi nel patrimonio netto. Inserisci il valore stimato come saldo e aggiornalo quando necessario.
          </p>
        )}
        <button onClick={() => onSave({ name, type })} disabled={!name} className={btnCls}>Aggiungi</button>
      </div>
    </ModalShell>
  );
}

function InvestmentInstrumentForm({ onSave, onClose }: { onSave: (data: InvestmentInstrumentInput) => void; onClose: () => void }) {
  const [symbol, setSymbol] = useState("");
  const [exchange, setExchange] = useState("");
  const [isin, setIsin] = useState("");
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("EUR");

  const cleanSymbol = symbol.trim().toUpperCase();
  const cleanExchange = exchange.trim().toUpperCase();
  const providerSymbol = cleanExchange ? `${cleanSymbol}:${cleanExchange}` : cleanSymbol;

  return (
    <ModalShell title="Nuovo ETF" onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Ticker</label>
            <input type="text" value={symbol} onChange={(e) => setSymbol(e.target.value)} className={inputCls} placeholder="VWCE" autoFocus />
          </div>
          <div>
            <label className={labelCls}>Exchange</label>
            <input type="text" value={exchange} onChange={(e) => setExchange(e.target.value)} className={inputCls} placeholder="XETRA" />
          </div>
        </div>
        <div>
          <label className={labelCls}>Nome</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Vanguard FTSE All-World" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>ISIN</label>
            <input type="text" value={isin} onChange={(e) => setIsin(e.target.value.toUpperCase())} className={inputCls} placeholder="IE00BK5BQT80" />
          </div>
          <div>
            <label className={labelCls}>Valuta</label>
            <select value={currency} onChange={(e) => setCurrency(e.target.value)} className={inputCls}>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
              <option value="GBP">GBP</option>
              <option value="CHF">CHF</option>
            </select>
          </div>
        </div>
        <p className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-2.5 text-[10px] text-[var(--sb-muted)]">
          Twelve Data usera ticker ed exchange per aggiornare il prezzo. Se il prezzo non arriva, prova il ticker esatto usato dal mercato.
        </p>
        <button
          onClick={() => onSave({
            symbol: cleanSymbol,
            exchange: cleanExchange || null,
            isin: isin.trim().toUpperCase() || null,
            name: name.trim() || providerSymbol,
            currency,
            provider: "twelvedata",
            provider_symbol: providerSymbol,
          })}
          disabled={!cleanSymbol}
          className={btnCls}
        >
          Aggiungi ETF
        </button>
      </div>
    </ModalShell>
  );
}

function InvestmentTransactionForm({
  accounts, instruments, onSave, onClose,
}: {
  accounts: Account[];
  instruments: InvestmentInstrument[];
  onSave: (data: InvestmentTransactionInput) => void;
  onClose: () => void;
}) {
  const investmentAccounts = accounts.filter((account) => account.type === "investment");
  const [accountId, setAccountId] = useState(investmentAccounts[0]?.id || "");
  const [instrumentId, setInstrumentId] = useState(instruments[0]?.id || "");
  const [type, setType] = useState<"buy" | "sell">("buy");
  const [tradeDate, setTradeDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [shares, setShares] = useState("");
  const [price, setPrice] = useState(() => instruments[0]?.last_price ? String(instruments[0].last_price) : "");
  const [fees, setFees] = useState("0");
  const instrument = instruments.find((item) => item.id === instrumentId);

  function handleInstrumentChange(id: string) {
    setInstrumentId(id);
    const selected = instruments.find((item) => item.id === id);
    setPrice(selected?.last_price ? String(selected.last_price) : "");
  }

  return (
    <ModalShell title="Movimento ETF" onClose={onClose}>
      <div className="space-y-3">
        <div className="flex rounded-lg border border-[var(--sb-border)] overflow-hidden">
          <button onClick={() => setType("buy")} className={cn("flex-1 py-2 text-xs font-medium transition-colors", type === "buy" ? "bg-emerald-500/15 text-emerald-400" : "text-[var(--sb-muted)]")}>Acquisto</button>
          <button onClick={() => setType("sell")} className={cn("flex-1 py-2 text-xs font-medium transition-colors", type === "sell" ? "bg-red-500/15 text-red-400" : "text-[var(--sb-muted)]")}>Vendita</button>
        </div>
        <div>
          <label className={labelCls}>Conto investimento</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            {investmentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>ETF</label>
          <select value={instrumentId} onChange={(e) => handleInstrumentChange(e.target.value)} className={inputCls}>
            {instruments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Data</label>
            <input type="date" value={tradeDate} onChange={(e) => setTradeDate(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Quote</label>
            <input type="number" step="0.000001" value={shares} onChange={(e) => setShares(e.target.value)} className={inputCls} placeholder="3.25" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Prezzo unitario</label>
            <input type="number" step="0.0001" value={price} onChange={(e) => setPrice(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Commissioni</label>
            <input type="number" step="0.01" value={fees} onChange={(e) => setFees(e.target.value)} className={inputCls} />
          </div>
        </div>
        <button
          onClick={() => onSave({
            account_id: accountId,
            instrument_id: instrumentId,
            recurring_plan_id: null,
            type,
            trade_date: tradeDate,
            shares: Number(shares),
            price: Number(price),
            fees: Number(fees) || 0,
            currency: instrument?.currency || "EUR",
            source: "manual",
          })}
          disabled={!accountId || !instrumentId || !shares || !price}
          className={btnCls}
        >
          Salva movimento
        </button>
      </div>
    </ModalShell>
  );
}

function InvestmentPlanForm({
  accounts, instruments, onSave, onClose,
}: {
  accounts: Account[];
  instruments: InvestmentInstrument[];
  onSave: (data: InvestmentPlanInput) => void;
  onClose: () => void;
}) {
  const investmentAccounts = accounts.filter((account) => account.type === "investment");
  const [accountId, setAccountId] = useState(investmentAccounts[0]?.id || "");
  const [instrumentId, setInstrumentId] = useState(instruments[0]?.id || "");
  const [name, setName] = useState("");
  const [day, setDay] = useState("1");
  const [amount, setAmount] = useState("");
  const [startMonth, setStartMonth] = useState(format(new Date(), "yyyy-MM"));
  const instrument = instruments.find((item) => item.id === instrumentId);

  return (
    <ModalShell title="Nuovo PAC ETF" onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className={labelCls}>Nome PAC</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="PAC VWCE" autoFocus />
        </div>
        <div>
          <label className={labelCls}>Conto investimento</label>
          <select value={accountId} onChange={(e) => setAccountId(e.target.value)} className={inputCls}>
            {investmentAccounts.map((account) => <option key={account.id} value={account.id}>{account.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>ETF</label>
          <select value={instrumentId} onChange={(e) => setInstrumentId(e.target.value)} className={inputCls}>
            {instruments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className={labelCls}>Importo</label>
            <input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={inputCls} placeholder="300" />
          </div>
          <div>
            <label className={labelCls}>Giorno</label>
            <input type="number" min="1" max="31" value={day} onChange={(e) => setDay(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Da mese</label>
            <input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} className={inputCls} />
          </div>
        </div>
        <p className="rounded-lg border border-[var(--sb-border)] bg-[var(--sb-card)] p-2.5 text-[10px] text-[var(--sb-muted)]">
          Nel giorno scelto il PAC aggiunge quote pari a importo diviso ultimo prezzo disponibile. Se il giorno non esiste nel mese, usa l&apos;ultimo giorno del mese.
        </p>
        <button
          onClick={() => onSave({
            account_id: accountId,
            instrument_id: instrumentId,
            name: name.trim() || `PAC ${instrument?.symbol || "ETF"}`,
            day_of_month: Math.min(31, Math.max(1, Number(day) || 1)),
            amount: Number(amount),
            currency: instrument?.currency || "EUR",
            is_active: true,
            start_month: startMonth,
            last_executed_month: null,
          })}
          disabled={!accountId || !instrumentId || !amount}
          className={btnCls}
        >
          Crea PAC
        </button>
      </div>
    </ModalShell>
  );
}

function DeleteDialog({ onConfirm, onCancel }: { onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onCancel}>
      <div className="w-full max-w-xs rounded-xl border border-[var(--sb-border)] bg-[var(--sb-bg)] p-5 text-center" onClick={(e) => e.stopPropagation()}>
        <Trash2 className="h-8 w-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm text-[var(--sb-text)] mb-4">Sei sicuro di voler eliminare?</p>
        <div className="flex gap-2">
          <button onClick={onCancel} className="flex-1 rounded-lg border border-[var(--sb-border)] py-2 text-xs text-[var(--sb-muted)] hover:bg-[var(--sb-hover)] transition-colors cursor-pointer">Annulla</button>
          <button onClick={onConfirm} className="flex-1 rounded-lg bg-red-600 py-2 text-xs text-white hover:bg-red-500 transition-colors cursor-pointer">Elimina</button>
        </div>
      </div>
    </div>
  );
}

/* ── Shared ────────────────────────────────────────────────── */

function MetricCard({ label, value, tone = "neutral" }: { label: string; value: string; tone?: "positive" | "negative" | "neutral" }) {
  return (
    <div className="rounded-xl border border-[var(--sb-border)] bg-[var(--sb-surface)] p-4">
      <p className="text-[10px] uppercase text-[var(--sb-muted)]">{label}</p>
      <p className={cn(
        "mt-1 text-base font-semibold tabular-nums",
        tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-[var(--sb-text)]",
      )}>
        {value}
      </p>
    </div>
  );
}

function KpiCard({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: string; tone: "positive" | "negative" | "neutral" }) {
  return (
    <div className={cn(
      "sb-depth-card p-4",
      tone === "positive" ? "sb-module-finance" : tone === "negative" ? "sb-module-fitness" : "sb-module-system",
    )}>
      <div className={cn("mb-2", tone === "positive" ? "text-emerald-400" : tone === "negative" ? "text-red-400" : "text-[var(--sb-muted)]")}>
        {icon}
      </div>
      <p className="text-[10px] text-[var(--sb-muted)] mb-1 uppercase">{label}</p>
      <p className="text-base font-semibold tabular-nums text-[var(--sb-text)]">{value}</p>
    </div>
  );
}
