# `@dotnaos/skillpack`

Install multiple skills from multiple repositories in one command.

`skillpack` reads a pack definition from a GitHub repository and executes the corresponding `bunx skills add` calls sequentially.

## Quick Start

```bash
bunx @dotnaos/skillpack install DotNaos/skillpacks#school
```

## Syntax

```bash
bunx @dotnaos/skillpack install <owner>/<repo>#<pack>
```

## Pack Resolution

A pack is resolved at:

```text
<repo-root>/skillpacks/<pack>.skillpack
```

For details on the underlying installer, see the [`skills.sh` README](https://github.com/codex-cli/skills.sh).

## Skillpack Repository Structure

```text
<repo-root>/
  README.md
  skillpacks/
    school.skillpack
    dev.skillpack
    ops.skillpack
```

## `.skillpack` File Format

A pack file is YAML at:

```text
skillpacks/<pack>.skillpack
```

Top-level structure:

```yaml
options:    # optional
install:    # required
```

### `options`

All fields are optional:

```yaml
options:
  global: false
  yes: false
  copy: false
  list: false
  all: false
  agents: []
```

Mapping to `bunx skills add`:

- `global` -> `-g`, `--global`
- `yes` -> `-y`, `--yes`
- `copy` -> `--copy`
- `list` -> `-l`, `--list`
- `all` -> `--all`
- `agents` -> `-a`, `--agent <value>` (repeatable)

Rules:

- If `all: true`, `skills` fields are ignored.

### `install`

Required. Array of steps:

```yaml
install:
  - src: <owner>/<repo>/skills
    skills: [skillA, skillB]
```

- `src` is passed to `bunx skills add <src>`
- `skills` becomes repeated `--skill <name>` arguments

## Forwarding Additional Flags

Flags after `--` are appended to every `bunx skills add` call:

```bash
bunx @dotnaos/skillpack install DotNaos/skillpacks#school -- --yes --global
```

## Execution Model

For each step, skillpack runs:

```bash
bunx skills add <src> [--skill ...] [--agent ...] [flags from options] [forwarded flags]
```

Commands execute sequentially and stop on first failure.
