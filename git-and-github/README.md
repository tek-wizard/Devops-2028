# Git and GitHub (Session 5)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework that was given

1. Try `git commit -a -m` and work out how it is different from a plain `git commit -m`.
2. Practise cherry-picking:
   - make 2 to 4 commits on the main branch
   - use `git log` to look at them
   - create a new branch
   - make 2 to 3 commits on the new branch
   - cherry-pick one specific commit from the new branch onto main
   - show the work in a screenshot or an MD file

Both are below with the real terminal output. I did the exercise **in this repository
itself**, so the branch, the commits and the cherry-picked commit are all visible in the
history on GitHub rather than being done in a throwaway folder and deleted.

The [`notes`](notes) folder holds the git notes I wrote while doing it. They are also the
files the exercise commits and cherry-picks, so the exercise did something useful instead of
committing empty test files.

---

# Part 1: `git commit -m` and `git commit -a -m`

## What I expected

I thought `-a` meant "add everything", so `git commit -a -m` would be a shortcut for
`git add .` followed by `git commit -m`. That is wrong, and testing it showed exactly how.

`-a` means "automatically stage every **tracked** file that has been modified". The word that
matters is tracked. A file git has never seen before is untracked, and `-a` skips it
completely.

## Test 1: `-a` with a brand new file

I wrote a new file, `notes/git-basics.md`, and went straight for the shortcut:

```bash
$ git status --short
?? git-and-github/

$ git commit -a -m "Add git basics notes"
On branch main
Untracked files:
  (use "git add <file>..." to include in what will be committed)
	git-and-github/

nothing added to commit but untracked files present (use "git add" to track)
$ echo $?
1
```

Nothing was committed and the exit code was 1. The `??` in `git status --short` is the clue:
two question marks mean untracked. So `-a` did not help at all here.

## Test 2: add it once, then `-a` works

```bash
$ git add git-and-github/notes/git-basics.md
$ git status --short
A  git-and-github/notes/git-basics.md

$ git commit -m "Add notes on the three areas git keeps"
```

`A` means added and staged. Now that git is tracking the file, I edited it and tried again:

```bash
$ git status --short
 M git-and-github/notes/git-basics.md

$ git commit -a -m "Expand the git basics notes with the diff commands"
[main f9e79b4] Expand the git basics notes with the diff commands
 1 file changed, 5 insertions(+)

$ git status --short
(clean)
```

This time it worked with no `git add` at all. ` M` with a leading space means modified but
not staged, and `-a` staged it and committed it in one go.

## The answer

| | `git commit -m` | `git commit -a -m` |
|---|---|---|
| Commits staged changes | Yes | Yes |
| Commits modified tracked files that are not staged | No | Yes |
| Commits brand new untracked files | No | **No** |
| Commits deletions of tracked files | Only if staged | Yes |
| Needs `git add` first | Yes | Only the first time a file appears |

So `-a` is a shortcut for `git add -u` plus `git commit`, not for `git add .` plus
`git commit`. `git add -u` only touches files already tracked.

## What I think about using it

It is convenient and I now avoid it for real work, for two reasons.

The first is the one I just hit. A new file is silently left out. On a commit touching one
file that is obvious, but adding a new module and committing with `-a` means the commit is
missing the new file, the build breaks for everyone else, and it is not obvious why.

The second is that it takes away the choice of what goes into a commit. Editing three
unrelated things and running `git commit -a -m` puts all three in one commit with one
message. The staging area exists so that a commit can be one logical change, which makes the
history readable and makes it possible to revert one thing without reverting the other two.

`git commit -a -m` is fine for a quick fix to a file already being worked on. For anything
else, `git status`, then `git add` what belongs together, then commit.

---

# Part 2: The cherry-pick exercise

## Step 1: commits already on main

The repository already had commits from the earlier sessions, so main had history to work
with:

```bash
$ git log --oneline -6
f9e79b4 Expand the git basics notes with the diff commands
1b050f4 Add notes on the three areas git keeps
9eaee70 Add session 8 Docker networking, bind mount and volume tasks
a4470b7 Add Docker image notes with screenshots and the multi-stage task
b5e9a6b Add Hello World apps and Dockerfiles for node, python, java and apache
5fb60c4 Add session 6 Docker fundamentals notes
```

`--oneline` is short hash plus subject. In full there is a lot more per commit:

```bash
$ git log -1
commit f9e79b4f79d369ac6f820fe2960e2b0fa7eaa789
Author: Prateek Singh <prateek.singh02@scalerailabs.com>
Date:   Mon Aug 31 17:31:31 2026 +0530

    Expand the git basics notes with the diff commands
```

The full hash is 40 hex characters. It is a SHA-1 of the commit's content, which includes the
files, the message, the author, the date **and the parent commit's hash**. That last part is
what chains commits into a history where nothing can be changed without changing every hash
after it, and it is also the reason a cherry-picked commit cannot keep its original hash.

Useful `git log` variations:

```bash
git log --oneline                    # one line each
git log --oneline --graph --all      # every branch, drawn as a graph
git log -p                           # with the diff of each commit
git log --stat                       # with a summary of files changed
git log -3                           # only the last 3
git log --author="Prateek"           # filter by author
git log --format='%h %an %s'         # pick the fields myself
```

## Step 2: create a new branch

```bash
$ git switch -c feature/git-notes
Switched to a new branch 'feature/git-notes'

$ git branch -v
* feature/git-notes f9e79b4 Expand the git basics notes with the diff commands
  main              f9e79b4 Expand the git basics notes with the diff commands
```

Both branches point at the **same commit** `f9e79b4`, which is what a branch really is: a
pointer, not a copy of the files. The `*` marks the branch I am on.

## Step 3: three commits on the new branch

I wrote three separate note files and committed each one on its own, so that each commit
holds exactly one change. That is the whole point of the exercise, because cherry-picking one
of three commits only makes sense if the commits are separable.

```bash
$ git add git-and-github/notes/branching.md
$ git commit -m "Add notes on branches and HEAD"

$ git add git-and-github/notes/cherry-pick.md
$ git commit -m "Add notes on cherry-pick and when to use it"

$ git add git-and-github/notes/undoing-changes.md
$ git commit -m "Add notes on undoing changes with reset and revert"
```

```bash
$ git log --oneline -5
5d00c61 Add notes on undoing changes with reset and revert
0c1bde2 Add notes on cherry-pick and when to use it
25bd581 Add notes on branches and HEAD
f9e79b4 Expand the git basics notes with the diff commands
1b050f4 Add notes on the three areas git keeps
```

The commit I want on main is the middle one, **`0c1bde2`**. Not the newest, not the oldest,
so this is a genuine cherry-pick rather than something a merge or a fast forward would do
anyway.

## Step 4: back to main

```bash
$ git switch main
Switched to branch 'main'

$ ls git-and-github/notes/
git-basics.md
```

Only one file. The three files from the branch are not there, because switching branches
moves `HEAD` and rewrites the working directory to match that branch. The files still exist
in the repository, they are just not checked out right now.

## Step 5: the cherry-pick

```bash
$ git cherry-pick 0c1bde2
[main f4a50df] Add notes on cherry-pick and when to use it
 Date: Mon Aug 31 17:32:10 2026 +0530
 1 file changed, 55 insertions(+)
 create mode 100644 git-and-github/notes/cherry-pick.md
```

```bash
$ ls git-and-github/notes/
cherry-pick.md
git-basics.md
```

`cherry-pick.md` is on main now, and `branching.md` and `undoing-changes.md` are not. Exactly
one commit came across out of three.

## Step 6: the history, drawn

Before the cherry-pick the two branches were still in a straight line, because main was an
ancestor of the branch:

```bash
$ git log --oneline --graph --all -8
* 5d00c61 Add notes on undoing changes with reset and revert
* 0c1bde2 Add notes on cherry-pick and when to use it
* 25bd581 Add notes on branches and HEAD
* f9e79b4 Expand the git basics notes with the diff commands
* 1b050f4 Add notes on the three areas git keeps
* 9eaee70 Add session 8 Docker networking, bind mount and volume tasks
* a4470b7 Add Docker image notes with screenshots and the multi-stage task
* b5e9a6b Add Hello World apps and Dockerfiles for node, python, java and apache
```

After the cherry-pick they have properly diverged, and this is the picture that explains the
whole thing:

```bash
$ git log --oneline --graph --all -8
* f4a50df Add notes on cherry-pick and when to use it
| * 5d00c61 Add notes on undoing changes with reset and revert
| * 0c1bde2 Add notes on cherry-pick and when to use it
| * 25bd581 Add notes on branches and HEAD
|/
* f9e79b4 Expand the git basics notes with the diff commands
* 1b050f4 Add notes on the three areas git keeps
* 9eaee70 Add session 8 Docker networking, bind mount and volume tasks
* a4470b7 Add Docker image notes with screenshots and the multi-stage task
```

Reading the drawing:

- The `|/` is where the two lines split, at `f9e79b4`, the commit both branches shared.
- The left column going up is main, which has exactly one new commit, `f4a50df`.
- The indented column is `feature/git-notes` with its three commits.
- `0c1bde2` and `f4a50df` have the **same message** and sit on **different branches**.

## Step 7: the detail that matters, two hashes for one change

```bash
$ git log --format='%h  %an  %s' feature/git-notes -3
5d00c61  Prateek Singh  Add notes on undoing changes with reset and revert
0c1bde2  Prateek Singh  Add notes on cherry-pick and when to use it
25bd581  Prateek Singh  Add notes on branches and HEAD

$ git log --format='%h  %an  %s' main -3
f4a50df  Prateek Singh  Add notes on cherry-pick and when to use it
f9e79b4  Prateek Singh  Expand the git basics notes with the diff commands
1b050f4  Prateek Singh  Add notes on the three areas git keeps
```

Same message, same author, **different hash**. `0c1bde2` on the branch, `f4a50df` on main.

Both commits contain the identical change:

```bash
$ git show --stat --oneline 0c1bde2
0c1bde2 Add notes on cherry-pick and when to use it
 git-and-github/notes/cherry-pick.md | 55 +++++++++++++++++++++++++++++++++++++
 1 file changed, 55 insertions(+)

$ git show --stat --oneline f4a50df
f4a50df Add notes on cherry-pick and when to use it
 git-and-github/notes/cherry-pick.md | 55 +++++++++++++++++++++++++++++++++++++
 1 file changed, 55 insertions(+)
```

55 insertions in the same file in both. And the resulting files are byte for byte identical:

```bash
$ git diff feature/git-notes:git-and-github/notes/cherry-pick.md main:git-and-github/notes/cherry-pick.md
(no output means the two files are identical)
```

So the answer to "what does cherry-pick do" is: it copies the **change**, not the commit. A
new commit gets created on the current branch holding the same change, and it has to have a
different hash because the hash includes the parent commit, and the parent is different here.

That single fact explains the main warning about cherry-picking. Because these are two
separate commits as far as git is concerned, merging `feature/git-notes` into main later means
git tries to apply that change again. It normally works out that the result is already there
and skips it, but it can also raise a conflict that looks confusing when the content is
already correct.

## What I understood about when to use it

The situation cherry-pick is built for: a bug fix committed on a feature branch that is only
half finished, and the fix is needed on main today. Merging the branch would bring the
unfinished work along. Cherry-picking the fix brings only the fix.

It is deliberately an exception. For normal work the answer is merge the whole branch,
because that keeps one copy of each commit and a history that reflects what actually
happened.

## Commands used in the exercise

| Command | What it did |
|---|---|
| `git log --oneline` | Short list of commits |
| `git log --oneline --graph --all` | Draw every branch and where they split |
| `git log --format='%h %an %s'` | Pick hash, author and subject only |
| `git switch -c name` | Create a branch and move onto it |
| `git switch name` | Move to an existing branch |
| `git branch -v` | List branches with the commit each points at |
| `git cherry-pick <hash>` | Apply one commit's change onto the current branch |
| `git show --stat <hash>` | What a commit changed, as a summary |
| `git diff branch1:file branch2:file` | Compare the same file across branches |

---

# The commands from the session in general

## Starting out

```bash
git init                        # start a repository in this folder
git clone <url>                 # copy an existing one from GitHub
git config user.name "Name"     # set the name on commits, for this repo
git config user.email "email"   # set the email, for this repo
git config --global ...         # the same, for every repo on the machine
```

I set the name and email with a plain `git config`, not `--global`, so it applies to this
repository and does not change the setting for anything else on my laptop.

## Everyday work

```bash
git status                      # what has changed
git add file                    # stage one file
git add .                       # stage everything below here
git commit -m "message"         # commit what is staged
git commit -a -m "message"      # stage modified tracked files and commit
git diff                        # unstaged changes
git diff --staged               # staged changes
git log --oneline               # history
git show <hash>                 # one commit in full
```

## Working with GitHub

```bash
git remote add origin <url>     # point the local repo at a GitHub repo
git remote -v                   # which remotes exist
git push -u origin main         # first push, and remember the tracking branch
git push                        # every push after that
git pull                        # fetch and merge whatever is new
git fetch                       # download without merging into my branch
```

`git fetch` and `git pull` are worth separating. `fetch` downloads and changes nothing in my
working directory, so I can look before deciding. `pull` is `fetch` plus `merge` in one step.

## Branching and combining

```bash
git branch                      # list
git switch -c name              # create and switch
git switch main                 # switch
git merge name                  # merge a branch into the one I am on
git cherry-pick <hash>          # one commit only
git rebase main                 # replay my commits on top of main
git branch -d name              # delete a merged branch
```

## Fixing mistakes

```bash
git restore file                # throw away my edits to a file
git restore --staged file       # unstage but keep the edits
git commit --amend -m "msg"     # rewrite the last commit
git reset --soft HEAD~1         # undo last commit, keep changes staged
git reset --hard HEAD~1         # undo last commit and destroy the changes
git revert <hash>               # new commit that undoes an old one
git reflog                      # everywhere HEAD has been, for recovery
```

The one rule I want to remember: `reset` rewrites history and `revert` adds to it. On
anything already pushed, use `revert`.

## Cheat sheets from the class notes

- https://git-scm.com/cheat-sheet
- https://education.github.com/git-cheat-sheet-education.pdf
- https://www.geeksforgeeks.org/git/git-cheat-sheet/

---

# What I took away

- A commit hash covers the parent commit as well, which is why history cannot be quietly
  edited and why a cherry-picked commit gets a new hash.
- A branch is one pointer at one commit. Creating one is instant because nothing is copied.
- `-a` in `git commit -a -m` means tracked files only. New files are skipped without an error
  that says so clearly.
- Cherry-pick copies a change, not a commit. Same content, new commit, different hash.
- `git log --oneline --graph --all` is the fastest way to understand what state a repository
  is actually in.
