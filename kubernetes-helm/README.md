# Helm (Session 15)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework tasks

**Task 1** — hands-on practice with the Helm commands: `create`, `install`, `list`, `status`,
`get`, `upgrade`, `history`, `rollback`, `uninstall`, `repo`, `search`. For each one: run it,
understand it, capture the output, document it.

**Task 2** — a complete rollback workflow: install, upgrade, verify, upgrade again, verify,
rollback, verify.

**Task 3** — mini project.

The chart I made is in [notes-chart](notes-chart).

## What Helm is for

In the earlier Kubernetes homework every app meant writing a Deployment, a Service, a
ConfigMap and an Ingress by hand, and changing anything meant editing several files. Helm
packages all of that into a **chart**, with the values that change pulled out into one
`values.yaml`.

Three words that matter:

- **Chart** — the package of templates
- **Release** — one installation of a chart into a cluster, with a name
- **Values** — the settings that fill in the templates

The same chart can be installed many times with different values, which is how one chart
serves dev, staging and production.

```text
$ helm version --short
v4.3.0+gbec5b06
```

---

# Task 1: The commands

## helm create

```text
$ helm create notes-chart
Creating notes-chart

$ find notes-chart -type f
notes-chart/Chart.yaml
notes-chart/values.yaml
notes-chart/.helmignore
notes-chart/templates/_helpers.tpl
notes-chart/templates/deployment.yaml
notes-chart/templates/service.yaml
notes-chart/templates/ingress.yaml
notes-chart/templates/hpa.yaml
notes-chart/templates/httproute.yaml
notes-chart/templates/serviceaccount.yaml
notes-chart/templates/NOTES.txt
notes-chart/templates/tests/test-connection.yaml
```

What each part is:

| File | What it does |
|---|---|
| `Chart.yaml` | Name, version and description of the chart itself |
| `values.yaml` | The default settings. This is the file people actually edit |
| `templates/` | The Kubernetes YAML, with `{{ }}` placeholders filled in from values |
| `templates/_helpers.tpl` | Reusable snippets, mostly for naming and labels |
| `templates/NOTES.txt` | The message printed after install |
| `.helmignore` | Files to leave out when packaging, like `.gitignore` |

I changed three things in `values.yaml` so upgrades and rollbacks would be visible:

```yaml
replicaCount: 2
image:
  repository: nginx
  tag: "1.27-alpine"
```

## helm lint

Checks the chart before installing anything.

```text
$ helm lint notes-chart
==> Linting notes-chart
[INFO] Chart.yaml: icon is recommended

1 chart(s) linted, 0 chart(s) failed
```

## helm install

```text
$ helm install notes ./notes-chart
NAME: notes
LAST DEPLOYED: Wed Oct  7 00:34:53 2026
NAMESPACE: default
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
NOTES:
1. Get the application URL by running these commands:
  export POD_NAME=$(kubectl get pods --namespace default -l "app.kubernetes.io/name=notes-chart,app.kubernetes.io/instance=notes" -o jsonpath="{.items[0].metadata.name}")
  ...
```

`notes` is the release name and `./notes-chart` is the chart. **REVISION: 1** is the thing to
watch, because every change from here bumps it and that is what makes rollback possible.

One command created several objects:

```text
$ kubectl get deploy,svc,pods -l app.kubernetes.io/instance=notes
NAME                                READY   UP-TO-DATE   AVAILABLE   AGE
deployment.apps/notes-notes-chart   0/2     2            0           0s

NAME                        TYPE        CLUSTER-IP     EXTERNAL-IP   PORT(S)   AGE
service/notes-notes-chart   ClusterIP   10.96.43.141   <none>        80/TCP    0s

NAME                                    READY   STATUS              RESTARTS   AGE
pod/notes-notes-chart-5d896b89d-dph76   0/1     ContainerCreating   0          0s
pod/notes-notes-chart-5d896b89d-h5nn8   0/1     ContainerCreating   0          0s
```

## helm list

```text
$ helm list
NAME   NAMESPACE  REVISION  UPDATED                              STATUS    CHART              APP VERSION
notes  default    1         2026-10-07 00:34:53.479555 +0530 IST deployed  notes-chart-0.1.0  1.16.0
```

`helm list` only shows what Helm installed. Objects created with plain `kubectl apply` do not
appear, because Helm tracks its releases separately.

## helm status

```text
$ helm status notes
NAME: notes
LAST DEPLOYED: Wed Oct  7 00:34:53 2026
NAMESPACE: default
STATUS: deployed
REVISION: 1
DESCRIPTION: Install complete
```

## helm get

`helm get` has several sub-commands for inspecting a release.

```text
$ helm get values notes
USER-SUPPLIED VALUES:
null
```

`null` because I installed with the defaults and overrode nothing. After an upgrade with
`--set` this shows what I overrode, which is useful for working out why a release behaves
differently from the chart defaults.

```text
$ helm get manifest notes
---
# Source: notes-chart/templates/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: notes-notes-chart
  labels:
    helm.sh/chart: notes-chart-0.1.0
    app.kubernetes.io/name: notes-chart
    app.kubernetes.io/instance: notes
    app.kubernetes.io/version: "1.16.0"
    app.kubernetes.io/managed-by: Helm
automountServiceAccountToken: true
---
# Source: notes-chart/templates/service.yaml
apiVersion: v1
kind: Service
```

`helm get manifest` is the one I found most useful. It shows the final YAML after the
templates were filled in, which is how to check what a chart will really do before trusting
it.

| Sub-command | Shows |
|---|---|
| `helm get values` | The values that were supplied |
| `helm get manifest` | The final YAML sent to the cluster |
| `helm get notes` | The NOTES.txt message again |
| `helm get all` | Everything at once |

## helm repo and helm search

A repo is a collection of charts someone else published.

```text
$ helm repo add bitnami https://charts.bitnami.com/bitnami
"bitnami" has been added to your repositories

$ helm repo update
...Successfully got an update from the "bitnami" chart repository
Update Complete. ⎈Happy Helming!⎈

$ helm repo list
NAME     URL
bitnami  https://charts.bitnami.com/bitnami
```

```text
$ helm search repo bitnami/nginx
NAME                              CHART VERSION  APP VERSION  DESCRIPTION
bitnami/nginx                     25.2.1         1.31.6       NGINX Open Source is a web server that can be a...
bitnami/nginx-ingress-controller  12.0.7         1.13.1       NGINX Ingress Controller is an Ingress controll...
bitnami/nginx-intel               2.1.15         0.4.9        DEPRECATED NGINX Open Source for Intel is a lig...
```

`helm search repo` looks in repos I have added. `helm search hub` searches Artifact Hub, the
public index, without adding anything:

```text
$ helm search hub wordpress
URL                                              CHART VERSION  APP VERSION  DESCRIPTION
https://artifacthub.io/packages/helm/slybase-wo  5.5.39         7.0.1        Using the official WordPress image. This chart ...
https://artifacthub.io/packages/helm/quench-wor  0.0.24         7.1.2        Hardened WordPress CMS (PHP-FPM + nginx) on a 0...
```

Two version columns and they mean different things. **CHART VERSION** is the version of the
packaging, **APP VERSION** is the version of the software inside. They move independently, so
a chart fix bumps the chart version while the app stays the same.

---

# Task 2: The rollback workflow

Install, upgrade, verify, upgrade again, verify, rollback, verify.

## Install (revision 1)

```text
$ helm install notes ./notes-chart
REVISION: 1

$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.template.spec.containers[0].image}'
nginx:1.27-alpine
$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.replicas}'
2
```

Starting point: nginx 1.27, 2 replicas.

## Upgrade (revision 2)

```text
$ helm upgrade notes ./notes-chart --set image.tag=1.28-alpine
Release "notes" has been upgraded. Happy Helming!
NAME: notes
LAST DEPLOYED: Wed Oct  7 00:35:25 2026
NAMESPACE: default
STATUS: deployed
REVISION: 2
```

### Verify

```text
$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.template.spec.containers[0].image}'
nginx:1.28-alpine
```

The image changed and the revision went to 2.

## Upgrade again (revision 3)

```text
$ helm upgrade notes ./notes-chart --set image.tag=1.28-alpine --set replicaCount=3
Release "notes" has been upgraded. Happy Helming!
REVISION: 3
```

### Verify

```text
$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.replicas}'
3
$ kubectl get pods -l app.kubernetes.io/instance=notes --no-headers | wc -l
3
```

One thing I learned the annoying way: `--set` values are **not** remembered between upgrades.
I had to pass `--set image.tag=1.28-alpine` again in the second upgrade, because leaving it
out would have reset the image back to the chart default while changing the replica count.
`--reuse-values` keeps the previous overrides instead.

## helm history

```text
$ helm history notes
REVISION  UPDATED                  STATUS      CHART              APP VERSION  DESCRIPTION
1         Wed Oct  7 00:34:53 2026 superseded  notes-chart-0.1.0  1.16.0       Install complete
2         Wed Oct  7 00:35:25 2026 superseded  notes-chart-0.1.0  1.16.0       Upgrade complete
3         Wed Oct  7 00:35:50 2026 deployed    notes-chart-0.1.0  1.16.0       Upgrade complete
```

Only revision 3 is `deployed`, the older ones are `superseded` but **kept**. That is what
makes a rollback possible, the same way a Deployment keeps old ReplicaSets.

## Rollback to revision 1

```text
$ helm rollback notes 1
Rollback was a success! Happy Helming!
```

### Verify

```text
$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.template.spec.containers[0].image}'
nginx:1.27-alpine
$ kubectl get deploy notes-notes-chart -o jsonpath='{.spec.replicas}'
2
```

Both changes undone in one command. Image back to 1.27 and replicas back to 2, without me
typing either value.

```text
$ helm history notes
REVISION  UPDATED                  STATUS      CHART              APP VERSION  DESCRIPTION
1         Wed Oct  7 00:34:53 2026 superseded  notes-chart-0.1.0  1.16.0       Install complete
2         Wed Oct  7 00:35:25 2026 superseded  notes-chart-0.1.0  1.16.0       Upgrade complete
3         Wed Oct  7 00:35:50 2026 superseded  notes-chart-0.1.0  1.16.0       Upgrade complete
4         Wed Oct  7 00:36:24 2026 deployed    notes-chart-0.1.0  1.16.0       Rollback to 1
```

The detail worth noticing: the rollback did **not** delete revisions 2 and 3. It created a
new **revision 4** described as "Rollback to 1". So history only ever moves forward, even when
the state goes backwards. That means I could roll forward again to revision 3 if I wanted.

`helm rollback notes` with no number goes back one revision.

## helm uninstall

```text
$ helm uninstall notes
release "notes" uninstalled

$ helm list
NAME  NAMESPACE  REVISION  UPDATED  STATUS  CHART  APP VERSION

$ kubectl get deploy,svc -l app.kubernetes.io/instance=notes
No resources found in default namespace.
```

One command removed the Deployment, Service, ServiceAccount and Pods together. Doing that by
hand would have been several `kubectl delete` commands, and it is easy to miss one.

By default uninstall also throws away the history, so the release cannot be rolled back after
that. `--keep-history` leaves it so the release can be restored.

---

# Task 3: Mini project

The mini project is the `notes-chart` in this folder, taken through the whole lifecycle:

```bash
helm lint notes-chart                                    # check it
helm install notes ./notes-chart                         # revision 1
helm list                                                # confirm
helm upgrade notes ./notes-chart --set image.tag=1.28-alpine          # revision 2
helm upgrade notes ./notes-chart --set image.tag=1.28-alpine \
                                 --set replicaCount=3                 # revision 3
helm history notes                                       # see all three
helm rollback notes 1                                    # back to the start
helm history notes                                       # revision 4, "Rollback to 1"
helm uninstall notes                                     # clean up
```

The chart templates the Deployment, Service, ServiceAccount, Ingress and HPA, so changing the
image or the replica count is one flag instead of editing YAML.

---

## Helm compared with plain kubectl

| | `kubectl apply -f` | Helm |
|---|---|---|
| Install an app | One command per file | One command for the whole app |
| Change a setting | Edit the YAML by hand | `--set` or a different values file |
| Same app, two environments | Copy and edit the YAML | One chart, two values files |
| Undo a bad change | Edit back by hand, or `kubectl rollout undo` per object | `helm rollback` for everything at once |
| Remove the app | Delete each object | `helm uninstall` |
| History | Only per Deployment | `helm history` for the whole release |

## Things that caught me out

| Problem | Cause | Fix |
|---|---|---|
| Second upgrade reset the image tag | `--set` values are not carried over between upgrades | Pass them again, or use `--reuse-values` |
| `helm list` showed nothing after uninstall | That is correct, uninstall drops the history too | `--keep-history` if it needs to be rolled back later |
| Objects created with `kubectl` were not in `helm list` | Helm only tracks what it installed | Not a problem, just worth knowing |

## Main points

- A chart is the package, a release is one installation of it, and values are what make the
  same chart work in different environments.
- `helm get manifest` shows the real YAML after templating, which is how to check a chart
  before trusting it.
- `helm history` keeping superseded revisions is what makes `helm rollback` work, the same
  idea as a Deployment keeping old ReplicaSets.
- A rollback adds a new revision rather than deleting ones, so history always moves forward.
- `--set` is not sticky between upgrades, which is an easy way to undo your own change by
  accident.
