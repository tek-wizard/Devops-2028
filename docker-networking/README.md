# Docker Networking and Volumes (Session 8)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework

1. Create three containers (frontend, backend and DB) using three different networks. Use
   nginx or Alpine for frontend and backend and MySQL for the DB. Create three networks, add
   the backend container to two networks, and check the connectivity between each container.
2. Use the Apache2 image with the host network, pull it from Docker Hub, create a container
   with the host network and access it on port 80.
3. Bind mount exercise: make a folder with an `index.html` saying "Hello students", bind mount
   it to an nginx container, access the site, then change the file and check the change shows
   without restarting the container. Add screenshots.
4. Research overlay networks and how they work across multiple Docker hosts.

---

## Network drivers

```bash
$ docker network ls
NETWORK ID     NAME      DRIVER    SCOPE
d501038d03a6   bridge    bridge    local
8996f04dbe9d   host      host      local
04c299809c2a   none      null      local
```

`bridge`, `host` and `none` are made by Docker and are always there.

| Driver | What it does |
|---|---|
| `bridge` | A private network on one machine. The default |
| `host` | The container shares the host's network directly |
| `none` | No network at all |
| `overlay` | One network across many Docker hosts |
| `macvlan` | The container looks like a physical machine on the LAN |

One thing to know: on a network I create myself, containers can reach each other by container
name because Docker runs a small DNS server. On the default bridge that does not work and you
have to use IP addresses. That is why all the tasks below create their own network.

---

# Task 1: Three containers on three networks

## Step 1: create the networks

```bash
$ docker network create frontend-net
$ docker network create backend-net
$ docker network create db-net

$ docker network ls --filter driver=bridge
NETWORK ID     NAME           DRIVER    SCOPE
9de2324f0742   backend-net    bridge    local
915c493aa6d4   db-net         bridge    local
351fdae46894   frontend-net   bridge    local
```

## Step 2: one container on each network

```bash
$ docker run -d --name frontend --network frontend-net nginx:alpine
$ docker run -d --name backend  --network backend-net  nginx:alpine
$ docker run -d --name db --network db-net \
    -e MYSQL_ROOT_PASSWORD=devops123 -e MYSQL_DATABASE=classdb mysql:8.0

$ docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}'
NAMES      IMAGE          STATUS
db         mysql:8.0      Up 3 seconds
backend    nginx:alpine   Up 3 seconds
frontend   nginx:alpine   Up 3 seconds
```

Each one got an address on a different subnet:

```
frontend: frontend-net = 172.20.0.2
backend:  backend-net  = 172.21.0.2
db:       db-net       = 172.22.0.2
```

Docker gave each network its own subnet, and each container is `.0.2` because `.0.1` is the
gateway.

## Step 3: connectivity before connecting anything

```bash
$ docker exec frontend ping -c 2 backend
ping: bad address 'backend'

$ docker exec frontend ping -c 2 db
ping: bad address 'db'

$ docker exec backend ping -c 2 db
ping: bad address 'db'
```

All three fail. What I did not expect is the error. It is not a timeout, it says
**bad address**, which means the name could not even be turned into an IP. So Docker's DNS
only knows about containers on the same network.

I tried the raw IP to see if it was only DNS:

```bash
$ docker exec frontend ping -c 2 172.21.0.2
2 packets transmitted, 0 packets received, 100% packet loss
```

100% loss, so it is blocked both ways. The name does not work and the packets do not get
through either.

## Step 4: add backend to a second network

```bash
$ docker network connect frontend-net backend

$ docker inspect backend --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} = {{$v.IPAddress}}
{{end}}'
backend-net = 172.21.0.2
frontend-net = 172.20.0.3
```

The backend is now on two networks and has **two IP addresses**, one for each. I did not have
to restart it.

## Step 5: connectivity after

```bash
$ docker exec frontend ping -c 2 backend
64 bytes from 172.20.0.3: seq=1 ttl=64 time=0.195 ms
2 packets transmitted, 2 packets received, 0% packet loss

$ docker exec backend ping -c 2 frontend
64 bytes from 172.20.0.2: seq=1 ttl=64 time=0.177 ms
2 packets transmitted, 2 packets received, 0% packet loss
```

It works both ways now. `backend` came back as 172.20.0.3, the address on the shared network,
not the other one.

The frontend still cannot reach the database, which is the point:

```bash
$ docker exec frontend ping -c 2 db
ping: bad address 'db'
```

## Step 6: connecting backend to the database too

```bash
$ docker network connect db-net backend

$ docker exec backend ping -c 2 db
2 packets transmitted, 2 packets received, 0% packet loss

$ docker exec backend sh -c 'nc -z -w 3 db 3306 && echo "port 3306 on db is open"'
port 3306 on db is open
```

`ping` only shows the machine answers. Checking port 3306 shows MySQL is really listening.

And the frontend still cannot get there:

```bash
$ docker exec frontend sh -c 'nc -z -w 3 db 3306 || echo "frontend still cannot reach the database"'
nc: bad address 'db'
frontend still cannot reach the database
```

This is why separate networks are useful. The frontend is the part open to the internet, and
with this setup it has no way to reach the database at all. The backend in the middle is the
only way through.

The database is working:

```bash
$ docker exec db mysql -uroot -pdevops123 -e "SELECT VERSION(); SHOW DATABASES;"
VERSION()
8.0.46
Database
classdb
information_schema
mysql
performance_schema
sys
```

## Step 7: looking at the networks

```bash
$ docker network inspect frontend-net
Name: frontend-net
Driver: bridge
Subnet: 172.20.0.0/16  Gateway: 172.20.0.1
Containers:
  frontend -> 172.20.0.2/16
  backend -> 172.20.0.3/16
```

## What the container sees

This is the part that made it click for me:

```bash
$ docker exec backend ip addr
11: eth0: inet 172.21.0.2/16 scope global eth0
12: eth1: inet 172.20.0.3/16 scope global eth1
14: eth2: inet 172.22.0.3/16 scope global eth2
```

**Three networks means three network interfaces.** The container really gets a separate
network card for each network it is on.

```bash
$ docker exec backend cat /etc/resolv.conf
nameserver 127.0.0.11
```

`127.0.0.11` is Docker's own DNS server. That is why `ping backend` works, and why it said
bad address earlier when the containers were on different networks.

---

# Task 2: Apache with the host network

```bash
$ docker pull httpd:2.4
Status: Image is up to date for httpd:2.4

$ docker run -d --name apache-host --network host httpd:2.4

$ docker ps --filter name=apache-host
CONTAINER ID   IMAGE       COMMAND              STATUS         PORTS   NAMES
3d781cedb293   httpd:2.4   "httpd-foreground"   Up 3 seconds           apache-host
```

There is no `-p` flag and the PORTS column is empty. That is correct, because with the host
network there is nothing to map, the container is already using the host's network and Apache
binds port 80 directly.

```bash
$ docker inspect apache-host --format 'NetworkMode: {{.HostConfig.NetworkMode}}
Ports: {{json .NetworkSettings.Ports}}'
NetworkMode: host
Ports: {}
```

The hostname shows it is really sharing the host's network:

```bash
$ docker exec apache-host hostname
docker-desktop
$ docker exec frontend hostname
62b54cd2415c
```

The host network container shows the host's name, not a container ID.

```bash
$ docker run --rm --network host curlimages/curl -i http://localhost:80
HTTP/1.1 200 OK
Server: Apache/2.4.68 (Unix)
Content-Length: 191

<html><head><title>It works! Apache httpd</title></head>
```

## One problem I hit

Trying it from my Mac first did not work:

```bash
$ curl -i http://localhost:80
curl: (7) Failed to connect to localhost port 80
```

Docker does not run directly on macOS, it runs a small Linux virtual machine and the
containers are inside it. So with `--network host` the host is that virtual machine, not my
MacBook. Apache did bind port 80, but port 80 of the VM. With `-p 8084:80` Docker Desktop
forwards the port into the VM, but the host network skips that, so nothing forwards it.

That is why I checked it with a second container also using the host network, which shares the
same network and got a 200. On a real Linux machine `curl http://localhost:80` would have
worked straight away.

For the screenshot I ran the same image on the bridge network with a port mapping:

```bash
$ docker run -d --name apache-bridge -p 80:80 httpd:2.4
$ docker ps --filter name=apache-bridge
CONTAINER ID   IMAGE       COMMAND              STATUS         PORTS                  NAMES
bc5b52a44c7c   httpd:2.4   "httpd-foreground"   Up 3 seconds   0.0.0.0:80->80/tcp     apache-bridge
```

Comparing the two `docker ps` lines is the clearest difference. The host network has an empty
PORTS column and the bridge one shows `0.0.0.0:80->80/tcp`.

![Apache on port 80](screenshots/apache-on-port-80.jpg)

## bridge and host compared

| | bridge | host |
|---|---|---|
| Container IP | Yes, private | None, uses the host's |
| Port mapping | Needed | Not possible and not needed |
| Two containers on port 80 | Fine | Only one can |
| Reach other containers by name | Yes | No |
| Speed | Slightly slower | Faster |
| Isolation | Good | None |

Host networking looks easier but it gives up the isolation, which is most of the reason to use
containers, and two containers can never both use port 80.

---

# Task 3: Bind mount

## Step 1: the folder on my laptop

```bash
$ pwd
/Users/prateeksingh/Desktop/devops-2028/docker-networking/bind-mount-demo
$ ls -l
-rw-r--r--  1 prateeksingh  staff  242 31 Aug 17:16 index.html
```

`index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Bind Mount Demo</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello students</h1>
  </body>
</html>
```

## Step 2: mount it into nginx

```bash
$ docker run -d --name nginx-bind -p 8085:80 \
    -v "$PWD":/usr/share/nginx/html:ro \
    nginx:alpine

$ docker ps --filter name=nginx-bind --format 'table {{.Names}}\t{{.Ports}}'
NAMES        PORTS
nginx-bind   0.0.0.0:8085->80/tcp
```

The host path has to be a full path, so I used `$PWD` instead of `.`. The `:ro` makes it read
only inside the container, because nginx only needs to read the page.

There is no `docker build` here. The image is plain `nginx:alpine` and my file goes in when
the container runs.

## Step 3: it works

```bash
$ curl http://localhost:8085
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Bind Mount Demo</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello students</h1>
  </body>
</html>
```

![Hello students page](screenshots/bind-mount-before-edit.jpg)

## Step 4: change the file

First I noted the start time so I could prove the container was not restarted:

```bash
$ docker inspect nginx-bind --format 'StartedAt: {{.State.StartedAt}}'
StartedAt: 2026-08-31T11:46:45.464493628Z
```

Then I edited `index.html` on my laptop, nothing else:

```html
<h1>Hello students, this line was edited on my laptop</h1>
<p>The container was never restarted. Bind mount by Prateek Singh.</p>
```

And loaded the page again with no restart and no rebuild:

```bash
$ curl http://localhost:8085
    <h1>Hello students, this line was edited on my laptop</h1>
    <p>The container was never restarted. Bind mount by Prateek Singh.</p>
```

The container was not touched:

```bash
$ docker inspect nginx-bind --format 'StartedAt: {{.State.StartedAt}}'
StartedAt: 2026-08-31T11:46:45.464493628Z
$ docker ps --filter name=nginx-bind --format '{{.Names}} {{.Status}}'
nginx-bind Up 3 minutes
```

Same start time as before the edit.

![Page after editing the file](screenshots/bind-mount-after-edit.jpg)

The copy of `index.html` in this repo is the original "Hello students" one, so the task can be
run again from the start.

This works because a bind mount is not a copy. The folder on my laptop is mounted into the
container, so both sides are reading the same file. There is nothing to sync.

That is why bind mounts are used for development, edit a file and refresh the browser. They
are not used in production because then the container would depend on a folder existing on a
particular machine.

---

# Volumes

Session 8 also covered volumes, so I tried the other type.

```bash
$ docker volume create mydata
mydata

$ docker volume inspect mydata
[
    {
        "Driver": "local",
        "Mountpoint": "/var/lib/docker/volumes/mydata/_data",
        "Name": "mydata"
    }
]
```

The mountpoint is inside Docker's own folder, I did not choose it.

Writing from one container and reading from another:

```bash
$ docker run --rm -v mydata:/data alpine sh -c 'echo "written by the first container" > /data/notes.txt'
$ docker run --rm -v mydata:/data alpine cat /data/notes.txt
written by the first container
```

Both containers used `--rm` so both were deleted, but the data is still there because it is in
the volume and not in the container.

| | Bind mount | Named volume |
|---|---|---|
| How to write it | `-v /full/host/path:/container/path` | `-v volumename:/container/path` |
| Where the data is | A folder I choose | Docker's own storage |
| Editing from the host | Easy | Not easy |
| Main use | Development, config files | Databases and app data |

---

# Task 4: Overlay networks

This is the research part. I could not actually build one because an overlay network needs more
than one Docker host and I only have one laptop, so these are notes from the Docker docs.

## The problem

Every network in the tasks above is a bridge, and a bridge only exists on one machine. The
`172.20.0.x` addresses on my laptop mean nothing anywhere else. So once an app runs on more
than one server, a frontend on server A cannot reach a database on server B, because the two
bridges have never heard of each other.

An **overlay network** is one network that spreads across many Docker hosts. Containers on it
get addresses from one address space, and a container on host A can reach a container on host
B by container name, the same way `frontend` reached `backend` in task 1. From inside the
container it looks like one normal network.

## How it works

There are two networks on top of each other:

- the **underlay** is the real network between the servers
- the **overlay** is the virtual container network on top of it

When a container sends a packet to a container on another host, Docker wraps that packet inside
a normal packet addressed to the other host, using VXLAN on UDP port 4789. The real network
just sees normal traffic between two servers. Docker on the other side unwraps it and gives the
original packet to the right container.

For this to work Docker needs to keep a shared list of which containers exist and which host
each one is on. That is why overlay networks need Swarm mode, because the Swarm managers hold
that information and share it with all the nodes, and keep a shared DNS so names work across
hosts.

Because the wrapping adds a header, there is less space left for real data, so overlay networks
usually use an MTU around 1450 instead of 1500. Encryption is off by default because it costs
CPU, and can be turned on with `--opt encrypted`.

## Commands

```bash
docker swarm init                      # on the manager machine
docker swarm join --token ... ip:2377  # on the other machines
docker network create -d overlay --attachable my-overlay
docker service create --name web --network my-overlay --replicas 3 nginx:alpine
docker node ls
docker service ls
```

`--attachable` is needed if normal `docker run` containers should also be able to join. In
`docker network ls` an overlay network shows `swarm` in the SCOPE column instead of `local`.

## Where it is used

- Apps spread over several servers that need to find each other by name
- Replacing a container with a new one on a different host without changing any configuration
- Keeping internal traffic internal, so only the public entry point needs a port open
- Adding another server just means joining it to the swarm

Kubernetes does the same thing in a similar way, so understanding overlay networks helps for
Kubernetes networking later.

---

# All the commands together

```bash
# Task 1
docker network create frontend-net
docker network create backend-net
docker network create db-net
docker run -d --name frontend --network frontend-net nginx:alpine
docker run -d --name backend  --network backend-net  nginx:alpine
docker run -d --name db --network db-net -e MYSQL_ROOT_PASSWORD=devops123 -e MYSQL_DATABASE=classdb mysql:8.0
docker exec frontend ping -c 2 backend          # fails
docker network connect frontend-net backend
docker exec frontend ping -c 2 backend          # works
docker network connect db-net backend
docker exec frontend ping -c 2 db               # still fails, which is correct

# Task 2
docker pull httpd:2.4
docker run -d --name apache-host --network host httpd:2.4

# Task 3
cd bind-mount-demo
docker run -d --name nginx-bind -p 8085:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
curl http://localhost:8085

# Clean up
docker rm -f frontend backend db apache-host apache-bridge nginx-bind
docker network rm frontend-net backend-net db-net
docker volume rm mydata
```

# What I understood

- Two different networks are really separate. The name does not work and the packets do not
  get through either.
- A container on three networks gets three network interfaces and three IP addresses.
- `docker network connect` works on a running container without restarting it.
- Docker's DNS at `127.0.0.11` is what makes container names work, and it only answers for
  containers on the same network.
- The host network is faster but gives up isolation, and on macOS the host is the Docker
  Desktop VM and not the Mac.
- A bind mount is not a copy, both sides read the same file, which is why an edit shows up
  with no restart.
