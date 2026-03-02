@dotnaos/skillpack

Install multiple skills from multiple repositories in one command.

skillpack reads a pack definition from a GitHub repository and executes the corresponding npx skills add calls sequentially.

Quick Start

npx @dotnaos/skillpack install DotNaos/skillpacks#school

Syntax:

npx @dotnaos/skillpack install <owner>/<repo>#<pack>

Pack resolution:

<repo-root>/skillpacks/<pack>.skillpack

For details on the underlying installer, see the skills.sh README￼.

Skillpack Repository Structure

<repo-root>/
  README.md
  skillpacks/
    school.skillpack
    dev.skillpack
    ops.skillpack

.skillpack File Format

A pack file is YAML at:

skillpacks/<pack>.skillpack

Top-level structure:

options:    # optional
install:    # required

options

All fields are optional:

options:
  global: false
  yes: false
  copy: false
  list: false
  all: false
  agents: []

Mapping to npx skills add:
	•	global -> -g, --global
	•	yes -> -y, --yes
	•	copy -> --copy
	•	list -> -l, --list
	•	all -> --all
	•	agents -> -a, --agent <value> (repeatable)

Rules:
	•	If all: true, skills fields are ignored.

install

Required. Array of steps:

install:
  - src: <owner>/<repo>/skills
    skills: [skillA, skillB]

	•	src is passed to npx skills add <src>
	•	skills becomes repeated --skill <name> arguments

Forwarding Additional Flags

Flags after -- are appended to every npx skills add call:

npx @dotnaos/skillpack install DotNaos/skillpacks#school -- --yes --global

Execution Model

For each step, skillpack runs:

npx skills add <src> [--skill ...] [--agent ...] [flags from options] [forwarded flags]

Commands execute sequentially and stop on first failure.
