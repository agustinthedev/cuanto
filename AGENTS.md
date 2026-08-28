# Project contribution guidelines

## Scope

- These guidelines apply to this repository and all of its subdirectories.
- Follow more specific instructions found in a nested `AGENTS.md` when they exist.

## Commits

- Keep commits small, focused, and easy to review.
- Each commit should contain one logical change.
- Do not mix unrelated refactors, cleanup, formatting changes, or dependency updates into a feature or fix commit.
- Do not mention the development assistant, automation tooling, or its brand name in commit messages.

## Branches

- Name branches using the format `<change-type>/<short-description>`.
- Use lowercase kebab-case for the description.
- Keep the description short and specific.
- Use a change type such as `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, or `build`.
- Examples: `feat/add-export`, `fix/handle-null-state`, `docs/update-setup`.
- Do not mention the development assistant, automation tooling, or its brand name in branch names.

## Pull requests

- Write pull request titles and descriptions in English.
- Keep the pull request focused on the related commits.
- Summarize what changed, why it changed, and any relevant testing or validation.
- Do not mention the development assistant, automation tooling, or its brand name in pull request titles, descriptions, or comments.
- Once the requested work is complete and validation passes, push the branch and create or update the pull request without asking for confirmation.

## Validation

- Before pushing or opening a pull request, run the most relevant tests, lint checks, type checks, and build checks available for the changed code.
- If a check cannot be run, explain the reason in the pull request description and final summary.
- Report the commit hash, pushed branch, pull request URL, and validation performed.

## Scope and safety

- Ask for clarification only when required information is missing or the choice would materially change the implementation.
- Do not make destructive changes or unrelated modifications without explicit approval.
