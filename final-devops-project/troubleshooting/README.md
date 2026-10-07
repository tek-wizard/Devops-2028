# Final Troubleshooting Challenge

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

Four faults introduced on purpose, each one identified, investigated, root caused, fixed and
verified.

The broken copies run in their own namespace, `taskboard-broken`, rather than in `taskboard`.
That is deliberate: the real namespace is managed by Argo CD with `selfHeal: true`, so Argo
would have reverted every fault within three minutes and there would have been nothing to
troubleshoot. Worth knowing as a side effect of GitOps.

Broken manifests are in [broken/](broken).

## All four at once

```text
$ kubectl get pods -n taskboard-broken
  tb-fault1-56d5ff7996-kvvmz     ImagePullBackOff
  tb-fault2-9b689fcc7-zpws5      CreateContainerConfigError
  tb-fault3-6946ddb687-dpgrv     Running              <- looks fine, is not
  tb-fault4-678bfc8dcf-dcrfq     Pending
```

Three of the four announce themselves in the status column. The third does not, which is why
it is the interesting one.

---

## Fault 1: ImagePullBackOff

**Identify** — status is `ImagePullBackOff`.

**Investigate**

```text
$ kubectl describe pod -n taskboard-broken -l app=tb-fault1
  Warning  Failed  12s (x3 over 57s)  kubelet  Failed to pull image "taskboard:9.9-does-not-exist":
           failed to resolve reference "docker.io/library/taskboard:9.9-does-not-exist":
           pull access denied, repository does not exist or may require authorization
  Warning  Failed  12s (x3 over 57s)  kubelet  Error: ErrImagePull
  Warning  Failed  28s (x2 over 56s)  kubelet  Error: ImagePullBackOff
```

**Root cause** — the deployment asks for tag `9.9-does-not-exist`. The real tag is `1.0`.

Worth noting the wording: *"repository does not exist or may require authorization"*. Because
`taskboard` is a local image not on Docker Hub, the registry answers with an auth error rather
than a plain not-found. A missing tag and a private registry can look identical here, which is
a real source of confusion.

**Fix**

```bash
kubectl set image deployment/tb-fault1 -n taskboard-broken taskboard=taskboard:1.0
```

**Verify**

```text
tb-fault1-6cf6cbc9dc-vf6wt     Running    restarts=0
```

---

## Fault 2: CreateContainerConfigError

**Identify** — status is `CreateContainerConfigError`. The image pulled fine; the container
could not be built from the spec.

**Investigate**

```text
$ kubectl describe pod -n taskboard-broken -l app=tb-fault2
  Warning  Failed  13s (x6 over 58s)  kubelet  Error: couldn't find key DATA_DIR in ConfigMap taskboard-broken/tb-config-broken

$ kubectl get configmap tb-config-broken -n taskboard-broken -o jsonpath='{.data}'
{"APP_NAME":"Taskboard"}
```

**Root cause** — the Deployment reads `DATA_DIR` from the ConfigMap with a `configMapKeyRef`,
and the ConfigMap only has `APP_NAME`.

`kubectl logs` is useless here, because the container never started and there are no logs. This
is the case where `describe` is the only tool that helps.

**Fix**

```bash
kubectl patch configmap tb-config-broken -n taskboard-broken --type merge \
  -p '{"data":{"DATA_DIR":"/tmp/data"}}'
kubectl rollout restart deployment/tb-fault2 -n taskboard-broken
```

The restart is required. Environment variables are read once when the container starts, so
fixing the ConfigMap alone changes nothing for a running Pod.

**Verify**

```text
tb-fault2-64598c8695-52zjv     Running    restarts=0
```

---

## Fault 3: the one that hides

**Identify** — this is the dangerous one. The Pod says:

```text
tb-fault3-6946ddb687-dpgrv     Running
```

`Running`, `1/1`, no restarts, nothing in the events. Every status check says healthy. But
nothing can reach the app.

**Investigate**

```text
$ kubectl exec -n taskboard-broken tbtest -- wget -qO- --timeout=5 http://tb-fault3
wget: can't connect to remote host (10.96.159.109): Connection refused
```

`Connection refused` rather than a timeout or a DNS error. DNS resolved, so the Service exists
and the name works. Something answered and said no.

```text
$ kubectl get endpoints tb-fault3 -n taskboard-broken
  endpoints: 10.244.1.82:8080
```

The endpoint list is **not empty**, so the selector matches the Pod. But the port is **8080**,
and the app listens on 3000.

**Root cause** — `targetPort: 8080` in the Service, container port 3000. The Service finds the
Pod correctly and then forwards to a port nothing is listening on.

This is the distinction from session 14 that is worth keeping:

| Symptom | Meaning |
|---|---|
| Name does not resolve | Service missing, or a DNS problem |
| Resolves, endpoints `<none>` | Selector does not match the Pod labels |
| Resolves, endpoints present, connection refused | Wrong `targetPort`, or the app is not listening |

**Fix**

```bash
kubectl patch service tb-fault3 -n taskboard-broken --type json \
  -p '[{"op":"replace","path":"/spec/ports/0/targetPort","value":3000}]'
```

**Verify**

```text
  endpoints: 10.244.1.82:3000
  curl: <h1>Taskboard</h1>
```

No Pod restart was needed. The Pod was never the problem.

---

## Fault 4: Pending

**Identify** — status `Pending`, and with `-o wide` there is no IP and no node, so it was never
scheduled.

**Investigate**

```text
$ kubectl describe pod -n taskboard-broken -l app=tb-fault4
  Warning  FailedScheduling  58s  default-scheduler  0/2 nodes are available:
           1 Insufficient cpu, 1 Insufficient memory, 1 node(s) had untolerated taint(s).
           preemption: 0/2 nodes are available: 2 Preemption is not helpful for scheduling.
```

**Root cause** — it requests 200Gi of memory and 40 CPUs. The message breaks the two nodes
down: the worker fails on resources, and the control plane is excluded by its taint.

**Fix**

```bash
kubectl patch deployment tb-fault4 -n taskboard-broken --type json \
  -p '[{"op":"replace","path":"/spec/template/spec/containers/0/resources/requests",
        "value":{"memory":"64Mi","cpu":"50m"}}]'
```

**Verify**

```text
tb-fault4-5cd78ddbf5-v2m6z     Running    restarts=0
```

---

## All four fixed

```text
$ kubectl get pods -n taskboard-broken
  tb-fault1-6cf6cbc9dc-vf6wt     Running    restarts=0
  tb-fault2-64598c8695-52zjv     Running    restarts=0
  tb-fault3-6946ddb687-dpgrv     Running    restarts=0
  tb-fault4-5cd78ddbf5-v2m6z     Running    restarts=0
```

## The method

1. `kubectl get pods -o wide` — what is broken, and did it get a node at all
2. `kubectl describe pod` — read the Events at the bottom
3. `kubectl logs` — only if the container actually started
4. `kubectl get endpoints` — for anything that is Running but unreachable
5. `kubectl exec` from a test Pod — check from where the app really sits

## What this challenge taught me

- Three of the four faults were visible in the status column. The fourth said `Running` and
  was completely broken, which is why "the Pod is Running" is not the same as "the app works".
- The error messages name the exact thing: the missing key, the unavailable image, the node
  that had insufficient CPU. Reading them properly is most of the job.
- `Connection refused` with non-empty endpoints points at the port, not the selector. Timeout
  and refused mean different things.
- Changing a ConfigMap does not affect running Pods. Environment variables are read once at
  startup, so a restart is part of the fix.
- Argo CD with `selfHeal` would have undone all of this automatically, which is a strong
  argument for GitOps and the reason the challenge needed its own unmanaged namespace.
