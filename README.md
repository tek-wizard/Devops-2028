# DevOps 2028

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

My homework for the DevOps class. There is one folder per homework, and each folder has its
own README with the tasks, the commands I ran, the output, and screenshots.

## Homework

| Homework | Folder |
|---|---|
| Linux Homework Tasks | [linux-fundamentals](linux-fundamentals) |
| Shell Scripting Homework Task | [shell-scripting](shell-scripting) |
| Networking Homework Tasks | [networking](networking) |
| Git Homework Tasks | [git-and-github](git-and-github) |
| Docker Homework Tasks | [docker-images](docker-images) |
| Docker Multi-Stage Build Homework | [docker-multi-stage](docker-multi-stage) |
| Docker Networking and Volume Homework Tasks | [docker-networking](docker-networking) |
| Docker basics notes from the session | [docker-fundamentals](docker-fundamentals) |

## Task list and where each one is

| Homework | Task | Where |
|---|---|---|
| Linux | Task 1: Soft Link and Hard Link | [link](linux-fundamentals#task-1-soft-link-and-hard-link) |
| Linux | Task 2: `adduser` vs `useradd` | [link](linux-fundamentals#task-2-adduser-vs-useradd) |
| Linux | Task 3: `journalctl` | [link](linux-fundamentals#task-3-journalctl) |
| Linux | Task 4: Linux Command Cheat Sheet | [link](linux-fundamentals#task-4-linux-command-cheat-sheet) |
| Shell Scripting | System Information Script | [link](shell-scripting#10-system_infosh-the-homework) |
| Networking | Task 1 and Task 2: commands with output and explanation | [link](networking) |
| Git | Task 1: `git commit -a -m` | [link](git-and-github#task-1-git-commit--a--m) |
| Git | Task 2: Git Cherry-Pick | [link](git-and-github#task-2-git-cherry-pick) |
| Docker | Six Hello World applications | [link](docker-images) |
| Docker Multi-Stage | Task 1: run the multi-stage Dockerfile | [link](docker-multi-stage#task-1-run-the-multi-stage-dockerfile) |
| Docker Multi-Stage | Task 2: documentation | [link](docker-multi-stage#task-2-documentation) |
| Docker Multi-Stage | Task 3: deploy 3 types of applications | [link](docker-multi-stage#task-3-three-different-types-of-applications) |
| Docker Networking | Task 1: Docker Container Networking | [link](docker-networking#task-1-docker-container-networking) |
| Docker Networking | Task 2: Host Network | [link](docker-networking#task-2-host-network) |
| Docker Networking | Task 3: Bind Mount | [link](docker-networking#task-3-bind-mount) |
| Docker Networking | Task 4: Overlay Network | [link](docker-networking#task-4-overlay-network) |

## The Docker applications

Six applications, each in its own folder with its own Dockerfile, all built and run.

| Folder | Application | Host port |
|---|---|---|
| [docker-images/nodejs-app](docker-images/nodejs-app) | Node.js with Express | 8081 |
| [docker-images/python-app](docker-images/python-app) | Python with Flask | 8082 |
| [docker-images/java-app](docker-images/java-app) | Java web server | 8083 |
| [docker-images/Apache-app](docker-images/Apache-app) | Apache httpd | 8084 |
| [docker-images/React-app](docker-images/React-app) | React built with Vite, served by nginx | 8086 |
| [docker-images/nginx-app](docker-images/nginx-app) | Nginx | 8087 |
| [docker-multi-stage/multi-stage-app](docker-multi-stage) | The class multi-stage Dockerfile | 8080 |

## How I ran things

I have a MacBook, so for the Linux commands I used an Ubuntu container to get the same
output as a normal Linux machine:

```bash
docker run -dit --name devops-lab --hostname devops-lab -v "$PWD":/home/work ubuntu:24.04 bash
docker exec -it devops-lab bash
```

That is why the hostname in the Linux output is `devops-lab` and the user is `root`.

For `journalctl` I needed a second container running systemd, because a normal container does
not have systemd inside it. The Dockerfile for it is in
[linux-fundamentals](linux-fundamentals/Dockerfile.systemd).

All the Docker work was done directly on my laptop with Docker Desktop.
