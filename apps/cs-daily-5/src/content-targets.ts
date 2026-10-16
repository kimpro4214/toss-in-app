export const contentTargets: Record<string, number> = {
  architecture: 15, os: 15, network: 15, structures: 15, algorithms: 15, database: 15,
  java: 15, javascript: 15, cpp: 15, kotlin: 15, python: 15, typescript: 15, csharp: 15,
  graphics: 15, gof: 15, oop: 15, design: 15,
};
export const totalQuestions = Object.values(contentTargets).reduce((sum, count) => sum + count, 0);
