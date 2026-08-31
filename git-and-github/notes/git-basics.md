# Git basics

Git keeps three areas, and almost every confusing thing about git makes sense once these
three are clear.

| Area | What it is | How something gets there |
|---|---|---|
| Working directory | The files as they are on my disk right now | Editing a file |
| Staging area (index) | The set of changes chosen for the next commit | `git add` |
| Repository | The commits, the permanent history | `git commit` |

A file also has a state git cares about:

- **untracked** means git has never seen this file
- **tracked and unmodified** means it matches the last commit
- **tracked and modified** means it changed since the last commit
- **staged** means the change is ready to be committed

## The commands for each step

```bash
git status              # which files are in which state
git diff                # changes not staged yet
git diff --staged       # changes that are staged
git add file            # stage one file
git add .               # stage everything under the current folder
git commit -m "text"    # commit what is staged
git log                 # the history
```
