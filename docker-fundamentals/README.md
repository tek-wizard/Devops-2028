# Docker Fundamentals (Session 6)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

My notes from the Docker basics session, with the commands I ran.

The Dockerfiles and applications are in [docker-images](../docker-images) and the networking
part is in [docker-networking](../docker-networking).

## What Docker is for

Before containers you had to hand over the code with a list of what to install, and then find
out the server had a different version of something. A container image packs the app together
with everything it needs, so the same image runs the same way on my laptop and on a server.

A container is not a small virtual machine. A VM boots a whole operating system with its own
kernel and takes gigabytes. A container is just processes running on the host kernel, kept
separate using namespaces and cgroups. That is why containers start in a second instead of a
minute.

## Image and container

- An **image** is the read only template built from a Dockerfile. It does not run.
- A **container** is a running instance of an image with a thin writable layer on top.

One image can have many containers running from it, like a class and its objects.

## My setup

```bash
$ docker --version
Docker version 29.5.3, build d1c06ef
```

---

## Running containers

```bash
$ docker run --rm ubuntu:24.04 echo "hello from inside the container"
hello from inside the container
```

Docker created a container, ran `echo`, the container stopped because `echo` finished, and
`--rm` deleted it.

A container runs only as long as its main command. That is why `docker run ubuntu` on its own
seems to do nothing, the shell has no input so it exits straight away.

To keep one running:

```bash
$ docker run -d --name practice ubuntu:24.04 sleep 600
a6096a7e87736c2dfb475444c484430c936ba5198542f363dc36552479c296de

$ docker ps
CONTAINER ID   IMAGE          COMMAND       CREATED        STATUS         PORTS   NAMES
a6096a7e8773   ubuntu:24.04   "sleep 600"   1 second ago   Up 1 second            practice
```

| Flag | What it does |
|---|---|
| `-d` | Run in the background |
| `--name` | Give it a name instead of using the ID |
| `-it` | Interactive with a terminal |
| `--rm` | Delete it when it stops |
| `-p 8080:80` | Map host port 8080 to container port 80 |
| `-e KEY=value` | Set an environment variable |
| `-v /host:/container` | Mount a folder or volume |

## docker exec

```bash
$ docker exec practice bash -c 'mkdir /demo && echo "hello docker" > /demo/test.txt && cat /demo/test.txt'
hello docker

$ docker exec practice bash -c 'hostname; whoami'
a6096a7e8773
root
```

The hostname inside the container is its own container ID.

The process list inside was the most interesting part:

```bash
$ docker exec practice ps -ef
UID    PID  PPID  C STIME TTY   TIME     CMD
root     1     0  0 11:43 ?     00:00:00 sleep 600
root    22    14  0 11:43 ?     00:00:00 ps -ef
```

**PID 1 is `sleep 600`.** On a normal machine PID 1 is systemd and there are hundreds of
processes. Inside the container there are only a few, and the main command is PID 1. That is
also why the container stops when that command stops.

`docker exec` is not the same as `docker run`. `run` makes a new container from an image,
`exec` runs something inside a container that is already running.

## Stop, start, remove

```bash
$ docker stop practice
practice

$ docker ps
(nothing, because docker ps only shows running containers)

$ docker ps -a
CONTAINER ID   IMAGE          COMMAND       STATUS                     NAMES
a6096a7e8773   ubuntu:24.04   "sleep 600"   Exited (137) 1 second ago  practice
```

`Exited (137)` means it was killed with signal 9. `docker stop` asks nicely first and then
forces it, and `sleep` does not respond to the request.

## The writable layer

Starting it again keeps my file:

```bash
$ docker start practice
$ docker exec practice cat /demo/test.txt
hello docker
```

But removing the container and making a new one from the same image loses it:

```bash
$ docker rm practice
$ docker run -d --name practice2 ubuntu:24.04 sleep 600
$ docker exec practice2 cat /demo/test.txt
cat: /demo/test.txt: No such file or directory
```

This was the important test. My file was in the container's writable layer, not in the image.
Stop and start keep that layer but `docker rm` throws it away. The image never changed, which
is why the new container was clean.

So anything that needs to survive the container being replaced has to go in a volume or a
bind mount. That is the whole reason volumes exist, and there is an example in
[docker-networking](../docker-networking).

## Logs and inspect

```bash
$ docker logs multistage-app

> docker-hello-world@1.0.0 start
> node server.js

Server running on port 3000
```

Docker saves whatever the main process prints. This is why an app in a container should print
its logs instead of writing them to a file inside the container, because that file goes away
with the container.

```bash
$ docker inspect multistage-app --format 'State: {{.State.Status}}
IP address: {{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}'
State: running
IP address: 172.17.0.9
```

Every container gets its own IP on a Docker network.

---

## Images and layers

An image is a stack of read only layers. Every instruction in the Dockerfile that changes
files makes one.

```bash
$ docker history hello-python
IMAGE          CREATED         CREATED BY                                      SIZE
13a37a7acc32   2 minutes ago   CMD ["python" "app.py"]                         0B
<missing>      2 minutes ago   EXPOSE [5000/tcp]                               0B
<missing>      2 minutes ago   COPY app.py .                                   12.3kB
<missing>      2 minutes ago   RUN pip install --no-cache-dir -r requirements  15.5MB
<missing>      2 minutes ago   COPY requirements.txt .                         12.3kB
<missing>      2 minutes ago   WORKDIR /app                                    8.19kB
<missing>      6 days ago      CMD ["python3"]                                 0B
<missing>      6 days ago      RUN set -eux; savedAptMark=...                  44.6MB
<missing>      7 days ago      # debian.sh --arch 'arm64'                      109MB
```

Reading it from the bottom, 109 MB is the Debian base and only the top six lines are mine. So
most of the image is not my code, which is why picking the base image matters.

`EXPOSE` and `CMD` are 0B because they are only information, they do not change any files.

## The build cache

Docker caches every layer, and if one layer changes then everything after it has to be built
again.

Rebuilding with no changes:

```bash
$ docker build -t hello-python .
#6 [3/5] COPY requirements.txt .
#6 CACHED
#8 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED
#9 [5/5] COPY app.py .
#9 CACHED
```

Then I changed one line in `app.py` and built again:

```bash
$ docker build -t hello-python .
#6 [3/5] COPY requirements.txt .
#6 CACHED
#8 [4/5] RUN pip install --no-cache-dir -r requirements.txt
#8 CACHED
#9 [5/5] COPY app.py .
```

`pip install` was still cached and only `COPY app.py` ran again. That is because I copy
`requirements.txt` first and install, and only then copy the code. If the Dockerfile had
`COPY . .` before `pip install`, then changing one letter of Python would make pip download
everything again.

**So put things that rarely change at the top of the Dockerfile and the source code at the
bottom.**

## Image commands

```bash
docker images                    # list images
docker pull nginx:alpine         # download without running
docker build -t name .           # build from the Dockerfile here
docker history name              # show the layers
docker rmi name                  # delete an image
```

`nginx:alpine` is `repository:tag`. If the tag is left out Docker uses `latest`, but `latest`
is only a name and it changes over time, so I used real versions like `node:22-alpine` and
`python:3.12-slim` everywhere.

## Cleaning up

```bash
docker stop $(docker ps -q)       # stop all running containers
docker rm $(docker ps -aq)        # remove all containers
docker rmi -f $(docker images -q) # remove all images
docker system prune -a            # remove everything not in use
```

`docker ps -q` prints only the IDs, so `docker rm $(docker ps -aq)` becomes
`docker rm id1 id2 id3`.

I was careful with these because I have other containers on my laptop for different work, so
I removed mine by name instead:

```bash
docker rm -f react-app python-web java-web apache-web multistage-app
```

## What I understood

- A container runs only as long as its main process, and that process is PID 1 inside it.
- `docker rm` deletes the writable layer, so data has to go in a volume to survive.
- `docker run` makes a new container, `docker start` restarts an old one, `docker exec` runs
  something in a container that is already running.
- The order of lines in a Dockerfile decides how much gets rebuilt every time.
