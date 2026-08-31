# DevOps 2028

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

My homework for the DevOps class. Each folder has its own README with the commands I ran and
the output I got.

| Topic | Folder |
|---|---|
| Linux Fundamentals | [linux-fundamentals](linux-fundamentals) |
| Shell Scripting | [shell-scripting](shell-scripting) |
| Networking | [networking](networking) |
| Git and GitHub | [git-and-github](git-and-github) |
| Docker Fundamentals | [docker-fundamentals](docker-fundamentals) |
| Docker Images | [docker-images](docker-images) |
| Docker Networking | [docker-networking](docker-networking) |

I have a MacBook, so for the Linux commands I used an Ubuntu container to get the same
output as a normal Linux machine:

```bash
docker run -dit --name devops-lab --hostname devops-lab ubuntu:24.04 bash
docker exec -it devops-lab bash
```

That is why the hostname in the Linux output is `devops-lab` and the user is `root`.
