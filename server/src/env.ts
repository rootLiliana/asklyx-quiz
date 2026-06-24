import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

export function loadEnvFile() {
  const envPaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "..", ".env"),
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    loadEnvPath(envPath);
  }
}

function loadEnvPath(envPath: string) {
  const lines = readFileSync(envPath, "utf8")
    .split(/\r?\n/);

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (
      !trimmedLine ||
      trimmedLine.startsWith("#")
    ) {
      continue;
    }

    const separatorIndex =
      trimmedLine.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmedLine
      .slice(0, separatorIndex)
      .trim();
    const value = trimmedLine
      .slice(separatorIndex + 1)
      .trim()
      .replace(/^["']|["']$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
