export type Grade = "A" | "B" | "C" | "D" | "E" | "F";

export function gradeForPercentage(percentage: number): Grade {
  if (percentage >= 75) return "A";
  if (percentage >= 60) return "B";
  if (percentage >= 50) return "C";
  if (percentage >= 35) return "D";
  if (percentage >= 30) return "E";
  return "F";
}