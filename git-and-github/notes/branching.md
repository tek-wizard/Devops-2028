# Branches

A branch is not a copy of the project. It is a movable pointer at one commit. That is why
making a branch is instant no matter how big the repository is, git only writes a file
containing one commit hash.

`HEAD` is another pointer, and it points at the branch I am currently on. Switching branches
moves `HEAD` and then updates the files in my working directory to match.

## Commands

```bash
git branch                    # list branches, the current one has a *
git branch -v                 # list them with the commit each one points at
git branch name               # create a branch but stay where I am
git switch name               # switch to an existing branch
git switch -c name            # create and switch in one step
git switch -                  # go back to the branch I was on before
git branch -d name            # delete a branch that is already merged
git branch -D name            # delete it even if it is not merged
```

`git switch` and `git restore` are the newer commands. `git checkout` still does both jobs,
which is exactly why it was confusing enough to be split into two.

## Why branch at all

Work in progress does not sit on top of the code everyone else uses. A broken commit on a
branch affects nobody. When the work is finished the branch gets merged, and if the idea
turns out to be wrong the branch gets deleted and main never knew about it.
