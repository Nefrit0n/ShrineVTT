import { spawn } from "node:child_process";

const processes = [];
let isShuttingDown = false;

function run(command, name) {
  const child = spawn(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });

  processes.push({ child, name });

  child.on("exit", (code) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    if (code !== null && code !== 0) {
      console.error(`Процесс "${name}" завершился с кодом ${code}`);
    }
    shutdown(code ?? undefined);
  });

  child.on("error", (error) => {
    if (isShuttingDown) {
      return;
    }
    isShuttingDown = true;
    console.error(`Не удалось запустить процесс "${name}":`, error);
    shutdown(1);
  });
}

function shutdown(exitCode) {
  for (const { child } of processes) {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  }
  process.exit(exitCode ?? 0);
}

process.on("SIGINT", () => {
  if (!isShuttingDown) {
    isShuttingDown = true;
    shutdown();
  }
});

process.on("SIGTERM", () => {
  if (!isShuttingDown) {
    isShuttingDown = true;
    shutdown();
  }
});

run("node server/index.js", "server");
run("vite", "client");
