# Undoing things

The commands here look similar and do very different amounts of damage, so this is the table
I want to be able to remember under pressure.

| Situation | Command |
|---|---|
| Edited a file, want the last committed version back | `git restore file` |
| Staged something by mistake, want to unstage it | `git restore --staged file` |
| Last commit message has a typo | `git commit --amend -m "better message"` |
| Forgot to include a file in the last commit | `git add file` then `git commit --amend --no-edit` |
| Want to undo the last commit but keep the changes staged | `git reset --soft HEAD~1` |
| Want to undo the last commit and unstage the changes | `git reset HEAD~1` |
| Want to undo the last commit and throw the changes away | `git reset --hard HEAD~1` |
| Want to undo a commit that is already pushed | `git revert <hash>` |

## reset and revert are not the same

`git reset` rewrites history. The commit is gone from the branch. That is fine on my own
local work and a real problem on a branch other people have pulled, because their history no
longer matches mine.

`git revert` does not rewrite anything. It creates a **new** commit that undoes the change of
an old one. The history keeps both, which is honest and safe. This is the one to use on
anything already pushed.

## The dangerous one

`git reset --hard` throws away uncommitted work with no confirmation and no undo. Anything
that was never committed is simply gone.

## The safety net

```bash
git reflog
```

`git reflog` lists everywhere `HEAD` has pointed recently, including commits that are no
longer on any branch. A "lost" commit after a bad reset can usually be recovered from here
with `git reset --hard <hash from reflog>`, as long as it was committed at least once.
