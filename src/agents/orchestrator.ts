import { runPatchrightAgent, type AgentTask, type AgentResult } from "./patchrightAgent";

export interface OrchestratorOptions {
  concurrency: number;
  maxRetries: number;
}

async function runWithRetry(
  task: AgentTask,
  maxRetries: number,
): Promise<AgentResult> {
  let lastResult: AgentResult | undefined;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (attempt > 0) {
      console.log(`  [agent ${task.agentIndex}] retry ${attempt}/${maxRetries}`);
    }
    lastResult = await runPatchrightAgent(task);
    if (lastResult.success) return lastResult;
  }
  return lastResult!;
}

export async function runOrchestrator(
  tasks: AgentTask[],
  options: OrchestratorOptions,
): Promise<AgentResult[]> {
  const { concurrency, maxRetries } = options;
  const results: AgentResult[] = new Array(tasks.length);
  let nextIndex = 0;
  let completed = 0;

  async function worker(): Promise<void> {
    while (nextIndex < tasks.length) {
      const taskIndex = nextIndex++;
      const task = tasks[taskIndex];
      console.log(`[${completed + 1}/${tasks.length}] agent ${task.agentIndex} starting...`);
      const result = await runWithRetry(task, maxRetries);
      results[taskIndex] = result;
      completed++;
      if (result.success) {
        console.log(
          `[${completed}/${tasks.length}] agent ${task.agentIndex} done in ${(result.durationMs / 1000).toFixed(1)}s`,
        );
      } else {
        console.error(
          `[${completed}/${tasks.length}] agent ${task.agentIndex} FAILED: ${result.error}`,
        );
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, tasks.length) }, () => worker());
  await Promise.all(workers);

  return results;
}
