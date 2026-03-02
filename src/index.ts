#!/usr/bin/env node

import { spawn } from "node:child_process";
import process from "node:process";
import { parse } from "yaml";

type PackRef = {
  owner: string;
  repo: string;
  pack: string;
};

type SkillpackOptions = {
  global?: boolean;
  yes?: boolean;
  copy?: boolean;
  list?: boolean;
  all?: boolean;
  agents?: string[];
};

type InstallStep = {
  src: string;
  skills?: string[];
};

type SkillpackFile = {
  options?: SkillpackOptions;
  install: InstallStep[];
};

function usage(): never {
  console.error("Usage: skillpack install <owner>/<repo>#<pack> [-- <extra flags>]");
  process.exit(1);
}

function parsePackRef(input: string): PackRef {
  const [repoRef, pack] = input.split("#");
  if (!repoRef || !pack) {
    throw new Error(`Invalid pack reference: ${input}. Expected <owner>/<repo>#<pack>`);
  }

  const [owner, repo] = repoRef.split("/");
  if (!owner || !repo) {
    throw new Error(`Invalid repository reference: ${repoRef}. Expected <owner>/<repo>`);
  }

  return { owner, repo, pack };
}

function buildRawUrl(packRef: PackRef): string {
  return `https://raw.githubusercontent.com/${packRef.owner}/${packRef.repo}/HEAD/skillpacks/${packRef.pack}.skillpack`;
}

function toBooleanFlag(enabled: boolean | undefined, flag: string, args: string[]): void {
  if (enabled) {
    args.push(flag);
  }
}

function validateSkillpack(data: unknown): SkillpackFile {
  if (typeof data !== "object" || data === null) {
    throw new Error("Invalid skillpack file: expected a YAML object");
  }

  const root = data as Record<string, unknown>;
  const install = root.install;

  if (!Array.isArray(install) || install.length === 0) {
    throw new Error("Invalid skillpack file: 'install' must be a non-empty array");
  }

  const normalizedInstall = install.map((step, index) => {
    if (typeof step !== "object" || step === null) {
      throw new Error(`Invalid install step at index ${index}: expected object`);
    }

    const record = step as Record<string, unknown>;
    if (typeof record.src !== "string" || record.src.trim() === "") {
      throw new Error(`Invalid install step at index ${index}: 'src' must be a non-empty string`);
    }

    let skills: string[] | undefined;
    if (record.skills !== undefined) {
      if (!Array.isArray(record.skills) || !record.skills.every((entry) => typeof entry === "string" && entry.trim() !== "")) {
        throw new Error(`Invalid install step at index ${index}: 'skills' must be an array of non-empty strings`);
      }
      skills = record.skills;
    }

    return {
      src: record.src,
      skills,
    };
  });

  const optionsRaw = root.options;
  let options: SkillpackOptions | undefined;

  if (optionsRaw !== undefined) {
    if (typeof optionsRaw !== "object" || optionsRaw === null) {
      throw new Error("Invalid skillpack file: 'options' must be an object");
    }

    const o = optionsRaw as Record<string, unknown>;

    const readOptionalBoolean = (key: keyof SkillpackOptions): boolean | undefined => {
      const value = o[key as string];
      if (value === undefined) return undefined;
      if (typeof value !== "boolean") {
        throw new Error(`Invalid options.${String(key)}: expected boolean`);
      }
      return value;
    };

    let agents: string[] | undefined;
    if (o.agents !== undefined) {
      if (!Array.isArray(o.agents) || !o.agents.every((entry) => typeof entry === "string" && entry.trim() !== "")) {
        throw new Error("Invalid options.agents: expected array of non-empty strings");
      }
      agents = o.agents;
    }

    options = {
      global: readOptionalBoolean("global"),
      yes: readOptionalBoolean("yes"),
      copy: readOptionalBoolean("copy"),
      list: readOptionalBoolean("list"),
      all: readOptionalBoolean("all"),
      agents,
    };
  }

  return {
    options,
    install: normalizedInstall,
  };
}

async function fetchSkillpack(url: string): Promise<SkillpackFile> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch skillpack (${response.status} ${response.statusText}) from ${url}`);
  }

  const body = await response.text();
  return validateSkillpack(parse(body));
}

async function runCommand(command: string, args: string[]): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Command terminated by signal: ${signal}`));
        return;
      }

      if (code !== 0) {
        reject(new Error(`Command exited with code ${code}`));
        return;
      }

      resolve();
    });
  });
}

function buildSkillsAddArgs(step: InstallStep, options: SkillpackOptions | undefined, forwardedFlags: string[]): string[] {
  const args = ["skills", "add", step.src];

  const allEnabled = options?.all === true;
  if (!allEnabled && step.skills && step.skills.length > 0) {
    for (const skill of step.skills) {
      args.push("--skill", skill);
    }
  }

  if (options?.agents) {
    for (const agent of options.agents) {
      args.push("--agent", agent);
    }
  }

  toBooleanFlag(options?.global, "--global", args);
  toBooleanFlag(options?.yes, "--yes", args);
  toBooleanFlag(options?.copy, "--copy", args);
  toBooleanFlag(options?.list, "--list", args);
  toBooleanFlag(options?.all, "--all", args);

  args.push(...forwardedFlags);

  return args;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length < 2 || args[0] !== "install") {
    usage();
  }

  const packRefArg = args[1];
  if (!packRefArg) {
    usage();
  }

  const forwardedIndex = args.indexOf("--");
  const forwardedFlags = forwardedIndex >= 0 ? args.slice(forwardedIndex + 1) : [];

  const packRef = parsePackRef(packRefArg);
  const url = buildRawUrl(packRef);

  console.log(`Fetching pack definition: ${url}`);
  const skillpack = await fetchSkillpack(url);

  for (const step of skillpack.install) {
    const commandArgs = buildSkillsAddArgs(step, skillpack.options, forwardedFlags);
    console.log(`Running: bunx ${commandArgs.join(" ")}`);
    await runCommand("bunx", commandArgs);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`skillpack failed: ${message}`);
  process.exit(1);
});
