# CI/CD and GitHub Actions (Session 16)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework task

Build a complete CI/CD demo project with GitHub Actions covering CI vs CD, the pipeline,
workflows, jobs, steps, runners, secrets, artifacts, build, test and pipeline execution.

The workflow file is at [`.github/workflows/ci-cd.yml`](../.github/workflows/ci-cd.yml) in the
repository root, because that is the only place GitHub looks for workflows.

**This pipeline really runs.** Every output below is from an actual run on this repository.

---

## CI and CD

**Continuous Integration** is the first half: every push gets built and tested automatically,
so a change that breaks something is caught in minutes instead of at release time.

**Continuous Delivery / Deployment** is the second half: once the tests pass, the artifact is
built, published and deployed without anyone doing it by hand.

The split in my workflow:

| | Job | Runs on |
|---|---|---|
| CI | `build-and-test` | Every push **and** every pull request |
| CD | `docker-build-and-push` | Pushes to `main` only, and only if CI passed |

That is why the CD job has these two lines:

```yaml
    needs: build-and-test                     # will not start unless CI passed
    if: github.event_name != 'pull_request'   # pull requests get tested but not published
```

A pull request from a fork should never be able to publish an image, which is what the second
line prevents.

## The vocabulary

| Term | What it is |
|---|---|
| **Workflow** | The whole `.yml` file. One pipeline |
| **Job** | A group of steps that run on one machine. Jobs run in parallel unless linked with `needs` |
| **Step** | One command or one action inside a job |
| **Runner** | The machine the job runs on. `ubuntu-latest` is GitHub's |
| **Action** | A reusable step somebody published, like `actions/checkout@v4` |
| **Secret** | An encrypted value, available as `${{ secrets.NAME }}` and masked in logs |
| **Artifact** | A file saved from a run and downloadable afterwards |

A thing I had wrong at first: **each job gets a fresh machine**. Files written in one job are
gone in the next, which is why the CD job checks the code out again rather than reusing what
CI had.

---

## The application

A small Node.js app in [app/](app), deliberately split so the logic can be tested without
starting a server:

```javascript
function greet(name) {
  if (!name || name.trim() === "") {
    return "Hello, world";
  }
  return `Hello, ${name.trim()}`;
}
```

`server.js` serves a page and a `/health` endpoint, which is what a Kubernetes probe would
call.

### Tests

Five tests using Node's built in test runner, so there is no test framework to install:

```javascript
test("greet falls back when the name is empty", () => {
  assert.strictEqual(greet(""), "Hello, world");
  assert.strictEqual(greet("   "), "Hello, world");
  assert.strictEqual(greet(undefined), "Hello, world");
});
```

```text
$ npm test
ℹ tests 5
ℹ pass 5
ℹ fail 0
```

## The Dockerfile

Multi-stage, and the tests run **inside the build**:

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY app/package.json ./
RUN npm install
COPY app/ ./
RUN npm test

FROM node:22-alpine AS production
WORKDIR /app
RUN addgroup -S nodeapp && adduser -S nodeapp -G nodeapp
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/app.js /app/server.js ./
USER nodeapp
EXPOSE 3000
CMD ["node", "server.js"]
```

Two things on purpose:

- `RUN npm test` in the build stage means **a failing test fails the image build**, so a
  broken image cannot be produced even if someone builds it by hand outside CI.
- `USER nodeapp` means the container does not run as root. The default is root, which is more
  access than a web app needs.

Checked locally before wiring up CI:

```text
$ docker build -t cicd-demo:local .
#11 [build 6/6] RUN npm test
#11 0.247 # pass 5
#11 0.247 # fail 0

$ curl http://localhost:8090
<h1>Hello, DevOps 2028</h1>
$ curl http://localhost:8090/health
{"status":"ok"}
```

---

## The workflow

### Triggers

```yaml
on:
  push:
    branches: [main]
    paths:
      - 'cicd-github-actions/**'
      - '.github/workflows/ci-cd.yml'
  pull_request:
    branches: [main]
  workflow_dispatch:
```

The `paths` filter matters in a repository like this one. Without it every homework commit
would start the pipeline, which wastes runner minutes. `workflow_dispatch` adds a Run button
for triggering it by hand.

### CI job

```yaml
  build-and-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
      - name: Install dependencies
        working-directory: cicd-github-actions/app
        run: npm install
      - name: Run unit tests
        working-directory: cicd-github-actions/app
        run: npm test
      - uses: actions/upload-artifact@v4
        with:
          name: test-results
          path: cicd-github-actions/app/test-results.txt
          retention-days: 7
```

`actions/checkout@v4` has to be first. Without it the runner is an empty machine with none of
my code on it.

### CD job

```yaml
  docker-build-and-push:
    needs: build-and-test
    if: github.event_name != 'pull_request'
    permissions:
      contents: read
      packages: write
    steps:
      - uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ secrets.GITHUB_TOKEN }}
```

### Secrets

I did not create a single secret for this. `secrets.GITHUB_TOKEN` is generated automatically
for every run and thrown away at the end, and `permissions: packages: write` is what grants
it the ability to push.

That is better than storing a personal access token, because there is no long lived
credential to leak, and it is the same "temporary credentials instead of permanent keys" idea
as IAM roles in [the AWS notes](../terraform-iac/aws-services/01-iam).

Real secrets would go in Settings, Secrets and variables, Actions, and be referenced the same
way. GitHub masks them in logs, though anything printed on purpose can still leak.

---

## Pipeline execution

```text
$ gh run list
✓  main  CI/CD Pipeline  main  push  37604195184
```

```text
$ gh run view 37604195184

✓ main CI/CD Pipeline · 37604195184
Triggered via push about 1 minute ago

JOBS
✓ Build and test in 18s (ID 112735595290)
✓ Build the image and push it in 36s (ID 112735715999)
```

Both jobs green. The CD job started only after CI finished, because of `needs`.

### The test step on the runner

```text
# tests 5
# pass 5
# fail 0
# duration_ms 73.636109
```

### The image that was published

```text
Pushed these tags:
ghcr.io/tek-wizard/devops-2028/cicd-demo:latest
ghcr.io/tek-wizard/devops-2028/cicd-demo:253b3f3
```

Two tags on purpose. `latest` is convenient, and the one ending `253b3f3` is the **git commit
SHA**, so any running image can be traced back to the exact commit it was built from.
Deploying `latest` to production is a bad idea precisely because it does not say what it is.

### Every step in the CD job

```text
✓ Set up job
✓ Check out the code
✓ Lowercase the image name
✓ Log in to the container registry
✓ Work out the image tags
✓ Build and push
✓ Show what was pushed
✓ Complete job
```

---

## A problem I hit

The image name is built from `${{ github.repository }}`, which for this repo is
`tek-wizard/Devops-2028` with a **capital D**. GHCR only accepts lowercase image paths, so the
push would have failed.

I spotted it before pushing and added a step to lowercase it:

```yaml
      # GHCR only accepts lowercase image paths and this repo is "Devops-2028",
      # so the name has to be lowercased before it is used as a tag.
      - name: Lowercase the image name
        run: echo "IMAGE_NAME_LC=$(echo '${{ env.IMAGE_NAME }}' | tr '[:upper:]' '[:lower:]')" >> $GITHUB_ENV
```

Writing to `$GITHUB_ENV` is how one step passes a value to later steps, since each `run` is a
separate shell and a normal variable would not survive.

The published tag confirms it worked: `ghcr.io/tek-wizard/devops-2028/cicd-demo` is all
lowercase even though the repository is not.

## Warnings in the run

The run was green but had annotations:

```text
! Node.js 20 is deprecated. The following actions target Node.js 20 but are being
  forced to run on Node.js 24: actions/checkout@v4, actions/setup-node@v4
- The ubuntu-latest label will migrate to Ubuntu 26 beginning October 19, 2026
```

Neither breaks anything today, but both are the kind of thing that breaks a pipeline later.
It is also an argument for pinning `runs-on` to a specific Ubuntu version on anything
important, rather than `ubuntu-latest` which changes underneath you.

---

## The pipeline end to end

```
push to main
     |
     v
[ CI: build-and-test ]
  checkout -> setup node -> npm install -> npm test -> upload artifact
     |
     | needs: build-and-test   (stops here if tests fail)
     v
[ CD: docker-build-and-push ]
  checkout -> lowercase name -> login to ghcr -> tag -> build and push
     |
     v
ghcr.io/tek-wizard/devops-2028/cicd-demo:latest
ghcr.io/tek-wizard/devops-2028/cicd-demo:<commit sha>
```

## What I took away

- Each job is a fresh machine, so anything needed in a later job has to be checked out again
  or passed as an artifact.
- `needs` is what turns separate jobs into a pipeline, and it is what stops a broken build
  from being published.
- `GITHUB_TOKEN` removes the need to store registry credentials at all.
- Tagging images with the commit SHA is what makes a running container traceable back to
  source.
- Running the tests inside the Dockerfile means a broken image cannot be built, not even
  outside CI.
