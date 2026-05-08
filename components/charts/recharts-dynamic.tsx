"use client";

/**
 * Lazy-loaded re-exports of recharts primitives.
 *
 * recharts weighs ~400KB gzipped. Importing it statically forces it into
 * every route that uses a chart, even if the user never scrolls to the
 * charts tab. These wrappers use `next/dynamic` with `ssr: false` so the
 * bundle only loads once a chart actually renders in the DOM.
 *
 * Usage — drop-in replacement:
 *   // before
 *   import { BarChart, Bar } from "recharts";
 *   // after
 *   import { BarChart, Bar } from "@/components/charts/recharts-dynamic";
 */

import dynamic from "next/dynamic";
import type { ComponentType } from "react";
import type * as Recharts from "recharts";

type ChartComponent = ComponentType<Record<string, unknown>>;

// Preserve a permissive prop surface for Recharts primitives loaded on demand.
const lazy = <K extends keyof typeof Recharts>(
  name: K,
): ChartComponent =>
  dynamic(
    () => import("recharts").then((m) => ({ default: m[name] as unknown as ChartComponent })),
    { ssr: false },
  );

export const BarChart = lazy("BarChart");
export const Bar = lazy("Bar");
export const LineChart = lazy("LineChart");
export const Line = lazy("Line");
export const PieChart = lazy("PieChart");
export const Pie = lazy("Pie");
export const Cell = lazy("Cell");
export const XAxis = lazy("XAxis");
export const YAxis = lazy("YAxis");
export const CartesianGrid = lazy("CartesianGrid");
export const Tooltip = lazy("Tooltip");
export const ResponsiveContainer = lazy("ResponsiveContainer");
export const Legend = lazy("Legend");
export const AreaChart = lazy("AreaChart");
export const Area = lazy("Area");
