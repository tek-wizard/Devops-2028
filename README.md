# DevOps 2028

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

My homework for the DevOps course. One folder per topic, and each folder has its own
`README.md` with the theory, the commands I wrote, and the real output from running them.

Class repository: https://github.com/Nency-Ravaliya/devops-heros

## Sections

| Topic | Folder | What is in it |
|---|---|---|
| Linux Fundamentals | [`linux-fundamentals`](linux-fundamentals) | Soft and hard links, `adduser` vs `useradd`, `journalctl`, the Linux command cheat sheet |
| Shell Scripting | [`shell-scripting`](shell-scripting) | Ten bash scripts including the system report homework |
| Networking | [`networking`](networking) | IP addressing, subnetting worked by hand, `ping`, DNS, ports |
| Git and GitHub | [`git-and-github`](git-and-github) | `git commit -a -m`, and the cherry-pick exercise done in this repo |
| Docker Fundamentals | [`docker-fundamentals`](docker-fundamentals) | Images, containers, the writable layer, layers and the build cache |
| Docker Images | [`docker-images`](docker-images) | Hello World apps for React, Python, Java and Apache, plus the multi-stage task |
| Docker Networking | [`docker-networking`](docker-networking) | Three tier network isolation, host network, bind mounts, volumes, overlay networks |

## Homework covered, session by session

| Session | Task | Where |
|---|---|---|
| 2 Linux | Soft links and hard links | [linux-fundamentals](linux-fundamentals#task-1-soft-links-and-hard-links) |
| 2 Linux | `adduser` vs `useradd`, and which is standard | [linux-fundamentals](linux-fundamentals#task-2-adduser-vs-useradd) |
| 2 Linux | `journalctl` and what it is for | [linux-fundamentals](linux-fundamentals#task-3-journalctl) |
| 2 Linux | The Linux command cheat sheet | [linux-fundamentals](linux-fundamentals#task-4-linux-command-cheat-sheet) |
| 3 Shell | Script printing date, hostname, user, disk usage and processes, saving processes to a file in a new folder | [shell-scripting](shell-scripting#10-the-homework-script-system_infosh) |
| 4 Networking | `ping`, subnetting and the special IP addresses, written up with output | [networking](networking) |
| 5 Git | `git commit -a -m` and how it differs | [git-and-github](git-and-github#part-1-git-commit--m-and-git-commit--a--m) |
| 5 Git | Cherry-pick exercise with branches and commits | [git-and-github](git-and-github#part-2-the-cherry-pick-exercise) |
| 6 Docker | Hello World web apps for Node/React, Python, Java and Apache with a Dockerfile each | [docker-images](docker-images) |
| 7 Docker | Build and run the class multi-stage Dockerfile on port 8080, with evidence | [docker-images](docker-images#5-session-7-task-the-multi-stage-dockerfile-from-class) |
| 8 Docker | Three containers on three networks, backend on two, connectivity checked | [docker-networking](docker-networking#task-1-three-containers-three-networks-and-network-isolation) |
| 8 Docker | Apache2 on the host network, reached on port 80 | [docker-networking](docker-networking#task-2-apache-with-the-host-network) |
| 8 Docker | Bind mount an `index.html` into nginx and edit it live | [docker-networking](docker-networking#task-3-bind-mount) |
| 8 Docker | Research overlay networks | [docker-networking](docker-networking#task-4-overlay-networks) |

## Applications I built and ran

Five containers, all running at once, all with a browser screenshot in the section READMEs.

| Application | Image built from | Port | Screenshot |
|---|---|---|---|
| React, built with Vite and served by nginx | [`docker-images/nodejs-app`](docker-images/nodejs-app) | 8081 | [view](docker-images/screenshots/nodejs-react-app-8081.jpg) |
| Python, Flask | [`docker-images/python-app`](docker-images/python-app) | 8082 | [view](docker-images/screenshots/python-app-8082.jpg) |
| Java, built in HTTP server, no framework | [`docker-images/java-app`](docker-images/java-app) | 8083 | [view](docker-images/screenshots/java-app-8083.jpg) |
| Apache httpd serving a static page | [`docker-images/apache-app`](docker-images/apache-app) | 8084 | [view](docker-images/screenshots/apache-app-8084.jpg) |
| The class multi-stage Dockerfile, session 7 | [`docker-images/multi-stage-app`](docker-images/multi-stage-app) | 8080 | [view](docker-images/screenshots/multi-stage-app-8080.jpg) |

## How I ran things

My laptop is a MacBook on Apple Silicon, so:

- **Docker** runs natively through Docker Desktop, and all the Docker tasks were done on the
  Mac. Where macOS behaves differently from Linux, mainly with the host network driver, I
  have written down what happened and why instead of leaving it out.
- **The Linux tasks** were done inside Ubuntu containers, so the commands and their output
  match a normal Linux machine rather than macOS, which has BSD versions of a lot of the same
  tools.

```bash
# the container used for links, users, the cheat sheet and the networking commands
docker run -dit --name devops-lab --hostname devops-lab \
  -v "$PWD":/home/work ubuntu:24.04 bash

# a second one running systemd as PID 1, because journalctl needs a systemd journal
docker build -t systemd-ubuntu -f Dockerfile.systemd .
docker run -d --name systemd-lab --hostname systemd-lab --privileged --cgroupns=host \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw systemd-ubuntu
```

That is why the hostname in the Linux output is `devops-lab` or `systemd-lab` and the user is
`root`.

## Notes on this repository

- Every command output in these files is pasted from a real run. Where something failed, the
  failure is included along with what I did about it, because those were the parts I actually
  learned from.
- Each section README ends with a short list of what I took away and, where relevant, a table
  of the mistakes I hit and the fix.
- The cherry-pick exercise from session 5 was done on this repository, so the
  `feature/git-notes` branch and the cherry-picked commit are part of the real history and can
  be checked with `git log --oneline --graph --all`.
- Generated folders, cloned repositories and build output are kept out with `.gitignore`.

## Environment

```
macOS on Apple Silicon (arm64)
Docker version 29.5.3
git version 2.50.1
Ubuntu 24.04 containers for the Linux work
```
