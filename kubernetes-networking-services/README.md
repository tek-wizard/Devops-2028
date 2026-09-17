# Kubernetes Networking and Services

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework tasks

- Understand why Services are needed.
- Practise the Service types: ClusterIP, NodePort, LoadBalancer, ExternalName and headless.
- Check how Pods reach each other by name.
- Troubleshoot a Service that has no endpoints.

The cluster setup is in [kubernetes-fundamentals](../kubernetes-fundamentals). All the YAML
files are in [manifests](manifests).

## Why Services exist

Every Pod gets its own IP, but Pod IPs are not something I can rely on. When a Pod is
replaced, in a rolling update or after a crash, the new Pod gets a **different IP**. I saw
this in the Deployment homework, where the Pods were replaced one by one and all got new
names and new IPs.

So hardcoding a Pod IP anywhere would break the next time anything restarts.

A **Service** is a fixed name and a fixed IP in front of a group of Pods. It finds its Pods
with a label selector, so when Pods come and go the Service just points at whichever ones
currently match.

## The app behind all the Services

[manifests/app-deployment.yaml](manifests/app-deployment.yaml) runs 2 nginx Pods labelled
`app: web-app`. Every Service below selects that label.

```text
$ kubectl get pods -l app=web-app -o wide
NAME                       READY   STATUS    RESTARTS   AGE   IP            NODE
web-app-64d68fc7f4-g9hk4   1/1     Running   0          6s    10.244.1.22   devops-2028-worker
web-app-64d68fc7f4-srstn   1/1     Running   0          6s    10.244.1.21   devops-2028-worker
```

## All the Services together

```text
$ kubectl get svc
NAME               TYPE           CLUSTER-IP      EXTERNAL-IP      PORT(S)        AGE
broken-service     ClusterIP      10.96.141.242   <none>           80/TCP         6s
external-db        ExternalName   <none>          www.google.com   <none>         6s
kubernetes         ClusterIP      10.96.0.1       <none>           443/TCP        4m4s
web-clusterip      ClusterIP      10.96.50.237    <none>           80/TCP         6s
web-headless       ClusterIP      None            <none>           80/TCP         6s
web-loadbalancer   LoadBalancer   10.96.15.99     <pending>        80:32115/TCP   6s
web-nodeport       NodePort       10.96.160.11    <none>           80:30080/TCP   6s
```

---

## 1. ClusterIP

The default type. It gets an IP that only works **inside** the cluster.

```yaml
apiVersion: v1
kind: Service
metadata:
  name: web-clusterip
spec:
  type: ClusterIP
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 80
```

`port` is the port on the Service and `targetPort` is the port on the Pod.

To test it I ran a small busybox Pod and called the Service **by name**:

```text
$ kubectl run client --image=busybox:1.37 --restart=Never --command -- sleep 3600

$ kubectl exec client -- wget -qO- http://web-clusterip
<!DOCTYPE html>
<html>
<head>
<title>Welcome to nginx!</title>
```

It worked with just the name `web-clusterip`, no IP anywhere. That is CoreDNS doing the work:

```text
$ kubectl exec client -- nslookup web-clusterip.default.svc.cluster.local
Server:		10.96.0.10
Address:	10.96.0.10:53

Name:	web-clusterip.default.svc.cluster.local
Address: 10.96.50.237
```

The full DNS name is `servicename.namespace.svc.cluster.local`. Inside the same namespace the
short name is enough.

### Endpoints

This was the part that made Services click for me:

```text
$ kubectl get endpoints
NAME               ENDPOINTS                       AGE
broken-service     <none>                          6s
kubernetes         172.26.0.3:6443                 4m4s
web-clusterip      10.244.1.21:80,10.244.1.22:80   6s
web-headless       10.244.1.21:80,10.244.1.22:80   6s
web-loadbalancer   10.244.1.21:80,10.244.1.22:80   6s
web-nodeport       10.244.1.21:80,10.244.1.22:80   6s
```

The endpoints are exactly the two Pod IPs from earlier. So a Service is really just a stable
name plus a list of Pod IPs that Kubernetes keeps up to date. When a Pod is replaced, its old
IP drops off the list and the new one is added.

---

## 2. NodePort

NodePort opens the same port on **every node**, so something outside the cluster can reach
it.

```yaml
spec:
  type: NodePort
  selector:
    app: web-app
  ports:
    - port: 80
      targetPort: 80
      nodePort: 30080
```

```text
$ kubectl get svc web-nodeport
NAME           TYPE       CLUSTER-IP      EXTERNAL-IP   PORT(S)        AGE
web-nodeport   NodePort   10.96.160.11    <none>        80:30080/TCP   6s
```

`80:30080/TCP` means port 80 on the Service and port 30080 on every node. Reaching it through
a node IP:

```text
$ kubectl exec client -- wget -qO- http://172.26.0.2:30080
<title>Welcome to nginx!</title>
```

`172.26.0.2` is the worker node's IP from `kubectl get nodes -o wide`.

The node port has to be in the range **30000 to 32767**. If I leave `nodePort` out,
Kubernetes picks one from that range itself.

A NodePort still has a ClusterIP as well, so it works from inside the cluster too. NodePort
is built on top of ClusterIP rather than replacing it.

---

## 3. LoadBalancer

LoadBalancer asks the cloud provider for a real external load balancer.

```text
$ kubectl get svc web-loadbalancer
NAME               TYPE           CLUSTER-IP    EXTERNAL-IP   PORT(S)        AGE
web-loadbalancer   LoadBalancer   10.96.15.99   <pending>     80:32115/TCP   6s
```

**`EXTERNAL-IP` stays `<pending>` forever on my laptop**, and that is the correct result
rather than a mistake. LoadBalancer only works when something is there to answer the request,
like AWS, GCP or Azure. My cluster is kind running in Docker, so nobody answers and it waits.

It is still useful to see what it did: it allocated a ClusterIP **and** a node port `32115`
anyway. So the types stack up: LoadBalancer is a NodePort with a cloud load balancer in
front, and NodePort is a ClusterIP opened on the nodes.

On a real cloud the `EXTERNAL-IP` would fill in with a public address after a minute.

---

## 4. ExternalName

This one does not point at Pods at all. It is a DNS alias to something outside the cluster.

```yaml
spec:
  type: ExternalName
  externalName: www.google.com
```

```text
$ kubectl exec client -- nslookup external-db
Name:	www.google.com
Address: 142.251.154.119
Name:	www.google.com
Address: 142.251.155.119
```

Asking for `external-db` returned the addresses of `www.google.com`. Notice it has no
CLUSTER-IP in `kubectl get svc`, because there is nothing to route, it is only a DNS record.

This is used when an app should keep calling something like `database` inside the cluster,
but the real database lives outside on a managed service. Moving it later only means changing
this one Service instead of the app.

---

## 5. Headless Service

A headless Service has `clusterIP: None`. Instead of one Service IP, DNS returns **all the
Pod IPs**.

```yaml
spec:
  clusterIP: None
  selector:
    app: web-app
  ports:
    - port: 80
```

```text
$ kubectl exec client -- nslookup web-headless
Name:	web-headless.default.svc.cluster.local
Address: 10.244.1.21
Name:	web-headless.default.svc.cluster.local
Address: 10.244.1.22
```

Two addresses came back instead of one, and they are the two Pod IPs.

Compared with the ClusterIP Service earlier, which returned the single address
`10.96.50.237`, this returns the Pods directly and there is no load balancing in the middle.

That matters for something like a database cluster, where the app needs to talk to one
specific member, for example the primary, rather than a random one. Databases running as a
StatefulSet use a headless Service for exactly that.

---

## 6. Troubleshooting: a Service with no endpoints

The most common Service problem is a selector that does not match any Pod. I made one on
purpose, [manifests/wrong-selector-service.yaml](manifests/wrong-selector-service.yaml):

```yaml
spec:
  selector:
    app: this-label-does-not-exist
```

```text
$ kubectl get svc broken-service
NAME             TYPE        CLUSTER-IP      EXTERNAL-IP   PORT(S)   AGE
broken-service   ClusterIP   10.96.141.242   <none>        80/TCP    6s

$ kubectl get endpoints
NAME             ENDPOINTS   AGE
broken-service   <none>      6s
```

The Service looks completely healthy in `kubectl get svc`. It has a type, a cluster IP and a
port, and there is no error anywhere. But its endpoints are `<none>`, so any request to it
just fails to connect.

**So `kubectl get endpoints` is the command to run when a Service is not working.** If the
endpoints are empty, the selector does not match the Pod labels. The fix is to compare:

```bash
kubectl get svc broken-service -o jsonpath='{.spec.selector}'
kubectl get pods --show-labels
```

and make them agree.

---

## The types side by side

| Type | Reachable from | Gets a cluster IP | Typical use |
|---|---|---|---|
| ClusterIP | Inside the cluster only | Yes | Services talking to each other. The default |
| NodePort | Outside, on `nodeIP:30000-32767` | Yes | Testing, or small setups without a cloud |
| LoadBalancer | Outside, on a real IP | Yes | Production on a cloud provider |
| ExternalName | It is only a DNS alias | No | Pointing at something outside the cluster |
| Headless | Inside, straight to the Pod IPs | No (`None`) | StatefulSets and databases |

## Commands I used

| Command | What it does |
|---|---|
| `kubectl get svc` | List Services |
| `kubectl get endpoints` | Which Pods each Service points to |
| `kubectl describe svc name` | Details of one Service |
| `kubectl get pods --show-labels` | Check labels against a selector |
| `kubectl exec client -- wget -qO- http://name` | Call a Service from inside the cluster |
| `kubectl exec client -- nslookup name` | Check cluster DNS |

## Clean up

```bash
kubectl delete -f manifests/
kubectl delete pod client
```

## What I understood

- Pod IPs change, so nothing should point at them. A Service is the stable name in front.
- A Service is really a name plus a list of endpoints, and the endpoint list is just the IPs
  of the Pods whose labels match the selector.
- The types build on each other. NodePort is ClusterIP plus a port on every node, and
  LoadBalancer is NodePort plus a cloud load balancer.
- `<pending>` on a LoadBalancer on a local cluster is the expected result, not a bug.
- When a Service does not work, `kubectl get endpoints` is the fastest check. Empty endpoints
  means the selector and the Pod labels do not match.
