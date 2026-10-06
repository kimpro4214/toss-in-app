export const contentTargets: Record<string, number> = {
  architecture: 30, os: 30, network: 60, structures: 30, algorithms: 60, database: 60,
  java: 60, javascript: 60, cpp: 120, kotlin: 60, python: 60, typescript: 60, csharp: 60,
  graphics: 30, gof: 30, oop: 30, design: 30,
};
export const totalQuestions = Object.values(contentTargets).reduce((sum, count) => sum + count, 0);
