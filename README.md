# DevOps 2028

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

My homework for the DevOps course. One folder per session, each with its own README holding
the tasks, the commands I ran, the real output and screenshots.

## Sessions

| Session | Topic | Folder |
|---|---|---|
| 1 and 2 | Linux Fundamentals | [linux-fundamentals](linux-fundamentals) |
| 3 | Shell Scripting | [shell-scripting](shell-scripting) |
| 4 | Networking | [networking](networking) |
| 5 | Git and GitHub | [git-and-github](git-and-github) |
| 6 | Docker Fundamentals | [docker-fundamentals](docker-fundamentals) |
| 7 | Docker Images | [docker-images](docker-images) |
| 8 | Docker Networking | [docker-networking](docker-networking) |
| 9 | Kubernetes Fundamentals | [kubernetes-fundamentals](kubernetes-fundamentals) |
| 10 | Kubernetes Pods, ReplicaSets and Deployments | [kubernetes-pods-replicasets-deployments](kubernetes-pods-replicasets-deployments) |
| 11 | Kubernetes Networking and Services | [kubernetes-networking-services](kubernetes-networking-services) |
| 12 | Kubernetes Ingress, ConfigMaps and Secrets | [kubernetes-ingress-configmaps-secrets](kubernetes-ingress-configmaps-secrets) |
| 13 | Kubernetes Storage, HPA and Probes | [kubernetes-storage-hpa-probes](kubernetes-storage-hpa-probes) |
| 14 | Kubernetes Troubleshooting | [kubernetes-troubleshooting](kubernetes-troubleshooting) |
| 15 | Helm | [kubernetes-helm](kubernetes-helm) |
| 16 | CI/CD and GitHub Actions | [cicd-github-actions](cicd-github-actions) |
| 17 | Complete CI/CD and DevSecOps | [cicd-devsecops](cicd-devsecops) |
| 18 | Terraform and Infrastructure as Code | [terraform-iac](terraform-iac) |
| 19 | Cloud and Terraform in Action | [terraform-cloud-project](terraform-cloud-project) |
| 20 | Monitoring, Observability and GitOps | [monitoring-observability-gitops](monitoring-observability-gitops) |
| 21 | Final DevOps Project and Troubleshooting | [final-devops-project](final-devops-project) |

Also in the repo: [docker-multi-stage](docker-multi-stage), the multi-stage build homework.

## How I ran everything

My laptop is a MacBook, so a few things needed a local environment rather than real servers:

| What | How |
|---|---|
| Linux commands | Ubuntu containers, so the output matches a real Linux machine |
| Kubernetes | A 2 node **kind** cluster, config in [kubernetes-fundamentals](kubernetes-fundamentals/kind-cluster.yaml) |
| AWS and Terraform | **LocalStack**, so nothing is created in a real AWS account and nothing is billed |
| CI/CD | Real GitHub Actions runs on this repository |
| Monitoring | Prometheus, Grafana and Alertmanager on the kind cluster |
| GitOps | Argo CD on the kind cluster, syncing from this repository |

Where something behaves differently from a real setup, I have said so in that session's README
rather than leaving it out.

## Things that actually happened

A few results worth pointing at, because they were not staged:

- **The security gate blocked a release.** In [session 17](cicd-devsecops) Trivy failed the
  build on three HIGH CVEs and the push steps never ran. The fix was to remove the vulnerable
  software from the image, not to lower the threshold.
- **The HPA scaled 1 to 10 pods** under a real load generator in
  [session 13](kubernetes-storage-hpa-probes), then held at the CPU target.
- **Recreate really does cause downtime.** In [session 10](kubernetes-pods-replicasets-deployments)
  sampling every half second caught `running=0`, where rolling update never dropped below 4.
- **Argo CD built a whole application from git alone** in
  [session 20](monitoring-observability-gitops), with nothing applied by hand.

## Applications built

| App | Where | Port |
|---|---|---|
| Node.js, Python, Java, Apache, React, Nginx | [docker-images](docker-images) | 8081 to 8087 |
| Multi-stage build from class | [docker-multi-stage](docker-multi-stage) | 8080 |
| CI/CD demo | [cicd-github-actions](cicd-github-actions) | built by the pipeline |
| DevSecOps demo | [cicd-devsecops](cicd-devsecops) | deployed to the cluster |
| Taskboard, the final project | [final-devops-project](final-devops-project) | through the ingress |

## Environment

```
macOS on Apple Silicon (arm64)
Docker 29.5.3, kind v0.33.0, kubectl v1.34.1
Helm v4.3.0, Terraform v1.16.4
```
