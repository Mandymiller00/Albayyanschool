export type SubjectTermScore = {
  studentId: string;
  subjectId: string;
  termId: string;
  marks: number | string | null;
  maxMarks: number | string;
  ca1: number | string | null;
  ca2: number | string | null;
  ca3: number | string | null;
  exam: number | string | null;
};

export type SubjectCumulativeAverage = {
  average: number;
  completedTerms: number;
};

function numeric(value: number | string | null) {
  if (value === null || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function completedTermTotals(results: SubjectTermScore[], studentId: string, subjectId?: string) {
  const completedScores = results.flatMap((result) => {
    if (result.studentId !== studentId || (subjectId && result.subjectId !== subjectId)) return [];

    const components = [result.ca1, result.ca2, result.ca3, result.exam].map(numeric);
    if (components.some((score) => score !== null)) {
      if (components.some((score) => score === null)) return [];
      return [components.reduce<number>((total, score) => total + (score ?? 0), 0)];
    }
    const marks = numeric(result.marks);
    if (marks === null) return [];
    return [marks];
  });

  return completedScores;
}

function averageOf(scores: number[]): SubjectCumulativeAverage | null {
  if (!scores.length) return null;
  return {
    average: scores.reduce((total, score) => total + score, 0) / scores.length,
    completedTerms: scores.length,
  };
}

export function calculateSubjectCumulativeAverage(
  results: SubjectTermScore[],
  studentId: string,
  subjectId: string,
): SubjectCumulativeAverage | null {
  return averageOf(completedTermTotals(results, studentId, subjectId));
}

export function calculateStudentCumulativeAverage(
  results: SubjectTermScore[],
  studentId: string,
): SubjectCumulativeAverage | null {
  return averageOf(completedTermTotals(results, studentId));
}