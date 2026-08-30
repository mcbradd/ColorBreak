# Issue tracker: GitHub

## Sealed-data audit routing

The sealed-data audit currently has no authorized named owner or monitored alert destination. It intentionally uploads its diff and triage evidence without creating issues or sending notifications. Do not enable routing until the organization records a primary owner, backup escalation, response expectation, and approved destination in `data/source-diff-triage.json`. Unresolved material diffs remain fail-closed.

Issues and specs for this repo live in GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create issue**: `gh issue create --title "..." --body "..."`. Use a heredoc for multi-line bodies.
- **Read an issue**: `gh issue view <number> --comments`, filtering comments with `jq` if also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` / `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Repo is inferred from `git remote -v` (`https://github.com/mcbradd/ColorBreak.git`) — `gh` does this automatically when run inside the clone.

## Pull requests as a triage surface

**PRs as request surface: no.** _(Set to `yes` if this repo should treat external PRs as feature requests; `/triage` reads this flag.)_

If set to `yes`, PRs would run through the same labels/states as issues, using `gh pr` equivalents:

- **Read PR**: `gh pr view <number> --comments` and `gh pr diff <number>` for the diff.
- **List external PRs for triage**: `gh pr list --state open --json number,title,body,labels,author,authorAssociation,comments`, keeping only PRs where `authorAssociation` is `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE` (drop `OWNER`/`MEMBER`/`COLLABORATOR`).
- **Comment / label / close**: `gh pr comment`, `gh pr edit --add-label`/`--remove-label`, `gh pr close`.

GitHub shares one number space across issues and PRs, so `#42` always refers to the same underlying object whether it's an issue or a PR.
