export const APP_BRAND = {
  name: "SelfOS",
  tagline: "Personal operating system self-hosted",
  description: "Un workspace modulare per note, task, finanze, fitness, education, obiettivi e automazioni.",
} as const;

export const MODULE_IDS = ["notes", "tasks", "goals", "finance", "fitness", "education", "automation"] as const;

export type AppModuleId = (typeof MODULE_IDS)[number];

export interface AppModule {
  id: AppModuleId;
  label: string;
  shortLabel: string;
  href: string;
  moduleClass: string;
  envKey: string;
  description: string;
}

export const APP_MODULES: AppModule[] = [
  {
    id: "notes",
    label: "Note",
    shortLabel: "Note",
    href: "/notes",
    moduleClass: "sb-module-notes",
    envKey: "notes",
    description: "Secondo cervello, notebook, backlink, reminder e condivisione note.",
  },
  {
    id: "tasks",
    label: "Task",
    shortLabel: "Task",
    href: "/tasks",
    moduleClass: "sb-module-tasks",
    envKey: "tasks",
    description: "Task, progetti, subtask, viste operative e scadenze.",
  },
  {
    id: "goals",
    label: "Obiettivi",
    shortLabel: "Goal",
    href: "/goals",
    moduleClass: "sb-module-system",
    envKey: "goals",
    description: "Obiettivi misurabili collegati ai progetti e al Command Center.",
  },
  {
    id: "finance",
    label: "Finanze",
    shortLabel: "Finanze",
    href: "/finance",
    moduleClass: "sb-module-finance",
    envKey: "finance",
    description: "Conti, budget, patrimonio, ricorrenti, impegni e investimenti.",
  },
  {
    id: "fitness",
    label: "Fitness",
    shortLabel: "Fitness",
    href: "/fitness",
    moduleClass: "sb-module-fitness",
    envKey: "fitness",
    description: "Allenamenti, metriche, training load, Strava e coach AI opzionale.",
  },
  {
    id: "education",
    label: "Education",
    shortLabel: "Education",
    href: "/university",
    moduleClass: "sb-module-university",
    envKey: "education",
    description: "Percorso di studio configurabile, crediti, esami e proiezioni.",
  },
  {
    id: "automation",
    label: "Automazioni",
    shortLabel: "Auto",
    href: "/automation",
    moduleClass: "sb-module-system",
    envKey: "automation",
    description: "Regole personali per briefing, task, obiettivi e segnali operativi.",
  },
];

const MODULE_ALIASES: Record<string, AppModuleId> = {
  university: "education",
  universita: "education",
  "università": "education",
  automated: "automation",
  automations: "automation",
  goal: "goals",
};

function normalizeModuleKey(value: string): AppModuleId | null {
  const key = value.trim().toLowerCase();
  if (!key) return null;
  const alias = MODULE_ALIASES[key];
  if (alias) return alias;
  return MODULE_IDS.includes(key as AppModuleId) ? (key as AppModuleId) : null;
}

function parseModuleList(value: string | undefined) {
  if (!value?.trim()) return null;
  const parsed = value
    .split(",")
    .map(normalizeModuleKey)
    .filter((id): id is AppModuleId => Boolean(id));

  return parsed.length > 0 ? new Set(parsed) : null;
}

const enabledOverride = parseModuleList(process.env.NEXT_PUBLIC_SELFOS_MODULES);
const disabledOverride = parseModuleList(process.env.NEXT_PUBLIC_SELFOS_DISABLED_MODULES);

export function isModuleEnabled(moduleId: AppModuleId) {
  if (enabledOverride) return enabledOverride.has(moduleId);
  if (disabledOverride) return !disabledOverride.has(moduleId);
  return true;
}

export function getEnabledModules() {
  return APP_MODULES.filter((module) => isModuleEnabled(module.id));
}

export function getModule(moduleId: AppModuleId) {
  return APP_MODULES.find((module) => module.id === moduleId);
}

export function isRouteModuleEnabled(href: string) {
  const appModule = APP_MODULES.find((item) => item.href === href);
  return appModule ? isModuleEnabled(appModule.id) : true;
}
