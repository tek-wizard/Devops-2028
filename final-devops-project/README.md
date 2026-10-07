# Final DevOps Project (Session 21)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Project overview

**Taskboard** is a small task list application used to tie together everything from the
course: an application in git, built and tested by a pipeline, scanned for security problems,
packaged as a container, deployed to Kubernetes with config, secrets, storage, probes,
autoscaling and an ingress, packaged again as a Helm chart, with its cloud infrastructure in
Terraform, monitored by Prometheus, and kept in sync by Argo CD.

It is deliberately small. The point is the pipeline around it, not the app.

## Architecture

```
  developer
      |
      v
  git / GitHub ──────────────────────────────┐
      |                                       │ Argo CD watches this repo
      v                                       │
  GitHub Actions                              │
      |                                       │
      ├── npm test                            │
      ├── SAST / SCA / secret scan            │
      ├── docker build                        │
      ├── image scan  ── security gate        │
      └── push ──> ghcr.io                    │
                                              v
  ┌────────────────── Kubernetes (kind) ──────────────────┐
  │                                                        │
  │   Ingress  /taskboard ──> Service ──> Deployment       │
  │                                        (2-8 pods, HPA) │
  │                                          |             │
  │                            ConfigMap ────┤             │
  │                            Secret ───────┤             │
  │                            PVC ──────────┘             │
  │                                                        │
  │   Prometheus ── scrapes /metrics ──> Grafana           │
  │   Argo CD ──── reconciles from git                     │
  └────────────────────────────────────────────────────────┘

  Terraform ──> S3 artifacts bucket + DynamoDB lock table
                (LocalStack, so nothing real is billed)
```

## Technologies used

| Layer | Tool |
|---|---|
| Application | Node.js 22, Express |
| Tests | Node's built in test runner |
| Container | Docker, multi-stage, non root |
| Registry | GitHub Container Registry |
| Orchestration | Kubernetes, via kind |
| Packaging | Helm |
| Infrastructure | Terraform, against LocalStack |
| CI/CD | GitHub Actions |
| Security | Semgrep, npm audit, Gitleaks, Trivy |
| Monitoring | Prometheus, Grafana, Alertmanager |
| GitOps | Argo CD |

## Folder layout

```
final-devops-project/
├── application/      the Node.js app and its tests
├── docker/           Dockerfile
├── kubernetes/       raw manifests
├── helm/             the same app as a Helm chart
├── terraform/        S3 bucket and DynamoDB lock table
├── security/         Gitleaks and Trivy configuration
├── monitoring/       ServiceMonitor and alert rules
├── gitops/           Argo CD Application
├── troubleshooting/  the final troubleshooting challenge
└── README.md
```

---

# Application setup

[application/](application) holds the logic in `tasks.js`, separated from `server.js` so it can
be tested without starting a listener.

```javascript
function createTask(title) {
  const clean = sanitise(title);
  if (clean === "") {
    throw new Error("a task needs a title");
  }
  return { title: clean, done: false, created: new Date().toISOString() };
}
```

Six tests:

```text
$ npm test
ℹ tests 6
ℹ pass 6
ℹ fail 0
```

The app exposes four endpoints that matter to the rest of the stack:

| Endpoint | Used by |
|---|---|
| `/` | The web page |
| `/health` | The liveness probe, is the process alive |
| `/ready` | The readiness probe, can it write to storage |
| `/metrics` | Prometheus |

`/health` and `/ready` check different things on purpose. `/health` returns ok if the process
is up. `/ready` actually tries to write to the data directory, so a Pod with broken storage is
taken out of the Service instead of being restarted forever.

---

# Docker setup

[docker/Dockerfile](docker/Dockerfile), multi-stage with the tests inside the build and the
hardening from [session 17](../cicd-devsecops):

```dockerfile
FROM node:22-alpine AS build
WORKDIR /app
COPY application/package.json ./
RUN npm install --omit=dev
COPY application/ ./
RUN npm test

FROM node:22-alpine AS production
WORKDIR /app
RUN apk upgrade --no-cache
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx
RUN addgroup -S app && adduser -S app -G app
RUN mkdir -p /data && chown -R app:app /data
VOLUME /data
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/tasks.js /app/server.js ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "server.js"]
```

```text
$ docker run -d --name taskboard -p 8091:3000 taskboard:1.0

$ curl http://localhost:8091/ready
{"status":"ready","storage":"/data"}

$ curl -X POST http://localhost:8091/tasks/write%20the%20readme
{"created":true,"open":1}

$ curl -X POST http://localhost:8091/tasks/0/done
{"done":true,"open":1}

$ curl http://localhost:8091
1 open of 2 total
<li>[done] write the readme</li><li>[open] deploy to kubernetes</li>
```

**A bug I hit here.** The first build ran as the non root `app` user but `/data` did not exist
and was owned by root, so the first write failed silently and tasks never persisted. The
readiness probe is what would have caught it in Kubernetes. The fix is the
`mkdir -p /data && chown -R app:app /data` line. Running as non root is correct, but it means
every directory the app writes to has to actually be owned by that user.

---

# Kubernetes deployment

[kubernetes/](kubernetes) has every object the homework asked for:

| File | Object | Why |
|---|---|---|
| `01-namespace.yaml` | Namespace | Keeps the project separate |
| `02-configmap.yaml` | ConfigMap | App name, environment, data path |
| `03-secret.yaml` | Secret | API key |
| `04-pvc.yaml` | PersistentVolumeClaim | Tasks survive Pod replacement |
| `05-deployment.yaml` | Deployment | 2 replicas, all three probes, resource limits, security context |
| `06-service.yaml` | Service | Stable address in front of the Pods |
| `07-ingress.yaml` | Ingress | Reachable from outside on `/taskboard` |
| `08-hpa.yaml` | HorizontalPodAutoscaler | 2 to 8 Pods on CPU |

```text
$ kubectl apply -f kubernetes/
namespace/taskboard created
configmap/taskboard-config created
secret/taskboard-secret created
persistentvolumeclaim/taskboard-data created
deployment.apps/taskboard created
service/taskboard created
ingress.networking.k8s.io/taskboard created
horizontalpodautoscaler.autoscaling/taskboard created

deployment "taskboard" successfully rolled out
```

```text
$ kubectl get all,pvc,ingress -n taskboard
pod/taskboard-5c94dc8c6-7flj5     1/1   Running
pod/taskboard-5c94dc8c6-nz6s8     1/1   Running
service/taskboard                 ClusterIP   10.96.241.63   80/TCP
deployment.apps/taskboard         2/2     2            2
horizontalpodautoscaler/taskboard Deployment/taskboard   2   8   2
persistentvolumeclaim/taskboard-data   Bound   pvc-384ff07b...   100Mi   RWO   standard
ingress.networking.k8s.io/taskboard    nginx   *   localhost   80
```

## Config and secrets reaching the container

```text
$ kubectl exec -n taskboard deploy/taskboard -- printenv APP_NAME APP_ENV DATA_DIR API_KEY
Taskboard
production
/data
placeholder-not-a-real-key
```

## Working through the ingress

```text
$ curl http://localhost:8088/taskboard
<h1>Taskboard</h1>
Environment: production

$ curl -X POST http://localhost:8088/taskboard/tasks/finish%20the%20homework
{"created":true,"open":1}

$ curl -X POST http://localhost:8088/taskboard/tasks/0/done
{"done":true,"open":1}

$ curl http://localhost:8088/taskboard
1 open of 2 total
<li>[done] finish the homework</li><li>[open] submit the form</li>
```

**A problem I hit.** The first version of the ingress matched `/taskboard` and sent the request
on unchanged, so the app received `/taskboard/tasks/...` and returned 404 for everything. The
app serves at `/`. The fix is a rewrite with a capture group:

```yaml
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /$2
    nginx.ingress.kubernetes.io/use-regex: "true"
spec:
  rules:
    - http:
        paths:
          - path: /taskboard(/|$)(.*)
            pathType: ImplementationSpecific
```

Everything after the prefix lands in `$2`, and that is what reaches the app.

## Storage really persists

```text
$ kubectl delete pod -n taskboard -l app=taskboard
pod "taskboard-5c94dc8c6-7flj5" deleted
pod "taskboard-5c94dc8c6-nz6s8" deleted

$ kubectl get pods -n taskboard
  taskboard-5c94dc8c6-8w8t7   1/1   age=39s
  taskboard-5c94dc8c6-hwlfx   1/1   age=39s

$ curl http://localhost:8088/taskboard
1 open of 2 total
<li>[done] finish the homework</li><li>[open] submit the form</li>
```

Both Pods replaced, data intact, because it lives on the PVC rather than in the container.

`fsGroup: 1000` in the pod security context is what makes this work with a non root user. The
volume is mounted owned by root by default, and `fsGroup` makes it group writable by the app
user. Without it the readiness probe fails and the Pod never becomes ready.

## Probes and metrics

```text
$ curl http://localhost:8088/taskboard/health
{"status":"ok"}

$ curl http://localhost:8088/taskboard/ready
{"status":"ready","storage":"/data"}

$ curl http://localhost:8088/taskboard/metrics
taskboard_tasks_total 2
taskboard_tasks_open 1
```

---

# Helm deployment

[helm/taskboard](helm/taskboard) is the same application as a chart, so the environment is a
values change rather than edited YAML.

```text
$ helm lint helm/taskboard
1 chart(s) linted, 0 chart(s) failed

$ helm upgrade --install taskboard ./helm/taskboard \
    --namespace taskboard-helm --create-namespace \
    --set config.appEnv=helm-release \
    --set ingress.path=/taskboard-helm --wait

NAME: taskboard
STATUS: deployed
REVISION: 1
```

```text
$ helm list -n taskboard-helm
NAME       NAMESPACE       REVISION  STATUS    CHART            APP VERSION
taskboard  taskboard-helm  1         deployed  taskboard-0.1.0  1.0

$ kubectl get deploy,svc,pvc,hpa,ingress -n taskboard-helm
  deployment.apps/taskboard
  service/taskboard
  persistentvolumeclaim/taskboard-data
  horizontalpodautoscaler.autoscaling/taskboard
  ingress.networking.k8s.io/taskboard
```

The override reached the running container:

```text
$ kubectl exec -n taskboard-helm deploy/taskboard -- printenv APP_ENV
helm-release
```

Both deployments run side by side, same image, different configuration:

```text
  /taskboard       -> Environment: production
  /taskboard-helm  -> Environment: helm-release
```

That is the argument for Helm in one line. One chart, two environments, no duplicated YAML.

**Two problems I hit.** The first install failed because the ingress used the same host and
path as the raw manifest deployment:

```text
Error: admission webhook "validate.nginx.ingress.kubernetes.io" denied the request:
host "_" and path "/taskboard(/|$)(.*)" is already defined in ingress taskboard/taskboard
```

Fixed by putting the Helm release on `/taskboard-helm`. The second was a race: I uninstalled
and reinstalled too quickly, and the new Pods could not schedule because the old PVC was still
being deleted:

```text
0/2 nodes are available: persistentvolumeclaim "taskboard-data" is being deleted
```

Fixed by waiting for the namespace to actually be empty before reinstalling.

---

# Terraform infrastructure

[terraform/](terraform) creates the supporting cloud resources: a bucket for build artifacts
and the DynamoDB table Terraform itself uses for state locking.

```text
$ terraform validate
Success! The configuration is valid.

$ terraform apply -auto-approve
aws_dynamodb_table.tf_locks: Creating...
aws_s3_bucket.artifacts: Creating...
aws_s3_bucket.artifacts: Creation complete after 6s [id=taskboard-artifacts-prateek]
aws_s3_bucket_public_access_block.artifacts: Creation complete after 0s
aws_dynamodb_table.tf_locks: Creation complete after 6s [id=taskboard-terraform-locks]
aws_s3_bucket_versioning.artifacts: Creation complete after 1s

Apply complete! Resources: 4 added, 0 changed, 0 destroyed.

$ terraform output
artifacts_bucket = "taskboard-artifacts-prateek"
lock_table = "taskboard-terraform-locks"
```

The provider points at **LocalStack**, so nothing is created in a real AWS account and nothing
is billed. Pointing it at real AWS means deleting the `endpoints` block and the `skip_` lines.

The lock table is the piece worth explaining: with a shared S3 backend, that table stops two
people running `apply` at the same time and corrupting the state.

---

# CI/CD pipeline

The pipelines built in [session 16](../cicd-github-actions) and
[session 17](../cicd-devsecops) are the ones that apply here, and both really run on this
repository.

```
push to main
     |
     v
[ build-and-test ]  npm install, npm test, upload artifact
     |
     +------------------+------------------+
     v                  v                  v
  [ SAST ]           [ SCA ]        [ secret scan ]
  Semgrep        npm audit, Trivy      Gitleaks
     |                  |                  |
     +------------------+------------------+
                        |
                        v  needs: all of the above
              [ docker build (not pushed) ]
                        |
                        v
                 [ image scan, Trivy ]
                        |
                        v
                 [ SECURITY GATE ]
                        |
                        v
                 [ push to ghcr.io ]
                        |
                        v
              [ validate manifests ]
```

```text
✓ main CI/CD Pipeline · 37604195184
  ✓ Build and test in 18s
  ✓ Build the image and push it in 36s

Pushed these tags:
ghcr.io/tek-wizard/devops-2028/cicd-demo:latest
ghcr.io/tek-wizard/devops-2028/cicd-demo:253b3f3
```

Images are tagged with the commit SHA, so any running container traces back to an exact
commit.

---

# DevSecOps implementation

All five checks, configured in [security/](security):

| Check | Tool | Looks at |
|---|---|---|
| SAST | Semgrep | My source |
| SCA | npm audit, Trivy | My dependencies |
| Secret scanning | Gitleaks | The git history |
| Image scanning | Trivy | OS and library packages in the image |
| Security gate | `needs:` plus `exit-code: 1` | Blocks the push |

**The gate really worked.** In session 17 Trivy failed the build on three HIGH CVEs and the
push steps never ran:

```text
X Scan the image with Trivy
- Security gate passed          <- never ran
- Log in to the registry        <- never ran
- Push the scanned image        <- never ran
```

The vulnerable packages shipped inside npm, which the running app never uses, so the fix was
to remove npm from the runtime image rather than to lower the threshold. The same two
hardening lines are in this project's Dockerfile.

The Kubernetes side is hardened too:

```yaml
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
        - securityContext:
            allowPrivilegeEscalation: false
            capabilities:
              drop: ["ALL"]
```

---

# Monitoring

[monitoring/](monitoring) wires the app into the Prometheus stack from
[session 20](../monitoring-observability-gitops).

`servicemonitor.yaml` tells Prometheus to scrape the app's own `/metrics`, with no Prometheus
config file edited:

```yaml
spec:
  namespaceSelector:
    matchNames: [taskboard]
  selector:
    matchLabels:
      app: taskboard
  endpoints:
    - port: http
      path: /metrics
```

It is really collecting application metrics, not just infrastructure ones:

```text
$ query: taskboard_tasks_total
  taskboard_tasks_total = 2  (pod taskboard-5c94dc8c6-hwlfx)
  taskboard_tasks_total = 2  (pod taskboard-5c94dc8c6-8w8t7)

$ query: taskboard_tasks_open
  taskboard_tasks_open  = 1  (pod taskboard-5c94dc8c6-hwlfx)
  taskboard_tasks_open  = 1  (pod taskboard-5c94dc8c6-8w8t7)
```

`alerts.yaml` adds four alerts: the app not reporting metrics at all, Pods restarting
repeatedly, no available replicas, and CPU near the limit. Each has a `for:` so a brief blip
does not page anyone.

---

# GitOps

[gitops/application.yaml](gitops/application.yaml) hands the `taskboard` namespace to Argo CD.

```yaml
  source:
    repoURL: https://github.com/tek-wizard/Devops-2028.git
    targetRevision: main
    path: final-devops-project/kubernetes
  syncPolicy:
    automated:
      selfHeal: true
      prune: true
```

```text
$ kubectl get application -n argocd
NAME          SYNC     HEALTH
gitops-demo   Synced   Healthy
taskboard     Synced   Healthy
```

From here, deploying a change means merging a pull request. Nobody runs `kubectl apply`
against the namespace, and a rollback is `git revert`.

---

# Final troubleshooting challenge

Four faults introduced on purpose and worked through end to end, written up in
**[troubleshooting/README.md](troubleshooting/README.md)**:

| Fault | Symptom | Root cause |
|---|---|---|
| 1 | `ImagePullBackOff` | Image tag does not exist |
| 2 | `CreateContainerConfigError` | ConfigMap key missing |
| 3 | **`Running`**, but refused connections | Service `targetPort` does not match the container port |
| 4 | `Pending` | Requests more memory and CPU than any node has |

The third is the one worth reading. It reports `Running` and `1/1` with no restarts and no
events, and is completely unreachable.

---

# Running the whole thing

```bash
# cluster
kind create cluster --config ../kubernetes-fundamentals/kind-cluster.yaml

# image
docker build -f docker/Dockerfile -t taskboard:1.0 .
kind load docker-image taskboard:1.0 --name devops-2028

# kubernetes
kubectl apply -f kubernetes/
curl http://localhost:8088/taskboard

# helm
helm upgrade --install taskboard ./helm/taskboard \
  -n taskboard-helm --create-namespace \
  --set ingress.path=/taskboard-helm --wait

# terraform
cd terraform && terraform init && terraform apply -auto-approve && cd ..

# monitoring and gitops
kubectl apply -f monitoring/
kubectl apply -f gitops/application.yaml

# the troubleshooting challenge
kubectl apply -f troubleshooting/broken/
```

# What the project pulled together

- Config and secrets stay out of the image, so one image runs in any environment.
- Storage has to outlive the Pod, and with a non root user the ownership has to be right in
  both the Dockerfile and the pod `fsGroup`.
- Liveness and readiness answer different questions. Readiness checking real storage access is
  what makes a broken Pod leave the Service instead of restarting forever.
- The security gate is only real if it can stop a release, and ours did.
- Argo CD with `selfHeal` means the cluster cannot drift, which is excellent in production and
  the reason the troubleshooting challenge needed its own unmanaged namespace.
