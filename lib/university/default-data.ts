import type { Database } from "@/types/database";

export type UniversitySettingsInsert = Database["public"]["Tables"]["university_settings"]["Insert"];

export function getDefaultUniversitySettings(userId: string): UniversitySettingsInsert {
  return {
    user_id: userId,
    student_name: "",
    student_number: "",
    degree_course: "Percorso di studio",
    total_cfu: 180,
    bonus_points: 0,
    honors_value: 31,
  };
}
