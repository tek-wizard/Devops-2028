# Docker Fundamentals (Session 6)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

These are my notes from the Docker basics session. Every command here I ran myself and the
output is pasted exactly as it came out.

The Dockerfiles and the applications are in [`../docker-images`](../docker-images).
Networks, volumes and bind mounts are in [`../docker-networking`](../docker-networking).

## The idea in one paragraph

Before containers, the way to ship an app was to hand over the code and a document saying
which versions of everything to install, and then find out that the server had a different
Python version. A container image packs the app together with its dependencies, its
libraries and its filesystem layout into one artifact. The same image runs the same way on
my MacBook, on a teammate's Windows laptop and on a server in a data centre.

A container is not a small virtual machine. A VM boots a whole guest operating system with
its own kernel, which takes gigabytes and a minute to start. A container is just processes
running on the host kernel, isolated from everything else using kernel features called
namespaces and cgroups. Namespaces control what the process can see, so it gets its own
view of processes, network and filesystem. Cgroups control how much it can use, so it can
be limited to one CPU and 512 MB of memory. That is why containers start in under a second
and weigh megabytes.

## Image and container

This is the distinction everything else depends on:

- An **image** is the read only template. It is built from a Dockerfile and does not run.
- A **container** is a running instance of an image, with a thin writable layer on top.

One image can have many containers running from it at the same time, all sharing the same
read only layers and each with its own writable layer. It is like a class and its objects.

## My setup

```bash
$ docker --version
Docker version 29.5.3, build d1c06ef
```

```bash
$ docker info
Server Version: 29.5.3
Operating System: Docker Desktop
Architecture: aarch64
Total Memory: 16747134976
Containers: 9 (running 9, stopped 0)
Images: 230
Storage Driver: overlayfs
```

`Architecture: aarch64` matters. My laptop is an Apple Silicon Mac, so images have to be
arm64 builds. Most official images publish both arm64 and amd64, but occasionally one is
amd64 only and then Docker either refuses or runs it slowly under emulation.

---

## Running containers

### A container that does one thing and exits

```bash
$ docker run --rm ubuntu:24.04 echo "hello from inside the container"
hello from inside the container
```

That one line did a lot: Docker looked for `ubuntu:24.04` locally, created a container from
it, ran `echo` inside it, the container stopped because `echo` finished, and `--rm` deleted
it.

The important idea here is that **a container lives exactly as long as its main process**.
It is not a machine that stays up. When the process exits, the container stops. That is why
`docker run ubuntu` on its own seems to do nothing, the default command is a shell, there is
nothing on standard input, so the shell exits immediately.

### A container that keeps running

```bash
$ docker run -d --name practice ubuntu:24.04 sleep 600
a6096a7e87736c2dfb475444c484430c936ba5198542f363dc36552479c296de

$ docker ps --filter name=practice
CONTAINER ID   IMAGE          COMMAND       CREATED        STATUS                  PORTS     NAMES
a6096a7e8773   ubuntu:24.04   "sleep 600"   1 second ago   Up Less than a second             practice
```

The long string is the full container ID. The short 12 character version is what `docker ps`
shows and it is enough to use in commands.

| Flag | What it does |
|---|---|
| `-d` | Detached, run in the background and give me my terminal back |
| `--name` | Give it a name so I do not have to keep copying IDs |
| `-it` | Interactive with a terminal, for when I want a shell inside |
| `--rm` | Delete the container as soon as it stops |
| `-p 8080:80` | Map host port 8080 to container port 80 |
| `-e KEY=value` | Set an environment variable |
| `-v /host:/container` | Mount a folder or volume |
| `--network name` | Attach it to a network |

### `docker exec` to get inside a running container

```bash
$ docker exec practice bash -c 'mkdir /demo && echo "hello docker" > /demo/test.txt && cat /demo/test.txt'
hello docker
```

```bash
$ docker exec practice bash -c 'hostname; whoami; ls /'
a6096a7e8773
root
bin  boot  demo  dev  etc  home  lib  media  mnt  opt  proc  root  run  sbin  srv  sys  tmp  usr  var
```

The hostname inside the container is its own container ID by default, and the `demo` folder
I just made is sitting in `/` next to the normal Linux folders.

The process list from inside is the clearest thing I saw all session:

```bash
$ docker exec practice ps -ef
UID          PID    PPID  C STIME TTY          TIME CMD
root           1       0  0 11:43 ?        00:00:00 sleep 600
root          14       0  0 11:43 ?        00:00:00 bash -c hostname; whoami; ls /; ps -ef
root          22      14  0 11:43 ?        00:00:00 ps -ef
```

**PID 1 is `sleep 600`.** On a normal Linux machine PID 1 is systemd and there are hundreds
of processes. Inside this container there are three, and the main command is PID 1. That is
the PID namespace at work, and it explains why the container dies when its main process
dies: killing PID 1 ends everything in that namespace.

For an interactive shell instead of one command:

```bash
docker exec -it practice bash
```

`docker exec` is not the same as `docker run`. `run` makes a brand new container from an
image. `exec` starts an extra process inside a container that is already running.

---

## Lifecycle: stop, start, remove

```bash
$ docker stop practice
practice

$ docker ps --filter name=practice
CONTAINER ID   IMAGE     COMMAND   CREATED   STATUS    PORTS     NAMES
```

`docker ps` on its own only lists running containers, so the stopped one vanishes. It is
not gone though:

```bash
$ docker ps -a --filter name=practice
CONTAINER ID   IMAGE          COMMAND       CREATED          STATUS                                PORTS     NAMES
a6096a7e8773   ubuntu:24.04   "sleep 600"   13 seconds ago   Exited (137) Less than a second ago             practice
```

`Exited (137)` is the exit code. 137 is 128 + 9, which means the process was killed with
signal 9. `docker stop` sends SIGTERM first and waits 10 seconds, and `sleep` does not
handle SIGTERM, so Docker had to force it. This is the same SIGTERM versus SIGKILL idea as
`kill` and `kill -9` in the Linux session.

### The writable layer, and why volumes exist

Starting the same container again keeps the file I made:

```bash
$ docker start practice
practice
$ docker exec practice cat /demo/test.txt
hello docker
```

But removing the container and making a new one from the same image loses it:

```bash
$ docker stop practice && docker rm practice
practice
practice

$ docker run -d --name practice2 ubuntu:24.04 sleep 600
$ docker exec practice2 cat /demo/test.txt
cat: /demo/test.txt: No such file or directory
```

This is the single most important experiment in the session. My file lived in the
container's **writable layer**, not in the image. Stop and start keep that layer. `docker rm`
throws it away. The image was never touched, which is why the new container came up clean.

So a container filesystem is disposable by design. Anything that has to survive the
container being replaced, which is what happens on every deployment, has to live in a
volume or a bind mount, and that is the whole reason those exist. There is a working example
in [`../docker-networking`](../docker-networking).

---

## Looking at what a container is doing

### `docker logs`

```bash
$ docker logs multistage-app

> docker-hello-world@1.0.0 start
> node server.js

Server running on port 3000
```

Docker captures whatever the main process writes to standard output and standard error.
This is why a containerised app should log to stdout instead of into a file inside the
container. If it logs to a file, the logs disappear with the container.

`docker logs -f` follows live, like `tail -f`.

### `docker inspect`

`docker inspect` on its own prints a huge amount of JSON, so `--format` is how to make it
useful:

```bash
$ docker inspect multistage-app --format 'Name: {{.Name}}
Image: {{.Config.Image}}
State: {{.State.Status}}
IP address: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}
Ports: {{json .NetworkSettings.Ports}}
Command: {{json .Config.Cmd}}'

Name: /multistage-app
Image: multistage-hello
State: running
IP address: 172.17.0.9
Ports: {"3000/tcp":[{"HostIp":"0.0.0.0","HostPort":"8080"}]}
Command: ["npm","start"]
```

Every container gets its own IP address on a Docker network. `172.17.0.9` here is on the
default bridge.

| Command | What it shows |
|---|---|
| `docker logs name` | Output of the main process |
| `docker logs -f name` | The same, following live |
| `docker inspect name` | Everything about the container as JSON |
| `docker stats` | Live CPU, memory and network per container |
| `docker top name` | Processes running inside |
| `docker port name` | Just the port mappings |
| `docker diff name` | Files changed compared to the image |

---

## Images and layers

An image is not one blob, it is a stack of read only layers, and each instruction in a
Dockerfile that changes the filesystem makes one. `docker history` shows the stack, newest
at the top:

```bash
$ docker history hello-python
IMAGE          CREATED         CREATED BY                                      SIZE      COMMENT
13a37a7acc32   2 minutes ago   CMD ["python" "app.py"]                         0B        buildkit.dockerfile.v0
<missing>      2 minutes ago   EXPOSE [5000/tcp]                               0B        buildkit.dockerfile.v0
<missing>      2 minutes ago   COPY app.py . # buildkit                        12.3kB    buildkit.dockerfile.v0
<missing>      2 minutes ago   RUN /bin/sh -c pip install --no-cache-dir -r…   15.5MB    buildkit.dockerfile.v0
<missing>      2 minutes ago   COPY requirements.txt . # buildkit              12.3kB    buildkit.dockerfile.v0
<missing>      2 minutes ago   WORKDIR /app                                    8.19kB    buildkit.dockerfile.v0
<missing>      6 days ago      CMD ["python3"]                                 0B        buildkit.dockerfile.v0
<missing>      6 days ago      RUN /bin/sh -c set -eux;  for src in idle3 p…   16.4kB    buildkit.dockerfile.v0
<missing>      6 days ago      RUN /bin/sh -c set -eux;   savedAptMark="$(a…   44.6MB    buildkit.dockerfile.v0
<missing>      6 days ago      ENV PYTHON_SHA256=5c8462af5790baf43a321a1559…   0B        buildkit.dockerfile.v0
<missing>      6 days ago      ENV PYTHON_VERSION=3.12.14                      0B        buildkit.dockerfile.v0
<missing>      6 days ago      RUN /bin/sh -c set -eux;  apt-get update;  a…   4.98MB    buildkit.dockerfile.v0
<missing>      6 days ago      ENV LANG=C.UTF-8                                0B        buildkit.dockerfile.v0
<missing>      7 days ago      # debian.sh --arch 'arm64' out/ 'trixie' '@1…   109MB     debuerreotype 0.17
```

Reading this from the bottom up: 109 MB of Debian base, then the layers the Python image
authors added, and only the top six lines are mine. So most of a 223 MB image is not my
code at all, which is why the choice of base image is the biggest decision in a Dockerfile.

Layers marked `<missing>` are not broken. They just do not have their own tag locally,
only the top layer gets the image ID.

`EXPOSE` and `CMD` are `0B` because they are metadata, they do not change the filesystem.

### The build cache

Docker caches every layer. On a rebuild with nothing changed, everything is reused:

```bash
$ docker build -t hello-python .
#6 [3/5] COPY requirements.txt .
#6 CACHED
#7 [2/5] WORKDIR /app
#7 CACHED
#8 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED
#9 [5/5] COPY app.py .
#9 CACHED
#10 DONE 0.0s
```

The rule is that once one layer changes, every layer after it has to be rebuilt, because
each layer is built on the one before it.

That is why the order of instructions matters so much, and I tested it. I changed one line
in `app.py` and rebuilt:

```bash
$ docker build -t hello-python .
#6 [3/5] COPY requirements.txt .
#6 CACHED
#7 [2/5] WORKDIR /app
#7 CACHED
#8 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED
#9 [5/5] COPY app.py .
```

`pip install` is still `CACHED` and only the `COPY app.py` step ran again. That is the
payoff for copying `requirements.txt` on its own before copying the code. If the Dockerfile
had `COPY . .` before `RUN pip install`, then editing one character of Python would make
pip download and install everything again on every single build.

**Rule of thumb:** put the things that rarely change at the top of the Dockerfile and the
things that change constantly, which is my source code, at the bottom.

### Image commands

| Command | What it does |
|---|---|
| `docker images` | List local images |
| `docker pull nginx:alpine` | Download an image without running it |
| `docker build -t name:tag .` | Build from the Dockerfile in the current folder |
| `docker history name` | Show the layers |
| `docker image inspect name` | Full details as JSON |
| `docker tag old new` | Add another name to the same image |
| `docker rmi name` | Delete an image |
| `docker save` / `docker load` | Write an image to a tar file and read it back |

A word on tags. `nginx:alpine` is `repository:tag`, and if the tag is left off Docker
assumes `:latest`. `latest` is only a default name, not a promise that it is the newest, and
it moves over time. So a Dockerfile using `FROM node:latest` can build differently next
month, which is why I pinned real versions like `node:22-alpine` and `python:3.12-slim`
everywhere.

---

## Cleaning up

The commands from the class notes, and what they actually do:

```bash
# Stop every running container
docker stop $(docker ps -q)

# Remove every container, including stopped ones
docker rm $(docker ps -aq)

# Stop and remove in one go
docker rm -f $(docker ps -aq)

# Remove every image
docker rmi -f $(docker images -q)

# Remove everything not currently used, including build cache
docker system prune -a
```

The `$( )` part is command substitution, the same thing as in the shell scripting session.
`docker ps -q` prints only the IDs, so `docker rm $(docker ps -aq)` becomes
`docker rm id1 id2 id3`.

Worth being careful. `docker rm -f $(docker ps -aq)` deletes every container on the machine
without asking, including things belonging to other projects. I have other containers
running on my laptop for unrelated work, so I removed mine by name instead:

```bash
docker rm -f react-app python-web java-web apache-web multistage-app
```

Also, if there are no containers at all, `docker ps -aq` returns nothing and the command
fails with "requires at least 1 argument". That is harmless but it looks like an error.

Useful checks before deleting anything:

```bash
docker system df          # how much disk images, containers and cache are using
docker image prune        # only untagged dangling images, much safer than -a
docker container prune    # only stopped containers
```

---

## Summary of what I understood

- A container lives as long as its main process, and that process is PID 1 inside it.
- An image is read only. A container adds a thin writable layer, and `docker rm` deletes
  that layer, which is why data has to go in a volume to survive.
- `docker run` creates a new container, `docker start` restarts an existing one, and
  `docker exec` adds a process to one that is already running.
- Images are stacks of layers, layers are cached, and the order of instructions in a
  Dockerfile decides how much gets rebuilt on every change.
- Pin image versions instead of relying on `latest`.
