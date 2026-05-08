export interface WorkoutInterval {
  type?: string;
  time?: string;
  distance?: string;
  pace?: string;
}

export function todayStr() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function fmtPace(pace: string | null) {
  if (!pace) return "\u2014";
  return pace;
}

export function fmtDuration(mins: number | null) {
  if (!mins) return "\u2014";
  const minutes = Math.floor(mins);
  const seconds = Math.round((mins - minutes) * 60);
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${String(remainingMinutes).padStart(2, "0")}m`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Sottopeso", color: "text-blue-400" };
  if (bmi < 25) return { label: "Normopeso", color: "text-emerald-400" };
  if (bmi < 30) return { label: "Sovrappeso", color: "text-amber-400" };
  return { label: "Obeso", color: "text-red-400" };
}

export function getWorkoutIntervals(value: unknown): WorkoutInterval[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is WorkoutInterval => (
    item !== null && typeof item === "object"
  ));
}
