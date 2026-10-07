# Monitoring, Observability and GitOps (Session 20)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework tasks

**Task 1: Monitoring** — metrics, logs, alerts, CPU utilisation, memory utilisation,
application health.

**Task 2: Observability** — the three pillars, what each means, why observability is needed,
common tools, Kubernetes observability.

**Task 3: GitOps** — what GitOps is, git as the source of truth, declarative configuration,
continuous reconciliation, the workflow, Kubernetes and GitOps.

Everything runs on the same kind cluster from
[kubernetes-fundamentals](../kubernetes-fundamentals).

---

# Task 1: Monitoring

## The stack

I installed **kube-prometheus-stack** with Helm, which brings Prometheus, Grafana,
Alertmanager, node-exporter and kube-state-metrics in one chart. This also reuses what I
learned in [session 15](../kubernetes-helm).

```bash
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update
kubectl create namespace monitoring
helm upgrade --install monitoring prometheus-community/kube-prometheus-stack \
  --namespace monitoring \
  --set grafana.adminPassword=devops2028 \
  --set prometheus.prometheusSpec.retention=2h \
  --wait --timeout 10m
```

```text
$ helm list -n monitoring
NAME        NAMESPACE   REVISION  STATUS     CHART                        APP VERSION
monitoring  monitoring  1         deployed   kube-prometheus-stack-92.0.0 v0.94.1

$ kubectl get pods -n monitoring
  alertmanager-monitoring-kube-prometheus-alertmanager-0  Running
  monitoring-grafana-6557df846c-ks6qb                     Running
  monitoring-kube-prometheus-operator-54fc4b65f8-2ljft     Running
  monitoring-kube-state-metrics-78fd56fc4b-nk77t          Running
  monitoring-prometheus-node-exporter-qf6hp               Running
  monitoring-prometheus-node-exporter-qnp2m               Running
  prometheus-monitoring-kube-prometheus-prometheus-0      Running
```

What each piece does:

| Component | Job |
|---|---|
| **Prometheus** | Scrapes metrics on a timer and stores them as time series |
| **node-exporter** | Exposes node level metrics, CPU, memory, disk. One per node, a DaemonSet |
| **kube-state-metrics** | Exposes Kubernetes object state, how many Pods are ready, deployment replicas |
| **Alertmanager** | Receives alerts from Prometheus and routes them to email, Slack and so on |
| **Grafana** | Draws the graphs |

There are two node-exporter Pods because it is a DaemonSet, which is the pattern from
[session 10](../kubernetes-pods-replicasets-deployments).

## Metrics

Prometheus **pulls**. It asks each target for its metrics on an interval, rather than
applications pushing to it.

```text
$ curl -s $PROM/api/v1/targets?state=active
  active targets: 23
```

23 things being scraped without me configuring any of them, because the operator discovers
them from ServiceMonitor objects.

### CPU utilisation

```text
$ query: sum(rate(node_cpu_seconds_total{mode!="idle"}[5m])) by (instance)
  172.26.0.3:9100        1.141 cores
  172.26.0.2:9100        1.133 cores
```

`node_cpu_seconds_total` is a counter that only ever goes up, so the raw value is useless on
its own. `rate(...[5m])` turns it into "per second over the last 5 minutes", and excluding
`mode="idle"` leaves the CPU actually being used.

### Memory utilisation

```text
$ query: (node_memory_MemTotal_bytes - node_memory_MemAvailable_bytes)/1024/1024
  172.26.0.3:9100        5070 MiB
  172.26.0.2:9100        5075 MiB
```

Using `MemAvailable` rather than `MemFree` on purpose, which is the same point as the `free -h`
output in [the Linux homework](../linux-fundamentals): Linux uses spare memory for cache and
gives it back on demand, so `MemFree` looks alarmingly low on a healthy machine.

### Application health

```text
$ query: sum(kube_pod_status_ready{condition="true"}) by (namespace)
  argocd                 7 ready
  default                14 ready
  gitops-demo            2 ready
  ingress-nginx          1 ready
  kube-system            11 ready
  monitoring             7 ready
```

## Alerts

Alerts are queries that fire when they stay true for a period. My own rules are in
[monitoring/alert-rules.yaml](monitoring/alert-rules.yaml):

```yaml
        - alert: PodRestartingTooOften
          expr: increase(kube_pod_container_status_restarts_total[10m]) > 3
          for: 2m
          labels:
            severity: warning
          annotations:
            summary: "Pod {{ $labels.pod }} keeps restarting"
```

That one would catch the `CrashLoopBackOff` situation I created in
[session 14](../kubernetes-troubleshooting).

`for: 2m` is the important field. Without it a brief spike pages someone at 3am. The condition
has to hold for two minutes before the alert actually fires, which is the difference between a
useful alert and one people learn to ignore.

Confirmed loaded into Prometheus:

```text
$ curl -s $PROM/api/v1/rules
  group: devops-2028.rules
    PodRestartingTooOften      state=unknown
    PodNotReady                state=unknown
    ContainerHighCpu           state=unknown
    ContainerHighMemory        state=unknown
```

I did not have to tell Prometheus about the file. The operator watches for `PrometheusRule`
objects with `release: monitoring` on them and loads them automatically.

### Alerts actually firing

```text
$ curl -s $PROM/api/v1/alerts
  24 alert(s) active
    etcdMembersDown          severity=warning   state=pending
    etcdInsufficientMembers  severity=critical  state=firing
    TargetDown               severity=warning   state=pending
```

These are from the chart's built in rules, and they are **correct** for my cluster rather than
a problem to fix. kind runs a single etcd member, so a rule expecting a three member quorum
fires. `TargetDown` is for control plane components kind does not expose the usual way.

That is a real lesson: default alert rules assume a production shaped cluster, and on anything
smaller they produce noise that has to be tuned, or people stop reading alerts entirely.

`pending` means the condition is true but `for:` has not elapsed. `firing` means it has.

## Grafana

```text
$ curl -s -u admin:*** $GRAFANA/api/health
{
  "database": "ok",
  "version": "13.2.3"
}

$ curl -s -u admin:*** $GRAFANA/api/datasources
  Alertmanager   type=alertmanager url=http://monitoring-kube-prometheus-alertmanager.monitoring:9093/
  Prometheus     type=prometheus   url=http://monitoring-kube-prometheus-prometheus.monitoring:9090/

$ curl -s -u admin:*** $GRAFANA/api/search?type=dash-db
  29 dashboards installed, for example:
    Kubernetes / API server
    Kubernetes / Compute Resources / Cluster
    Kubernetes / Compute Resources / Namespace (Pods)
    CoreDNS
    etcd
```

29 dashboards and the datasource already wired to Prometheus, none of which I configured. That
is the argument for using the chart instead of installing the pieces separately.

To open it:

```bash
kubectl port-forward -n monitoring svc/monitoring-grafana 3000:80
# then http://localhost:3000, user admin
```

## Logs

Prometheus does **not** do logs. It stores numbers. Logs need a separate system.

What I have been using all along:

```bash
kubectl logs <pod>              # logs of a running container
kubectl logs <pod> --previous   # the container before it crashed
kubectl logs -f <pod>           # follow
kubectl logs -l app=myapp       # all pods with a label
```

That stops working once Pods are short lived, because the logs go with the Pod. The usual
answer is a collector on every node shipping to a central store, which is **Loki** with
Promtail, or Elasticsearch with Fluent Bit. The collector is a DaemonSet for the same reason
node-exporter is.

---

# Task 2: Observability

## Monitoring against observability

**Monitoring** tells me whether things I already thought of are healthy. CPU above 90%, pod not
ready, disk filling up. It answers **known** questions.

**Observability** is being able to ask questions I did not prepare for. "Why are checkouts
slow for users in one region since Tuesday" is not a dashboard anyone built in advance.

Monitoring tells me **that** something is wrong. Observability is what lets me work out
**why**.

## The three pillars

### Metrics

Numbers over time. Cheap to store, fast to query, good for dashboards and alerts.

Weakness: they are aggregates. "95th percentile latency is 2 seconds" does not say which
request or which user.

Tools: Prometheus, Grafana, Datadog, CloudWatch.

### Logs

Individual events with detail. Good for understanding one specific thing that happened.

Weakness: volume and cost, and they are hard to aggregate. Finding one request in millions of
lines without the right identifier is painful.

Tools: Loki, Elasticsearch, Splunk, CloudWatch Logs.

### Traces

The path of **one request** through every service it touched, with timing for each hop.

This is the one that is missing from most setups and the one that answers "where did the time
go". In a system with six services, metrics say the system is slow and traces say which
service and which call.

Tools: Jaeger, Tempo, Zipkin, OpenTelemetry.

### How they fit together

The three are most useful when linked. An alert fires on a **metric**, the dashboard links to
**traces** for slow requests in that window, and a trace links to the **logs** for that exact
request. Without the links you are left grepping by timestamp.

| | Metrics | Logs | Traces |
|---|---|---|---|
| Shape | Numbers over time | Text events | Request path with timing |
| Answers | Is it healthy | What happened in this event | Where did the time go |
| Cost | Low | High | Medium |
| Cardinality | Must stay low | Unlimited | Per request |

**Cardinality** is the trap with metrics. Adding a label like `user_id` to a metric creates a
separate time series per user, and that is how a Prometheus runs out of memory. High cardinality
detail belongs in logs and traces, not metric labels.

## Why observability is needed

A single application on one server could be debugged by reading a log file. Once a request
crosses a dozen services, the failure is often in the interaction rather than inside any one
service, and no single log file contains the whole story.

Containers make it harder again: Pods come and go, so the thing that failed may not exist by
the time anyone looks. That is exactly why logs have to be shipped somewhere central rather
than left in the container, which is the `kubectl rm` lesson from
[docker-fundamentals](../docker-fundamentals) showing up again.

## Observability in Kubernetes

| Layer | What to watch |
|---|---|
| Cluster | Node CPU, memory, disk, node ready status |
| Kubernetes objects | Pod restarts, pending Pods, deployment replicas, PVC capacity |
| Application | Request rate, error rate, latency |
| Network | Service endpoints, DNS failures, ingress error rates |

The common framing is the **four golden signals**: latency, traffic, errors, saturation.

**OpenTelemetry** is the piece worth knowing. It is a vendor neutral standard for producing
metrics, logs and traces, so instrumenting an app once lets the backend be swapped without
touching application code.

---

# Task 3: GitOps

## What GitOps is

GitOps means **git is the source of truth for the cluster**. The desired state lives in a
repository, and software running in the cluster continuously makes reality match it.

The difference from normal CI/CD:

| | Push based CI/CD | GitOps, pull based |
|---|---|---|
| Who deploys | The pipeline runs `kubectl apply` | An agent in the cluster pulls from git |
| Credentials | The pipeline needs cluster admin credentials | The cluster needs read access to git |
| Drift | Nobody notices a manual change | Detected and corrected |
| Rollback | Re-run an older pipeline | `git revert` |
| Audit | Pipeline logs | The git history |

The credential point is the strongest argument. In [session 16](../cicd-github-actions) the
pipeline would need credentials to my cluster, so GitHub holds keys to production. With
GitOps nothing outside needs cluster access, because the agent inside pulls.

## Declarative configuration

GitOps only works because Kubernetes is declarative. The repo holds the **desired** state and
the agent reconciles towards it. It would not work for imperative commands, because there is
no end state to compare against.

## What I set up

I installed **Argo CD** and pointed it at this repository.

```bash
kubectl create namespace argocd
kubectl apply -n argocd --server-side -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
```

`--server-side` was needed. The normal apply fails because one Argo CD CRD is larger than the
annotation size limit:

```text
The CustomResourceDefinition "applicationsets.argoproj.io" is invalid:
metadata.annotations: Too long: may not be more than 262144 bytes
```

```text
$ kubectl get pods -n argocd
  argocd-application-controller-0                  Running
  argocd-applicationset-controller-76fd8cdd4f      Running
  argocd-dex-server-66c78cf887                     Running
  argocd-notifications-controller-7fb9868fd6       Running
  argocd-redis-bdbdffcb4                           Running
  argocd-repo-server-d89c7967d                     Running
  argocd-server-776b7cdd4d                         Running
```

## The Application

[gitops/application.yaml](gitops/application.yaml) is the whole GitOps configuration:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: gitops-demo
  namespace: argocd
spec:
  source:
    repoURL: https://github.com/tek-wizard/Devops-2028.git
    targetRevision: main
    path: monitoring-observability-gitops/gitops/app
  destination:
    server: https://kubernetes.default.svc
    namespace: gitops-demo
  syncPolicy:
    automated:
      selfHeal: true   # put back anything changed by hand in the cluster
      prune: true      # delete things removed from git
    syncOptions:
      - CreateNamespace=true
```

The manifests it watches are in [gitops/app](gitops/app): a Deployment with 2 replicas and a
Service. Ordinary Kubernetes YAML, nothing Argo CD specific.

## It working

I applied **only** the Application. I never ran `kubectl apply` on the Deployment or the
Service.

```text
$ kubectl apply -f gitops/application.yaml
application.argoproj.io/gitops-demo created

$ kubectl get application gitops-demo -n argocd
NAME          SYNC     HEALTH    REPO                                            PATH
gitops-demo   Synced   Healthy   https://github.com/tek-wizard/Devops-2028.git   monitoring-observability-gitops/gitops/app

$ kubectl get application gitops-demo -n argocd -o jsonpath='{.status.sync.revision}'
5573613840ce03eab41bf8906d266e84b8b8e0ae

$ kubectl get deploy,svc -n gitops-demo
NAME                          READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/gitops-demo   2/2     2            2           5m50s

NAME                  TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/gitops-demo   ClusterIP   10.96.92.123   <none>        80/TCP    5m50s
```

A Deployment, a Service and a namespace exist because of what is in git, nothing else. The
namespace was created by `CreateNamespace=true`.

`Synced` means the cluster matches git. `Healthy` means the objects themselves are fine. They
are separate on purpose: a Deployment can be synced with git and still be unhealthy because
its image is broken, which is exactly the `ImagePullBackOff` case from session 14.

The `revision` field is the **git commit SHA**. So the cluster state is traceable to an exact
commit, the same traceability idea as tagging images with the SHA in session 16.

## Continuous reconciliation

The loop runs every three minutes by default:

```
read desired state from git
        |
        v
compare with the live cluster
        |
   different? ---- no ---> wait and repeat
        |
       yes
        |
        v
apply git's version
```

Two settings control what it does about differences:

- **`selfHeal: true`** — if something is changed in the cluster by hand, Argo CD puts it back.
  Scaling the Deployment with `kubectl scale` would be reverted to the 2 replicas git says,
  because git is the source of truth and a manual change is drift.
- **`prune: true`** — if a resource is deleted from git, Argo CD deletes it from the cluster.
  Without this, removing a file leaves the object running forever.

Both are visible in the live object:

```text
$ kubectl get application gitops-demo -n argocd -o jsonpath='{.spec.syncPolicy}'
{"automated":{"prune":true,"selfHeal":true},"syncOptions":["CreateNamespace=true"]}
```

This is the same control loop idea as a ReplicaSet keeping a Pod count or an HPA holding a CPU
target, moved up a level: the thing being kept correct is now the entire application
definition, and the desired state lives in git instead of in the cluster.

## The GitOps workflow

```
developer changes a manifest
        |
        v
pull request, reviewed like code
        |
        v
merged to main
        |
        v
Argo CD notices within ~3 minutes (or instantly with a webhook)
        |
        v
applies it to the cluster
        |
        v
reports Synced / Healthy
```

Nobody runs `kubectl apply` against production. A change means a pull request, and a rollback
means `git revert`, which goes through the same review.

## Opening the Argo CD UI

```bash
kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath="{.data.password}" | base64 -d
kubectl port-forward svc/argocd-server -n argocd 8080:443
# then https://localhost:8080, user admin
```

---

## Problems I hit

| Problem | Cause | Fix |
|---|---|---|
| Argo CD install failed on a CRD | One CRD's annotations exceed the 262144 byte limit for client side apply | `kubectl apply --server-side` |
| 24 alerts firing on a healthy cluster | The chart's default rules assume a multi node production cluster; kind has one etcd member | Expected for kind. On a real cluster these would be tuned rather than ignored |
| Grafana password | Set with `--set grafana.adminPassword` at install time | Fine for a demo, a real install would use an existing Secret |

## What I took away

- Prometheus pulls metrics rather than receiving them, and counters like
  `node_cpu_seconds_total` only mean something wrapped in `rate()`.
- `for:` on an alert is what separates a useful alert from noise.
- Default alert rules fire constantly on a small cluster, which is how teams end up ignoring
  alerts. Tuning them is part of setting up monitoring, not an afterthought.
- Metrics, logs and traces answer different questions, and high cardinality detail belongs in
  logs and traces rather than metric labels.
- GitOps inverts the deployment direction. Nothing outside needs cluster credentials, because
  the agent inside pulls from git, and the cluster's state is traceable to a commit SHA.
