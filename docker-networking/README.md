# Docker Networking and Volumes (Session 8)

**Name:** Prateek Singh
**Enrollment number:** ENROLLMENT_PLACEHOLDER

## Homework that was given

1. Create three containers (frontend, backend and DB) using three different networks. Use
   nginx or Alpine for frontend and backend and MySQL for the DB. Create three networks, add
   the backend container to two networks, and check the connectivity between each container.
2. Use the Apache2 image with the host network. Pull it from Docker Hub, create a container
   using the host network, and access the Apache website directly on port 80.
3. Do the bind mount exercise. Create a folder on my machine with an `index.html` saying
   "Hello students", bind mount it into an nginx container, access the site, then change the
   file and check that the change shows up without restarting the container. Screenshots go
   in the README.
4. Research overlay networks, their use cases, and how they work across multiple Docker hosts.

All four are below, with screenshots for the bind mount task and for Apache.

---

## The network drivers first

```bash
$ docker network ls
NETWORK ID     NAME             DRIVER    SCOPE
d501038d03a6   bridge           bridge    local
b6b995124ae0   harbor-public    bridge    local
8996f04dbe9d   host             host      local
04c299809c2a   none             null      local
cd940fc93dfd   swe-rl_default   bridge    local
```

`bridge`, `host` and `none` are created by Docker itself and always exist. The other two on
my list are left over from an unrelated project on my laptop.

| Driver | What it does | When to use it |
|---|---|---|
| `bridge` | A private virtual switch on one host. The default | Almost everything on a single machine |
| `host` | The container shares the host's network stack directly | When you need maximum network performance or a port range too big to map |
| `none` | No networking at all, only loopback | A container that must not touch the network |
| `overlay` | One virtual network spread across many Docker hosts | Swarm or any multi host cluster |
| `macvlan` | The container gets its own MAC address and looks like a physical machine on the LAN | Old applications that expect to be on the physical network |
| `ipvlan` | Like macvlan but shares the host MAC | Similar, where the switch limits MAC addresses |

One thing worth knowing: the **default** `bridge` network and a bridge network you create
yourself do not behave the same. On a user created network, Docker runs an embedded DNS
server so containers can find each other by container name. On the default bridge that does
not work and you are stuck with IP addresses. That is why every exercise below creates its
own network instead of relying on the default.

---

# Task 1: Three containers, three networks, and network isolation

## Step 1: create the three networks

```bash
$ docker network create frontend-net
351fdae46894e46de201e7a493e0303c11039bed1c3ac4e30ba8cd45bfd362ed
$ docker network create backend-net
9de2324f07423a3bb3bf5f48569802ee88789e74b32e37a525e1f23ac4e7f197
$ docker network create db-net
915c493aa6d44caa7424632c41f4a7201535b9ff49b39931278c8c7daee2c3e0

$ docker network ls --filter driver=bridge
NETWORK ID     NAME             DRIVER    SCOPE
9de2324f0742   backend-net      bridge    local
d501038d03a6   bridge           bridge    local
915c493aa6d4   db-net           bridge    local
351fdae46894   frontend-net     bridge    local
b6b995124ae0   harbor-public    bridge    local
cd940fc93dfd   swe-rl_default   bridge    local
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

```bash
$ docker inspect frontend --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} = {{$v.IPAddress}}{{end}}'
frontend: frontend-net = 172.20.0.2
backend:  backend-net  = 172.21.0.2
db:       db-net       = 172.22.0.2
```

Docker handed out `172.20.0.0/16`, `172.21.0.0/16` and `172.22.0.0/16` on its own, one /16
per network, and each container is `.0.2` because `.0.1` is the gateway.

## Step 3: connectivity before connecting anything

```bash
$ docker exec frontend ping -c 2 -W 2 backend
ping: bad address 'backend'

$ docker exec frontend ping -c 2 -W 2 db
ping: bad address 'db'

$ docker exec backend ping -c 2 -W 2 db
ping: bad address 'db'
```

All three fail, which is the point. What surprised me is the error. It is not "request timed
out", it is **`bad address`**, which is a DNS failure. The name could not even be resolved
into an IP. So Docker's embedded DNS only tells a container about names on networks it is
actually attached to. Containers on other networks do not exist as far as it is concerned.

I wanted to know whether the block was only DNS or the network too, so I tried backend's raw
IP from frontend:

```bash
$ docker exec frontend ping -c 2 -W 2 172.21.0.2
PING 172.21.0.2 (172.21.0.2): 56 data bytes

--- 172.21.0.2 ping statistics ---
2 packets transmitted, 0 packets received, 100% packet loss
```

100% packet loss, so it is blocked at both levels. The name does not resolve, and even with
the right IP the packets do not get through. Two separate bridges with no route between
them.

## Step 4: add backend to a second network

```bash
$ docker network connect frontend-net backend

$ docker inspect backend --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} = {{$v.IPAddress}}
{{end}}'
backend-net = 172.21.0.2
frontend-net = 172.20.0.3
```

The backend container is now on two networks and has **two IP addresses**, one per network.
Note that `docker network connect` worked on a container that was already running, no
restart needed.

## Step 5: connectivity after

```bash
$ docker exec frontend ping -c 2 backend
64 bytes from 172.20.0.3: seq=1 ttl=64 time=0.195 ms

--- backend ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 0.195/0.476/0.758 ms

$ docker exec backend ping -c 2 frontend
64 bytes from 172.20.0.2: seq=1 ttl=64 time=0.177 ms

--- frontend ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 0.066/0.121/0.177 ms
```

It works both ways now. The detail worth noticing: frontend resolved `backend` to
**172.20.0.3**, the frontend-net address, not the 172.21.0.2 one. Docker's DNS gave back the
address on the network the two containers share.

And frontend still cannot reach the database, which is exactly the design:

```bash
$ docker exec frontend ping -c 2 -W 2 db
ping: bad address 'db'
$ docker exec backend ping -c 2 -W 2 db
ping: bad address 'db'
```

## Step 6: complete the three tier chain

```bash
$ docker network connect db-net backend

$ docker inspect backend --format '{{range $k, $v := .NetworkSettings.Networks}}{{$k}} = {{$v.IPAddress}}
{{end}}'
backend-net = 172.21.0.2
db-net = 172.22.0.3
frontend-net = 172.20.0.3
```

```bash
$ docker exec backend ping -c 2 db
--- db ping statistics ---
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 0.179/0.430/0.681 ms

$ docker exec backend sh -c 'nc -z -w 3 db 3306 && echo "port 3306 on db is open"'
port 3306 on db is open
```

`ping` only proves the machine answers ICMP. `nc -z` on port 3306 proves MySQL is actually
listening and reachable, which is what matters for a real app.

And the important check, that frontend still cannot get to the database:

```bash
$ docker exec frontend ping -c 1 -W 2 db
ping: bad address 'db'
$ docker exec frontend sh -c 'nc -z -w 3 db 3306 || echo "frontend still cannot reach the database"'
nc: bad address 'db'
frontend still cannot reach the database
```

This is the whole reason to bother with separate networks. The frontend is the part exposed
to the internet, so it is the part most likely to be attacked. With this layout it has no
route to the database at all. Even if someone took over the frontend container completely,
the database is not reachable from there. The backend sits in the middle as the only way
through.

The database is genuinely working, checked from inside:

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

## Step 7: what the networks look like

```bash
$ docker network inspect frontend-net
Name: frontend-net
Driver: bridge
Subnet: 172.20.0.0/16  Gateway: 172.20.0.1
Containers:
  frontend -> 172.20.0.2/16
  backend -> 172.20.0.3/16

$ docker network inspect db-net
Name: db-net
Subnet: 172.22.0.0/16
Containers:
  db -> 172.22.0.2/16
  backend -> 172.22.0.3/16
```

## Step 8: disconnecting takes it away again

```bash
$ docker network disconnect db-net backend
$ docker exec backend ping -c 1 -W 2 db
ping: bad address 'db'
```

Immediate, no restart. Then `docker network connect db-net backend` puts it back.

## What the container sees

This is the part that made networking click for me:

```bash
$ docker exec backend ip addr
11: eth0@if4277: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    inet 172.21.0.2/16 brd 172.21.255.255 scope global eth0
12: eth1@if4279: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    inet 172.20.0.3/16 brd 172.20.255.255 scope global eth1
14: eth2@if4282: <BROADCAST,MULTICAST,UP,LOWER_UP,M-DOWN> mtu 1500 qdisc noqueue state UP
    inet 172.22.0.3/16 brd 172.22.255.255 scope global eth2
```

**Three networks means three network interfaces.** `eth0`, `eth1` and `eth2`, one per
network, each with its own IP. Being on multiple Docker networks is not a software trick, the
container really does get a separate virtual network card for each one.

```bash
$ docker exec backend ip route
default via 172.21.0.1 dev eth0
172.20.0.0/16 dev eth1 scope link  src 172.20.0.3
172.21.0.0/16 dev eth0 scope link  src 172.21.0.2
172.22.0.0/16 dev eth2 scope link  src 172.22.0.3
```

One route per network telling the kernel which interface to use, and one default route for
anything else, which is how the container reaches the internet.

```bash
$ docker exec backend cat /etc/resolv.conf
nameserver 127.0.0.11
options ndots:0
```

`127.0.0.11` is Docker's embedded DNS server. That single line is why `ping backend` works
at all and why it failed with `bad address` earlier. Every DNS question the container asks
goes to Docker first, and Docker answers only for containers on shared networks, then
forwards anything else out to the real DNS.

---

# Task 2: Apache with the host network

## Pull and run

```bash
$ docker pull httpd:2.4
2.4: Pulling from library/httpd
Digest: sha256:979c38c2228d28c2edfd45c6e27dcee1c7b4a101a5526721ae8ece454e89e99e
Status: Image is up to date for httpd:2.4

$ docker run -d --name apache-host --network host httpd:2.4
3d781cedb2931ba84f21f1765df565bbdfbd692821707783e636ed6caf2e7c7b

$ docker ps --filter name=apache-host
CONTAINER ID   IMAGE       COMMAND              CREATED         STATUS         PORTS     NAMES
3d781cedb293   httpd:2.4   "httpd-foreground"   3 seconds ago   Up 3 seconds             apache-host
```

Notice there is **no `-p` flag** and the `PORTS` column is empty. That is correct and it is
the whole idea of the host network: there is nothing to map because the container is already
using the host's network stack. Apache binds port 80 on the host directly.

```bash
$ docker inspect apache-host --format 'NetworkMode: {{.HostConfig.NetworkMode}}
Ports published: {{json .NetworkSettings.Ports}}
Container IP: "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"'
NetworkMode: host
Ports published: {}
Container IP: "invalid IP"
```

No published ports and no container IP of its own, because it does not have a separate
network namespace to have an IP in. It uses the host's.

## Proof it is really sharing the host's network namespace

The hostname gives it away:

```bash
$ docker exec apache-host hostname
docker-desktop
$ docker exec frontend hostname
62b54cd2415c
```

The host network container reports the **host's** hostname, not a container ID.

So do the network interfaces:

```bash
$ docker exec apache-host cat /proc/net/dev | awk '{print $1}'
Inter-|
face
lo:
bond0:
dummy0:
eth0:
teql0:
...

$ docker exec frontend cat /proc/net/dev | awk '{print $1}'
Inter-|
face
lo:
tunl0:
gre0:
...
```

The host network container can see `eth0` and `bond0`, the host's real interfaces. The
bridge container only sees its own.

## Accessing it on port 80

```bash
$ docker run --rm --network host curlimages/curl:latest -i http://localhost:80
HTTP/1.1 200 OK
Date: Mon, 31 Aug 2026 11:46:17 GMT
Server: Apache/2.4.68 (Unix)
Last-Modified: Fri, 07 Nov 2025 08:23:08 GMT
ETag: "bf-642fce432f300"
Accept-Ranges: bytes
Content-Length: 191
Content-Type: text/html

<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.01//EN" "http://www.w3.org/TR/html4/strict.dtd">
<html>
<head>
<title>It works! Apache httpd</title>
</head>
```

I had to do it this way because of something I ran into, and it is worth writing down
properly.

## The macOS problem, and being honest about it

My first attempt from the Mac itself failed:

```bash
$ curl -i http://localhost:80
curl: (7) Failed to connect to localhost port 80 after 0 ms: Couldn't connect to server
```

The reason is that Docker does not run natively on macOS. There is no Linux kernel on a
Mac, so Docker Desktop runs a small Linux virtual machine and all containers live inside it.
When I say `--network host`, the "host" is that Linux VM, not my MacBook. Apache really did
bind port 80, but port 80 **of the VM**, and the VM's ports are not automatically shared with
macOS. With `-p 8084:80` Docker Desktop sets up a proxy from the Mac into the VM, and that
is why every other task in this repo is reachable from my browser. Host networking skips that
proxy on purpose, so there is nothing forwarding the port.

That is why I proved it with a second container also on the host network. Both containers
share the VM's network namespace, so `localhost:80` inside that namespace reaches Apache, and
it returned the Apache default page with a 200. On a real Linux machine
`curl http://localhost:80` from the terminal would have worked straight away, because there
is no VM in between.

For the browser screenshot I ran the same image on the bridge network with an explicit port
mapping, which is reachable from macOS:

```bash
$ docker run -d --name apache-bridge -p 80:80 httpd:2.4
$ docker ps --filter name=apache-bridge
CONTAINER ID   IMAGE       COMMAND              CREATED         STATUS         PORTS                                 NAMES
bc5b52a44c7c   httpd:2.4   "httpd-foreground"   3 seconds ago   Up 3 seconds   0.0.0.0:80->80/tcp, [::]:80->80/tcp   apache-bridge
```

Compare the two `docker ps` lines. Host network has an empty `PORTS` column, bridge shows
`0.0.0.0:80->80/tcp`. Same image, same port 80, two different ways of getting there.

![Apache served on port 80](screenshots/apache-on-port-80.jpg)

`http://localhost:80`

## Bridge and host side by side

| | bridge | host |
|---|---|---|
| Network namespace | Its own | Shared with the host |
| Container IP | Yes, private, like 172.20.0.2 | None, it uses the host's |
| Port mapping | Needed, `-p 8080:80` | Not possible, and not needed |
| Two containers on the same port | Fine, they are separate namespaces | Conflict, only one can bind port 80 |
| Container to container by name | Yes on a user created network | No, no Docker DNS |
| Speed | Slightly slower, packets go through NAT | Fastest, no translation at all |
| Isolation | Good | None, the container can see all host interfaces |
| Works on macOS and Windows | Yes | Only inside the Linux VM |

Host networking is not the convenient shortcut it looks like. It gives up the isolation,
which is most of the reason to use containers, and it means two containers can never both
use port 80. The real reasons to use it are performance sensitive network tools and apps
that need a huge range of ports where mapping each one is not practical.

---

# Task 3: Bind mount

## Step 1: the folder on my laptop

```bash
$ pwd
/Users/prateeksingh/Desktop/devops-2028/docker-networking/bind-mount-demo
$ ls -l
total 8
-rw-r--r--@ 1 prateeksingh  staff  242 31 Aug 17:16 index.html
```

`index.html` at that point:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
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
0406f8e7c7a433e69ff3fea9234b101131a91eb791eba85a6799be01b372eed9

$ docker ps --filter name=nginx-bind --format 'table {{.Names}}\t{{.Ports}}\t{{.Status}}'
NAMES        PORTS                                     STATUS
nginx-bind   0.0.0.0:8085->80/tcp, [::]:8085->80/tcp   Up 3 seconds
```

Notes on the flags:

- The host path has to be absolute, so `$PWD` rather than `.`. A relative path makes Docker
  think it is a named volume instead.
- `:ro` makes it read only inside the container. nginx only needs to read the page, so there
  is no reason to let it write into a folder on my laptop.
- No `docker build` anywhere. The image is plain `nginx:alpine` and my file arrives at run
  time, which is the difference from `COPY` in a Dockerfile.

## Step 3: it serves my page

```bash
$ curl http://localhost:8085
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Bind Mount Demo</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello students</h1>
  </body>
</html>
```

![Bind mounted page showing Hello students](screenshots/bind-mount-before-edit.jpg)

`http://localhost:8085`

## Step 4: change the file and check it live

First I noted the container's start time so I could prove afterwards that it was never
restarted:

```bash
$ docker inspect nginx-bind --format 'StartedAt: {{.State.StartedAt}}'
StartedAt: 2026-08-31T11:46:45.464493628Z
```

Then I edited `index.html` in the folder on my laptop, nothing else:

```html
    <h1>Hello students, this line was edited on my laptop</h1>
    <p>The container was never restarted. Bind mount by Prateek Singh.</p>
```

And immediately requested the page again. No `docker restart`, no `docker build`, no
`docker cp`:

```bash
$ curl http://localhost:8085
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Bind Mount Demo</title>
  </head>
  <body style="font-family: sans-serif; text-align: center; margin-top: 80px;">
    <h1>Hello students, this line was edited on my laptop</h1>
    <p>The container was never restarted. Bind mount by Prateek Singh.</p>
  </body>
</html>
```

The new content is there. And the proof that the container was untouched:

```bash
$ docker inspect nginx-bind --format 'StartedAt: {{.State.StartedAt}}'
StartedAt: 2026-08-31T11:46:45.464493628Z
$ docker ps --filter name=nginx-bind --format '{{.Names}} {{.Status}}'
nginx-bind Up 3 minutes
```

Exactly the same start time as before the edit, and "Up 3 minutes" with no restart count.

![Bind mounted page after editing the file](screenshots/bind-mount-after-edit.jpg)

`http://localhost:8085` after the edit

The copy of `index.html` kept in this repo is the original "Hello students" version, so that
the task can be run again from the start. The edit above is the second version, shown in the
output and the screenshot.

The reason this works is that a bind mount is not a copy. The folder from my laptop is
mounted into the container's filesystem, so both sides are looking at the same bytes on the
same disk. There is nothing to sync. nginx opens the file fresh on each request and reads
whatever is there now.

This is why bind mounts are the standard way to develop. Editing a file in an editor and
refreshing the browser is instantly reflected, with no rebuild in the loop. And it is also
why they are not used in production: the container would then depend on a specific folder
existing on a specific machine, which defeats the point of a portable image.

---

## Named volumes, the other kind of mount

Session 8 covered volumes as well, so I tried the other type to see the difference.

```bash
$ docker volume create mydata
mydata
$ docker volume ls --filter name=mydata
DRIVER    VOLUME NAME
local     mydata

$ docker volume inspect mydata
[
    {
        "CreatedAt": "2026-08-31T11:55:23Z",
        "Driver": "local",
        "Labels": null,
        "Mountpoint": "/var/lib/docker/volumes/mydata/_data",
        "Name": "mydata",
        "Options": null,
        "Scope": "local"
    }
]
```

The `Mountpoint` is inside Docker's own storage area. I did not pick that path and I am not
supposed to go poking at it directly, Docker manages it.

Writing from one container and reading from a completely different one:

```bash
$ docker run --rm -v mydata:/data alpine sh -c 'echo "written by the first container" > /data/notes.txt; cat /data/notes.txt'
written by the first container

$ docker run --rm -v mydata:/data alpine cat /data/notes.txt
written by the first container
```

Both containers used `--rm`, so both were deleted straight after. The data is still there,
because it lives in the volume and not in either container's writable layer. That is the
answer to the disappearing file problem from the fundamentals session.

| | Bind mount | Named volume |
|---|---|---|
| Syntax | `-v /absolute/host/path:/container/path` | `-v volumename:/container/path` |
| Where the data lives | A folder I choose on the host | Docker's own storage, managed for me |
| Created by | Me, it must already exist | Docker, automatically if it is missing |
| Editing from the host | Easy, it is a normal folder | Awkward, it is inside Docker's internals |
| Portable | No, it depends on that path existing | Yes, the name is all that matters |
| Main use | Development, config files, source code | Databases and any real application data |

So: bind mounts for editing files during development, named volumes for data that has to
survive.

---

# Task 4: Overlay networks

This is the research part. I could not build a real one because an overlay network needs
more than one Docker host and I only have one laptop, so these are notes from the Docker
documentation the class linked plus what I understood from doing the bridge exercises above.

## The problem it solves

Every network in the tasks above is a `bridge`, and a bridge exists on exactly one machine.
`frontend-net` on my laptop is a virtual switch inside my laptop, and its `172.20.0.x`
addresses mean nothing anywhere else. Once an application grows past one machine, that stops
working. A frontend container on server A cannot reach a database container on server B,
because their bridges are separate things that have never heard of each other.

The obvious workaround is to publish ports on every host and have containers talk to each
other through host IP addresses and port numbers. That falls apart quickly: the addresses
have to be configured somewhere, they change when a container moves to a different host, and
every published port is another door open on the machine.

An **overlay network** is one virtual network that stretches across many Docker hosts.
Containers on it get addresses from a single address space, and a container on host A can
reach a container on host B by container name, exactly the way `frontend` reached `backend`
in task 1. From inside the container it looks like one flat network. It has no idea that the
container it is talking to is on a different physical machine.

## How it works

The word overlay is the explanation. There are two networks stacked on top of each other:

- The **underlay** is the real network between the hosts, real IPs, real switches, real
  cables.
- The **overlay** is the virtual container network laid on top of it.

When a container sends a packet to a container on another host, Docker wraps that whole
packet inside a normal packet addressed to the other host, using a tunnel protocol called
**VXLAN** on UDP port 4789. The physical network just sees ordinary traffic between two
servers. Docker on the receiving host unwraps it and hands the original packet to the target
container. That wrapping and unwrapping is called encapsulation, and it is what makes one
network appear to span many machines.

For this to work, Docker needs somewhere to keep the shared picture of the network: which
containers exist, what their addresses are, and which host each one is on. That is why
overlay networks need Swarm mode, or another key value store. Swarm's managers hold that
state and push it out to the nodes, and Docker keeps a distributed DNS in sync from it so
name lookups resolve to containers on other hosts. So an overlay network is not just a
tunnel, it is a tunnel plus cluster wide address management plus cluster wide DNS.

Because the tunnel adds a header to every packet, the space left for real data is smaller.
That is why overlay networks usually run with an MTU around 1450 instead of 1500. When an
application works on a bridge network and behaves strangely on an overlay, this is a
classic thing to check.

Encryption is optional and off by default, since encrypting everything costs CPU. It is
turned on per network with `--opt encrypted`, which encrypts the traffic in the tunnel with
IPsec.

## The commands

```bash
# On the machine that will be the manager
docker swarm init

# It prints a join command with a token, run that on the other machines
docker swarm join --token SWMTKN-1-xxxx 192.168.1.10:2377

# Create the overlay network on the manager
docker network create -d overlay --attachable my-overlay

# Deploy a service onto it. Replicas can land on any node in the swarm
docker service create --name web --network my-overlay --replicas 3 nginx:alpine

docker node ls          # the machines in the swarm
docker service ls       # the services running
docker network ls       # overlay networks show scope "swarm", not "local"
```

Two details worth remembering. `--attachable` is needed if plain `docker run` containers
should be able to join the network, otherwise only swarm services can. And in
`docker network ls` an overlay network shows `swarm` in the SCOPE column instead of `local`,
which is a quick way to tell them apart.

## Where it gets used

- Any application spread over several servers that needs its parts to find each other by
  name rather than by IP and port.
- Rolling deployments. A container can be replaced by a new one on a completely different
  host and the name still resolves, so nothing else has to be reconfigured.
- Keeping internal traffic internal. Services talk to each other over the overlay, and only
  the public entry point publishes a port. The database never needs a port open on any host.
- Scaling out. Adding a fourth server means joining it to the swarm, and containers on it are
  on the same network immediately.

Kubernetes solves the same problem in the same general way, with tools like Flannel and
Calico doing the encapsulation instead of Docker's built in overlay driver. So understanding
what an overlay does is groundwork for Kubernetes networking later.

## Honest summary of the four drivers

| Scope | Driver | Containers can find each other by name |
|---|---|---|
| One host, isolated | user created `bridge` | Yes, through Docker's DNS at 127.0.0.11 |
| One host, no isolation | `host` | No |
| Many hosts | `overlay` | Yes, through the swarm's distributed DNS |
| Looks like a physical machine on the LAN | `macvlan` | No, it uses the LAN's own DNS |

---

# Everything in one script

```bash
# Task 1
docker network create frontend-net
docker network create backend-net
docker network create db-net
docker run -d --name frontend --network frontend-net nginx:alpine
docker run -d --name backend  --network backend-net  nginx:alpine
docker run -d --name db --network db-net \
  -e MYSQL_ROOT_PASSWORD=devops123 -e MYSQL_DATABASE=classdb mysql:8.0
docker exec frontend ping -c 2 -W 2 backend        # fails, different networks
docker network connect frontend-net backend
docker exec frontend ping -c 2 backend             # works now
docker network connect db-net backend
docker exec backend sh -c 'nc -z -w 3 db 3306 && echo open'
docker exec frontend ping -c 1 -W 2 db             # still fails, and that is correct

# Task 2
docker pull httpd:2.4
docker run -d --name apache-host --network host httpd:2.4
docker run --rm --network host curlimages/curl:latest -i http://localhost:80

# Task 3
cd bind-mount-demo
docker run -d --name nginx-bind -p 8085:80 -v "$PWD":/usr/share/nginx/html:ro nginx:alpine
curl http://localhost:8085
# edit index.html, then
curl http://localhost:8085

# Volumes
docker volume create mydata
docker run --rm -v mydata:/data alpine sh -c 'echo hi > /data/notes.txt'
docker run --rm -v mydata:/data alpine cat /data/notes.txt

# Clean up
docker rm -f frontend backend db apache-host apache-bridge nginx-bind
docker network rm frontend-net backend-net db-net
docker volume rm mydata
```

# What I took away

- Two bridge networks are properly separate. The name does not resolve **and** the packets
  do not route, so it is real isolation and not just a naming trick.
- A container on three networks has three network interfaces and three IP addresses. It is
  not a shortcut, the kernel really gives it one virtual card per network.
- `docker network connect` and `disconnect` work on a running container with no restart.
- Docker's embedded DNS at `127.0.0.11` is what makes container names work, and it only
  answers for containers that share a network with the one asking.
- The host network gives up isolation and port mapping to gain speed, and on macOS the
  "host" is the Docker Desktop VM rather than the Mac, which is worth knowing before losing
  an hour to it.
- A bind mount is not a copy. Both sides read the same bytes on disk, which is why an edit
  shows up with no restart.
