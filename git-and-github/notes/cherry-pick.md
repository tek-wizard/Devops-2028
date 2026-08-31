# Cherry-pick

`git merge` brings across every commit on a branch. `git cherry-pick` brings across **one
specific commit** and leaves the rest of the branch alone.

```bash
git cherry-pick <commit-hash>
```

## What it actually does

It takes the **change** that commit introduced, which is the diff between that commit and
its parent, and applies that change on top of whatever branch I am on now. Then it makes a
new commit for it.

The important consequence: the new commit has a **different hash** from the original. Same
message, same author, same change, different commit. It has to be different, because a
commit hash covers the parent commit as well, and the parent is different here. So the
commit is not moved or shared, it is replayed.

## When it is the right tool

- A bug fix is sitting on a feature branch that is not finished, and the fix is needed on
  main now. Merging the branch would drag in the unfinished work too.
- A fix went onto main and also has to go onto a release branch that is behind.
- A commit was made on the wrong branch by accident.

## When it is the wrong tool

Cherry-picking a commit and then merging the same branch later means the change arrives
twice. Git usually notices that the second copy changes nothing and skips it, but it can also
produce a conflict for no good reason. So it is for exceptions, not for regular work.

## If it conflicts

```bash
# fix the conflicting files by hand, then
git add <fixed files>
git cherry-pick --continue

# or give up and go back to where I was
git cherry-pick --abort
```

## Useful flags

```bash
git cherry-pick -n <hash>       # apply the change but do not commit it yet
git cherry-pick -x <hash>       # add a line to the message saying where it came from
git cherry-pick <hash1> <hash2> # more than one commit
git cherry-pick A..B            # a range, not including A itself
```

`-x` is worth using on a shared branch, because six months later the note in the message is
the only clue about where a duplicated commit came from.
