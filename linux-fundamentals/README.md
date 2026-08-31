# Linux Fundamentals (Session 2)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework that was given

1. Learn about soft links and hard links in Linux. This was said to be an interview
   question that will come in the assessment.
2. Find out the difference between `adduser` and `useradd` for creating users, and figure
   out which one is the standard way and why the other one is not preferred.
3. Learn about the `journalctl` command and what it is for.
4. Go through the Linux command cheat sheet.

All four are covered below. I did not just read about them, I ran everything and pasted
the real output, including the errors I got on purpose so I could see what they look like.

## How I set up the lab

My laptop is a MacBook, so I made two Ubuntu containers to practise in.

The first one is a normal Ubuntu container. I used it for links, users and the cheat sheet:

```bash
docker run -dit --name devops-lab --hostname devops-lab ubuntu:24.04 bash
docker exec -it devops-lab bash
apt update
apt install -y procps iproute2 iputils-ping net-tools tree
```

The second one runs systemd as PID 1, because `journalctl` reads the systemd journal and
a plain container has no systemd running inside it. I built it with this Dockerfile:

```dockerfile
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq systemd systemd-sysv nginx procps && \
    rm -rf /var/lib/apt/lists/*
CMD ["/sbin/init"]
```

```bash
docker build -t systemd-ubuntu .
docker run -d --name systemd-lab --hostname systemd-lab --privileged --cgroupns=host \
  -v /sys/fs/cgroup:/sys/fs/cgroup:rw systemd-ubuntu
docker exec -it systemd-lab bash
```

```bash
$ systemctl is-system-running
running
```

---

# Task 1: Soft links and hard links

## The idea first

To understand links I first had to understand what a filename actually is in Linux.

When a file is saved, the actual data plus all the information about the file (size,
owner, permissions, timestamps) is stored in a structure called an **inode**. The inode
has a number, and that number is what the filesystem really uses. The filename is only a
label in the directory that points at the inode number.

So a filename and a file are two separate things. Once I understood that, both link types
made sense.

**A hard link** is a second filename pointing at the exact same inode. There is no
original and no copy, both names are equal. The file's data is only removed from the disk
once every name pointing at that inode is deleted.

**A soft link** (also called a symbolic link or symlink) is a completely different file
with its own inode. Inside it there is just a piece of text saying which path to go to
next. It is like a shortcut. If the file it points at is deleted or renamed, the soft link
is still there but it now points at nothing.

## Commands

```bash
ln original.txt hardlink.txt        # hard link, no flag
ln -s original.txt softlink.txt     # soft link, -s means symbolic
ls -li                              # -i shows the inode number
stat original.txt                   # full details including the link count
```

## What I actually ran

### Creating both links

```bash
$ echo "This is the original file" > original.txt
$ cat original.txt
This is the original file

$ ln original.txt hardlink.txt
$ ln -s original.txt softlink.txt
```

### `ls -l` already shows a difference

```bash
$ ls -l
total 8
-rw-r--r-- 2 root root 26 Aug 31 11:30 hardlink.txt
-rw-r--r-- 2 root root 26 Aug 31 11:30 original.txt
lrwxrwxrwx 1 root root 12 Aug 31 11:30 softlink.txt -> original.txt
```

Three things to notice here:

- `original.txt` and `hardlink.txt` both start with `-`, which means regular file, but
  `softlink.txt` starts with **`l`** which means link. The type letter gives it away.
- The number after the permissions is the **link count**. It is `2` for the original and
  the hard link because two names point at that inode. It is `1` for the soft link.
- The soft link line ends with `-> original.txt`, which is the path stored inside it.
- The size of the soft link is `12` bytes, which is exactly the number of characters in
  the text `original.txt`. So a soft link really is just a small file holding a path.

### `ls -li` proves the inode point

```bash
$ ls -li
total 8
807855 -rw-r--r-- 2 root root 26 Aug 31 11:30 hardlink.txt
807855 -rw-r--r-- 2 root root 26 Aug 31 11:30 original.txt
807856 lrwxrwxrwx 1 root root 12 Aug 31 11:30 softlink.txt -> original.txt
```

This is the clearest output of the whole exercise. `original.txt` and `hardlink.txt` have
the **same inode number 807855**, so they are literally the same file with two names. The
soft link has its own inode `807856`, so it is a different file.

### All three read the same content, and writing through any name changes the one file

```bash
$ cat original.txt
This is the original file
$ cat hardlink.txt
This is the original file
$ cat softlink.txt
This is the original file

$ echo "A new line added through the soft link" >> softlink.txt
$ cat original.txt
This is the original file
A new line added through the soft link
```

### `stat` shows the link count directly

```bash
$ stat original.txt
  File: original.txt
  Size: 65        	Blocks: 8          IO Block: 4096   regular file
Device: 0,67	Inode: 807855      Links: 2
Access: (0644/-rw-r--r--)  Uid: (    0/    root)   Gid: (    0/    root)
Access: 2026-08-31 11:30:37.882042000 +0000
Modify: 2026-08-31 11:30:37.882042000 +0000
Change: 2026-08-31 11:30:37.882042000 +0000
 Birth: 2026-08-31 11:30:37.879042000 +0000
```

`Links: 2` is the count of names pointing at inode 807855.

### The important test: delete the original

This is the test that shows the real difference.

```bash
$ rm original.txt
$ ls -li
total 4
807855 -rw-r--r-- 1 root root 65 Aug 31 11:30 hardlink.txt
807856 lrwxrwxrwx 1 root root 12 Aug 31 11:30 softlink.txt -> original.txt
```

The link count on the hard link dropped from `2` to `1`, because one of the two names is
gone. The soft link still says `-> original.txt` even though that file no longer exists.

```bash
$ cat hardlink.txt
This is the original file
A new line added through the soft link

$ cat softlink.txt
cat: softlink.txt: No such file or directory
```

The hard link still has all the data, because the data belongs to the inode and the inode
still has one name pointing at it. The soft link is now a **dangling link**, it points at
a path that has nothing at it. In `ls` output with colours these show up in red.

### Link count going up and down

```bash
$ echo hi > fresh.txt
$ ls -l fresh.txt
-rw-r--r-- 1 root root 3 Aug 31 11:30 fresh.txt

$ ln fresh.txt fresh2.txt
$ ln fresh.txt fresh3.txt
$ ls -l fresh.txt
-rw-r--r-- 3 root root 3 Aug 31 11:30 fresh.txt

$ rm fresh3.txt
$ ls -l fresh.txt
-rw-r--r-- 2 root root 3 Aug 31 11:30 fresh.txt
```

Each `ln` adds one to the count and each `rm` takes one away. The data only leaves the
disk when the count reaches zero.

### Limit 1: a hard link cannot point at a directory

```bash
$ mkdir mydir
$ ln mydir dirlink
ln: mydir: hard link not allowed for directory
```

Not allowed, because directories already contain the `.` and `..` entries and letting
users add more hard links between directories could create loops that tools like `find`
would never get out of. A soft link to a directory is completely fine:

```bash
$ ln -s mydir dirsoftlink
$ ls -l | grep dir
lrwxrwxrwx 1 root root    5 Aug 31 11:30 dirsoftlink -> mydir
drwxr-xr-x 2 root root 4096 Aug 31 11:30 mydir
```

### Limit 2: a hard link cannot cross filesystems

Inode numbers are only unique inside one filesystem, so a hard link cannot reach across
to a different one. In my container `/` and `/home/work` are two different filesystems:

```bash
$ df -h /root/linkdemo /home/work
Filesystem            Size  Used Avail Use% Mounted on
overlay               911G   53G  812G   7% /
/run/host_mark/Users  927G  269G  659G  29% /home/work

$ ln /root/linkdemo/crossfile.txt /home/work/crossfile-hard.txt
ln: failed to create hard link '/home/work/crossfile-hard.txt' => '/root/linkdemo/crossfile.txt': Invalid cross-device link
```

`Invalid cross-device link` is the error to remember. A soft link across the same two
filesystems works without any problem, because it only stores text:

```bash
$ ln -s /root/linkdemo/crossfile.txt /home/work/crossfile-soft.txt
$ ls -l /home/work/crossfile-soft.txt
lrwxr-xr-x 1 root root 28 Aug 31 11:30 /home/work/crossfile-soft.txt -> /root/linkdemo/crossfile.txt
$ cat /home/work/crossfile-soft.txt
test
```

## Side by side comparison

| | Hard link | Soft link |
|---|---|---|
| Command | `ln file link` | `ln -s file link` |
| Inode | Same inode as the original | Its own separate inode |
| What it stores | Nothing extra, it is another name for the same inode | The text of the target path |
| First letter in `ls -l` | `-` (regular file) | `l` (link) |
| Link count of the target | Goes up by one | Stays the same |
| Original gets deleted | Link keeps working, data is safe | Link breaks, becomes a dangling link |
| Can point at a directory | No | Yes |
| Can cross filesystems | No | Yes |
| Size | Same as the file | Only the length of the path text |
| Extra work to read it | None | One extra lookup to follow the path |

## Interview answer in short

A hard link is another name for the same inode, so the file survives even if the first
name is deleted, but it cannot be used on directories or across filesystems. A soft link
is a small separate file that holds a path, so it can point anywhere including at
directories and other filesystems, but it breaks if the target is moved or deleted.

## Where each one is used in real life

- Soft links are used everywhere in DevOps work. `/usr/bin/python3` is usually a soft link
  to the actual version, so the version can be swapped without changing every script.
  Deployments often keep a `current` soft link pointing at the release folder in use, and
  going back to the old release is just repointing that one link.
- Hard links are used by backup tools. If a file did not change between two backups the
  tool creates a hard link instead of copying the data again, so the second backup takes
  almost no extra space but still looks like a full copy.

```bash
$ ls -l /usr/bin/python3
lrwxrwxrwx 1 root root 10 Nov 12  2025 /usr/bin/python3 -> python3.12

$ ls -l /usr/bin/ | grep " -> " | head -5
lrwxrwxrwx 1 root root        21 Apr  8  2024 awk -> /etc/alternatives/awk
lrwxrwxrwx 1 root root         3 Jun 30 21:25 captoinfo -> tic
lrwxrwxrwx 1 root root         6 Apr 15 06:53 ctstat -> lnstat
lrwxrwxrwx 1 root root         8 Apr  8  2024 dnsdomainname -> hostname
lrwxrwxrwx 1 root root         8 Apr  8  2024 domainname -> hostname
```

---

# Task 2: `adduser` vs `useradd`

## What the two commands actually are

```bash
$ which useradd adduser
/usr/sbin/useradd
/usr/sbin/adduser

$ ls -l /usr/sbin/useradd /usr/sbin/adduser
-rwxr-xr-x 1 root root  55191 Jul  5  2023 /usr/sbin/adduser
-rwxr-xr-x 1 root root 142784 May 30  2024 /usr/sbin/useradd

$ head -3 /usr/sbin/adduser
#! /usr/bin/perl

# Copyright (C) 2000-2004 Roland Bauerschmidt <rb@debian.org>
```

This already answers most of the question. `useradd` is a compiled binary, it is part of
the shadow-utils package and it is present on every Linux distribution. `adduser` is a
**Perl script** written for Debian, and it calls `useradd` underneath. It is a friendly
wrapper, not a separate way of creating users.

## Test 1: `useradd` with no options

```bash
$ useradd testuser1
$ echo $?
0
```

No output at all. It just does the job silently. Now let me check what it created:

```bash
$ grep testuser1 /etc/passwd
testuser1:x:1001:1001::/home/testuser1:/bin/sh

$ grep testuser1 /etc/shadow
testuser1:!:20696:0:99999:7:::

$ ls -la /home | grep testuser1
no home directory for testuser1

$ getent passwd testuser1 | cut -d: -f7
/bin/sh
```

So plain `useradd`:

- made the account and the entry in `/etc/passwd`
- wrote `/home/testuser1` in the passwd entry but **did not actually create that folder**
- left the password field as `!` in `/etc/shadow`, which means the password is locked and
  the user cannot log in yet
- gave the shell `/bin/sh` instead of bash

The `/etc/passwd` line reads like this:

```
testuser1  :  x  :  1001  :  1001  :        :  /home/testuser1  :  /bin/sh
username      pw    UID     GID      comment    home directory     login shell
```

The `x` in the password field means the real password hash is kept in `/etc/shadow`, which
only root can read.

## Test 2: `adduser`

```bash
$ adduser --disabled-password --gecos "Prateek Test User,101,,," testuser2
info: Adding user `testuser2' ...
info: Selecting UID/GID from range 1000 to 59999 ...
info: Adding new group `testuser2' (1002) ...
info: Adding new user `testuser2' (1002) with group `testuser2 (1002)' ...
info: Creating home directory `/home/testuser2' ...
info: Copying files from `/etc/skel' ...
info: Adding new user `testuser2' to supplemental / extra groups `users' ...
info: Adding user `testuser2' to group `users' ...
```

Completely different experience. It tells me every single step. Checking the result:

```bash
$ grep testuser2 /etc/passwd
testuser2:x:1002:1002:Prateek Test User,101,,:/home/testuser2:/bin/bash

$ ls -la /home/testuser2
total 20
drwxr-x--- 2 testuser2 testuser2 4096 Aug 31 11:33 .
drwxr-xr-x 1 root      root      4096 Aug 31 11:33 ..
-rw-r--r-- 1 testuser2 testuser2  220 Aug 31 11:33 .bash_logout
-rw-r--r-- 1 testuser2 testuser2 3771 Aug 31 11:33 .bashrc
-rw-r--r-- 1 testuser2 testuser2  807 Aug 31 11:33 .profile

$ groups testuser2
testuser2 : testuser2 users
```

`adduser` created the home directory for real, copied the starter dotfiles out of
`/etc/skel`, set the owner correctly, used `/bin/bash` as the shell, and added the user to
an extra group. Normally it also stops and asks for a password and for the full name, room
number and phone numbers. I passed `--disabled-password` and `--gecos` only so it would
finish in one go while I was capturing the output.

## The two accounts next to each other

```bash
$ grep -E "testuser1|testuser2" /etc/passwd
testuser1:x:1001:1001::/home/testuser1:/bin/sh
testuser2:x:1002:1002:Prateek Test User,101,,:/home/testuser2:/bin/bash

$ ls /home
testuser2  ubuntu  work
```

`testuser1` is missing from `/home` completely. That is the trap with plain `useradd`.
The account exists and looks fine in `/etc/passwd`, but the moment that user logs in there
is no home directory, so the shell starts in a folder that does not exist and nothing
works properly.

## Test 3: `useradd` used correctly

`useradd` is not broken, it just does exactly what I ask and nothing more. With the right
flags it does the same job:

```bash
$ useradd -m -s /bin/bash -c "Prateek Singh" -G users testuser3
$ grep testuser3 /etc/passwd
testuser3:x:1003:1003:Prateek Singh:/home/testuser3:/bin/bash
$ ls -la /home/testuser3 | head -5
total 20
drwxr-x--- 2 testuser3 testuser3 4096 Aug 31 11:34 .
drwxr-xr-x 1 root      root      4096 Aug 31 11:34 ..
-rw-r--r-- 1 testuser3 testuser3  220 Mar 31  2024 .bash_logout
-rw-r--r-- 1 testuser3 testuser3 3771 Mar 31  2024 .bashrc
$ groups testuser3
testuser3 : testuser3 users
```

Useful `useradd` flags:

| Flag | What it does |
|---|---|
| `-m` | Actually create the home directory |
| `-d /path` | Use a different path for the home directory |
| `-s /bin/bash` | Set the login shell |
| `-c "text"` | Comment field, normally the person's full name |
| `-G group1,group2` | Add to extra groups |
| `-g group` | Set the primary group |
| `-u 1500` | Pick the UID by hand |
| `-e 2026-12-31` | Set an expiry date on the account |
| `-r` | Create a system account, used for service users like nginx |

The defaults `useradd` uses come from a config file, which is why the shell came out as
`/bin/sh`:

```bash
$ grep -vE "^#|^$" /etc/default/useradd
SHELL=/bin/sh
```

## Cleaning up

```bash
$ userdel testuser1
$ userdel -r testuser2
$ userdel -r testuser3
$ ls /home
ubuntu  work
```

`-r` also deletes the home directory. Without `-r` the account goes away but the folder
stays behind on disk.

## Comparison table

| | `useradd` | `adduser` |
|---|---|---|
| What it is | Compiled binary from shadow-utils | Perl script that calls `useradd` |
| Available on | Every Linux distribution | Debian and Ubuntu family only |
| Style | Low level, does only what the flags say | High level, asks questions and fills the gaps |
| Output | Silent | Prints every step |
| Home directory | Only with `-m` | Made automatically |
| Copies `/etc/skel` | Only with `-m` | Yes |
| Password | Left locked, has to be set with `passwd` | Asks for it while running |
| Default shell | Whatever is in `/etc/default/useradd` | `/bin/bash` |
| Works inside a script | Yes | No, it stops and waits for answers |

## Answer to the homework question

**`useradd` is the standard command.** It is the real low level tool, it is part of
shadow-utils, and it exists on every distribution: Ubuntu, Debian, RHEL, CentOS, Fedora,
SUSE, Amazon Linux, Alpine. `adduser` is a Debian and Ubuntu convenience script layered on
top of it, and on a RHEL type machine `adduser` is only a symlink to `useradd`, so all the
friendly behaviour is missing there anyway.

**Why `adduser` is not preferred**, especially for DevOps work:

1. **It is not portable.** A script using `adduser` breaks the moment it runs on a RHEL,
   Amazon Linux or Alpine host. `useradd` behaves the same everywhere.
2. **It is interactive.** It stops and waits for a password and for the name and phone
   fields. Inside a Dockerfile, an Ansible playbook, a cloud-init script or a CI job there
   is nobody there to type an answer, so the automation just hangs.
3. **Its behaviour is not fixed.** The defaults come from `/etc/adduser.conf`, so the same
   command can produce a different result on two machines. With `useradd -m -s /bin/bash`
   I have written down exactly what I want and the result is the same every time.
4. **Its output changes between versions.** The messages changed format in newer Ubuntu
   releases, which is a problem for any script trying to check what happened.

So the honest summary is: `adduser` is genuinely nicer when I am sitting at one Ubuntu
machine typing by hand. `useradd` with explicit flags is what belongs in anything
automated, and that is why it is treated as the standard.

## Related user commands I tried

| Command | What it does |
|---|---|
| `passwd username` | Set or change a password |
| `usermod -aG docker prateek` | Add a user to a group. The `-a` is important, without it the other groups get wiped |
| `userdel -r username` | Delete the user and the home directory |
| `groupadd devops` | Create a group |
| `groups username` | Show which groups a user is in |
| `id username` | Show UID, GID and all groups |
| `su - username` | Switch to that user |
| `chage -l username` | Show password expiry details |
| `getent passwd` | List accounts, works even when they come from LDAP and not just the file |

---

# Task 3: `journalctl`

## What it is for

Older Linux systems wrote logs as plain text files under `/var/log`, one file per service,
each in whatever format that service felt like using. On any system running systemd there
is one service called `systemd-journald` that collects everything instead: kernel
messages, boot messages, service output and anything an application sends to syslog. It
stores all of it in one indexed binary journal.

Because the journal is binary I cannot read it with `cat` or `less`. `journalctl` is the
tool that reads it and lets me filter it.

The reason this matters for DevOps is that when a service will not start, `journalctl` is
where the actual reason is. That is the whole job of the command.

## The flags worth remembering

| Command | What it does |
|---|---|
| `journalctl` | Everything in the journal, oldest first |
| `journalctl -n 20` | Last 20 lines |
| `journalctl -f` | Follow live, like `tail -f`. Ctrl+C to stop |
| `journalctl -u nginx` | Only the logs of the nginx service |
| `journalctl -u nginx -f` | Follow one service live |
| `journalctl -xeu nginx` | The one to actually use when a service failed |
| `journalctl -b` | Only this boot |
| `journalctl -b -1` | The previous boot, for finding out why the machine went down |
| `journalctl --list-boots` | List the boots that are still stored |
| `journalctl -k` | Kernel messages only |
| `journalctl -p err` | Only error level and worse |
| `journalctl --since "1 hour ago"` | Time filter |
| `journalctl --since today --until "12:00"` | Time range |
| `journalctl -o json-pretty` | Full structured output with all fields |
| `journalctl --no-pager` | Print straight out instead of opening less, needed in scripts |
| `journalctl --disk-usage` | How much disk the journal is eating |
| `journalctl --vacuum-time=7d` | Delete journal entries older than 7 days |
| `journalctl --vacuum-size=200M` | Shrink the journal down to 200M |

The `-x` and `-e` in `-xeu` are worth knowing separately. `-e` jumps to the end, which is
where the newest and most relevant lines are. `-x` adds explanation text from systemd for
some messages. Together with `-u servicename` they make the standard command for looking
into a failure.

Priority levels for `-p`, from most to least serious: `emerg`, `alert`, `crit`, `err`,
`warning`, `notice`, `info`, `debug`.

## What I actually ran

### Last few lines

```bash
$ journalctl --no-pager -n 5
Aug 31 11:34:51 systemd-lab systemd[1]: Starting systemd-update-utmp-runlevel.service - Record Runlevel Change in UTMP...
Aug 31 11:34:51 systemd-lab systemd[1]: systemd-update-utmp-runlevel.service: Deactivated successfully.
Aug 31 11:34:51 systemd-lab systemd[1]: Finished systemd-update-utmp-runlevel.service - Record Runlevel Change in UTMP.
Aug 31 11:34:51 systemd-lab systemd[1]: Startup finished in 227ms.
Aug 31 11:35:07 systemd-lab systemd-resolved[72]: Clock change detected. Flushing caches.
```

Each line is date, hostname, then the process and its PID in brackets, then the message.

### Filtering to one service with `-u`

```bash
$ systemctl start nginx
$ systemctl is-active nginx
active

$ journalctl --no-pager -u nginx
Aug 31 11:34:50 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:34:50 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
```

### A restart shows up as stop then start

```bash
$ systemctl restart nginx
$ journalctl --no-pager -u nginx -n 6
Aug 31 11:34:50 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
Aug 31 11:35:14 systemd-lab systemd[1]: Stopping nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:14 systemd-lab systemd[1]: nginx.service: Deactivated successfully.
Aug 31 11:35:14 systemd-lab systemd[1]: Stopped nginx.service - A high performance web server and a reverse proxy server.
Aug 31 11:35:14 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:14 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
```

### Breaking nginx on purpose

Reading about a command is not the same as using it, so I broke the nginx config to see
what a real failure looks like.

```bash
$ echo "this_is_not_valid_nginx_config;" >> /etc/nginx/nginx.conf
$ systemctl restart nginx
Job for nginx.service failed because the control process exited with error code.
See "systemctl status nginx.service" and "journalctl -xeu nginx.service" for details.
$ echo $?
1
```

systemd itself tells me to go and use `journalctl`, which is a good sign of how central
this command is. First `systemctl status`:

```bash
$ systemctl status nginx --no-pager
× nginx.service - A high performance web server and a reverse proxy server
     Loaded: loaded (/usr/lib/systemd/system/nginx.service; enabled; preset: enabled)
     Active: failed (Result: exit-code) since Mon 2026-08-31 11:35:21 UTC; 4ms ago
   Duration: 7.131s
       Docs: man:nginx(8)
    Process: 162 ExecStartPre=/usr/sbin/nginx -t -q -g daemon on; master_process on; (code=exited, status=1/FAILURE)
        CPU: 4ms

Aug 31 11:35:21 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:21 systemd-lab nginx[162]: 2026/08/31 11:35:21 [emerg] 162#162: unknown directive "this_is_not_valid_nginx_config" in /etc/nginx/nginx.conf:84
Aug 31 11:35:21 systemd-lab nginx[162]: nginx: configuration file /etc/nginx/nginx.conf test failed
Aug 31 11:35:21 systemd-lab systemd[1]: Control process exited, code=exited, status=1/FAILURE
```

The `×` instead of a green dot means failed. Then the full picture from the journal:

```bash
$ journalctl --no-pager -u nginx -n 12
Aug 31 11:35:14 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
Aug 31 11:35:21 systemd-lab systemd[1]: Stopping nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:21 systemd-lab systemd[1]: nginx.service: Deactivated successfully.
Aug 31 11:35:21 systemd-lab systemd[1]: Stopped nginx.service - A high performance web server and a reverse proxy server.
Aug 31 11:35:21 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:21 systemd-lab nginx[162]: 2026/08/31 11:35:21 [emerg] 162#162: unknown directive "this_is_not_valid_nginx_config" in /etc/nginx/nginx.conf:84
Aug 31 11:35:21 systemd-lab nginx[162]: nginx: configuration file /etc/nginx/nginx.conf test failed
Aug 31 11:35:21 systemd-lab systemd[1]: nginx.service: Control process exited, code=exited, status=1/FAILURE
Aug 31 11:35:21 systemd-lab systemd[1]: nginx.service: Failed with result 'exit-code'.
Aug 31 11:35:21 systemd-lab systemd[1]: Failed to start nginx.service - A high performance web server and a reverse proxy server.
```

The line that matters is the one from `nginx[162]`, not the ones from `systemd[1]`. It
names the bad directive **and the exact line number in the config file**, line 84. That is
the whole point of the command: `systemctl restart` only says "it failed", the journal says
why it failed and where.

This is a real pattern that mixes both things I learned. `systemd[1]` lines are systemd
talking about the service, and the `nginx[162]` lines are the application's own output that
journald captured. Both end up in the same journal, which is exactly the problem systemd
set out to solve.

### Only errors

```bash
$ journalctl --no-pager -p err -n 10
Aug 31 11:35:21 systemd-lab systemd[1]: Failed to start nginx.service - A high performance web server and a reverse proxy server.
```

Out of a whole journal this narrows it down to one line. Useful on a machine that has been
running for weeks.

### Fixing it back

```bash
$ sed -i "/this_is_not_valid_nginx_config/d" /etc/nginx/nginx.conf
$ nginx -t
nginx: the configuration file /etc/nginx/nginx.conf syntax is ok
nginx: configuration file /etc/nginx/nginx.conf test is successful
$ systemctl start nginx && systemctl is-active nginx
active
```

Lesson for later: run `nginx -t` before restarting, so a typo never takes the site down.

### Time filter

```bash
$ journalctl --no-pager --since "10 min ago" -n 4
Aug 31 11:35:21 systemd-lab systemd[1]: nginx.service: Failed with result 'exit-code'.
Aug 31 11:35:21 systemd-lab systemd[1]: Failed to start nginx.service - A high performance web server and a reverse proxy server.
Aug 31 11:35:30 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
Aug 31 11:35:30 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
```

`--since` also takes plain words like `yesterday`, `today`, `"2 hours ago"` or a real
timestamp like `"2026-08-31 11:00:00"`.

### Boots and disk usage

```bash
$ journalctl --list-boots --no-pager
IDX BOOT ID                          FIRST ENTRY                 LAST ENTRY
  0 8c9dfc7a1379417d90fcde1977de7b85 Mon 2026-08-31 11:34:50 UTC Mon 2026-08-31 11:35:30 UTC

$ journalctl --disk-usage
Archived and active journals take up 8.0M in the file system.
```

Only one boot is listed because my container has only started once. On a real server there
would be a list, and `journalctl -b -1` would show the boot before this one, which is how
you find out why a machine rebooted on its own.

`--disk-usage` matters in practice. A busy server with a chatty service can let the
journal grow to gigabytes and fill the disk, which is why `journalctl --vacuum-time=7d`
exists. Whether the journal even survives a reboot depends on `Storage=` in
`/etc/systemd/journald.conf`. If it is `volatile` the journal only lives in memory under
`/run/log/journal` and is lost on restart, and if it is `persistent` it is written to
`/var/log/journal` and stays.

### Output formats

```bash
$ journalctl --no-pager -u nginx -n 2 -o short-iso
2026-08-31T11:35:30+00:00 systemd-lab systemd[1]: Starting nginx.service - A high performance web server and a reverse proxy server...
2026-08-31T11:35:30+00:00 systemd-lab systemd[1]: Started nginx.service - A high performance web server and a reverse proxy server.
```

The interesting one is `-o json`, because it shows that the journal is not storing plain
text lines at all, it is storing records with fields:

```bash
$ journalctl --no-pager -u nginx -n 1 -o json | head -c 400
{"_COMM":"systemd","_CMDLINE":"/sbin/init","JOB_RESULT":"done","_MACHINE_ID":"f5815563476a4e91aff6b1b6740197e3","__SEQNUM":"4161","UNIT":"nginx.service","JOB_ID":"291","_UID":"0","_BOOT_ID":"8c9dfc7a1379417d90fcde1977de7b85","_SOURCE_REALTIME_TIMESTAMP":"1788176130615193","SYSLOG_FACILITY":"3","_CAP_EFFECTIVE":"1ffffffffff","CODE_LINE":"796","_HOSTN
```

Fields like `_UID`, `_BOOT_ID` and `UNIT` are attached to every entry automatically, and
that is why filtering by unit or by boot is instant instead of a text search. It is also
why the logs cannot be quietly edited the way a plain text file in `/var/log` can be.

### Kernel messages

```bash
$ journalctl --no-pager -k -n 3
Aug 31 11:34:50 systemd-lab kernel: docker0: port 3(veth91234ac) entered forwarding state
Aug 31 11:34:50 systemd-lab systemd-journald[23]: Collecting audit messages is disabled.
Aug 31 11:34:50 systemd-lab systemd-journald[23]: Received client request to flush runtime journal.
```

The `veth` line is from Docker itself creating the virtual network interface for my
container, which connects back to the Docker networking session nicely.

## Short answer

`journalctl` is the command for reading the systemd journal, which is the single place all
logs go on a systemd machine. The reason to know it is that when a service will not start,
`journalctl -xeu servicename` gives the actual error message, while `systemctl` only says
that it failed.

---

# Task 4: Linux command cheat sheet

I went through the cheat sheet from the session 2 folder and instead of only reading it I
ran the commands and wrote down the output. Grouped by what they are for.

## Where am I and who am I

```bash
$ pwd
/root/cheat
$ whoami
root
$ id
uid=0(root) gid=0(root) groups=0(root)
$ uname -a
Linux devops-lab 6.12.76-linuxkit #1 SMP Thu May 28 18:54:18 UTC 2026 aarch64 aarch64 aarch64 GNU/Linux
```

| Command | What it tells me |
|---|---|
| `pwd` | The folder I am currently in |
| `whoami` | My username |
| `id` | My UID, GID and every group I am in |
| `hostname` | The machine name |
| `uname -a` | Kernel version and architecture |
| `uptime` | How long the machine has been up and the load average |
| `date` | Current date and time |
| `history` | The commands I ran earlier |

## Moving around and listing

| Command | What it does |
|---|---|
| `ls` | List files |
| `ls -l` | Long format with permissions, owner, size and date |
| `ls -a` | Include hidden files, the ones starting with a dot |
| `ls -lh` | Sizes in KB and MB instead of bytes |
| `ls -lt` | Newest first |
| `ls -li` | Show inode numbers |
| `ls -lR` | Go into subfolders too |
| `cd /path` | Go to a folder |
| `cd ..` | Go one level up |
| `cd ~` or `cd` | Go to my home folder |
| `cd -` | Go back to the folder I was in before |
| `tree` | Show the folder structure as a tree |

```bash
$ mkdir -p project/{src,logs,config}
$ tree project
project
|-- config
|-- logs
`-- src

4 directories, 0 files
```

That `{src,logs,config}` part is brace expansion, the same trick as `{1..5}` in the shell
scripting session. Bash turns it into three separate arguments, so one `mkdir -p` makes
all three folders.

```bash
$ touch project/src/app.py project/logs/app.log project/config/settings.conf
$ ls -lR project
project:
total 12
drwxr-xr-x 2 root root 4096 Aug 31 11:35 config
drwxr-xr-x 2 root root 4096 Aug 31 11:35 logs
drwxr-xr-x 2 root root 4096 Aug 31 11:35 src

project/config:
total 0
-rw-r--r-- 1 root root 0 Aug 31 11:35 settings.conf

project/logs:
total 0
-rw-r--r-- 1 root root 0 Aug 31 11:35 app.log

project/src:
total 0
-rw-r--r-- 1 root root 0 Aug 31 11:35 app.py
```

The size is `0` because `touch` only creates an empty file.

## Creating, copying, moving, deleting

```bash
$ cp project/logs/app.log backup.log
$ ls
backup.log  project  script.sh

$ mv backup.log app-backup.log
$ ls
app-backup.log  project  script.sh

$ rm app-backup.log
$ ls
project  script.sh
```

| Command | What it does |
|---|---|
| `touch file` | Create an empty file, or update the timestamp of an existing one |
| `mkdir dir` | Create a folder |
| `mkdir -p a/b/c` | Create the whole path, and do not complain if it exists |
| `cp file copy` | Copy a file |
| `cp -r dir dir2` | Copy a folder and everything inside it |
| `mv a b` | Move, and also rename, because renaming is just moving |
| `rm file` | Delete a file |
| `rm -r dir` | Delete a folder and everything inside |
| `rm -rf dir` | Same but forced with no questions. The dangerous one |
| `rmdir dir` | Delete a folder only if it is empty |

## Reading files

```bash
$ cat project/logs/app.log
line one
line two
line three
$ head -1 project/logs/app.log
line one
$ tail -1 project/logs/app.log
line three
$ wc -l project/logs/app.log
3 project/logs/app.log
```

| Command | What it does |
|---|---|
| `cat file` | Print the whole file |
| `head -n 10 file` | First 10 lines |
| `tail -n 10 file` | Last 10 lines |
| `tail -f file` | Keep watching a file as new lines arrive. The one for log files |
| `less file` | Scroll through a long file. `q` to quit |
| `wc -l file` | Count lines |
| `du -sh dir` | Total size of a folder |

```bash
$ du -sh project
20K	project
```

## Searching

```bash
$ grep "two" project/logs/app.log
line two
$ grep -n "two" project/logs/app.log
2:line two
$ grep -c "line" project/logs/app.log
3
```

| Command | What it does |
|---|---|
| `grep "text" file` | Print the lines that contain the text |
| `grep -i` | Ignore upper and lower case |
| `grep -n` | Show the line numbers |
| `grep -c` | Just count the matches |
| `grep -v` | Invert, show the lines that do **not** match |
| `grep -r "text" .` | Search every file under the current folder |
| `find . -name "*.log"` | Find files by name |
| `find . -type d` | Find only folders |
| `find . -size +100M` | Find files bigger than 100 MB |

```bash
$ find project -type f
project/src/app.py
project/logs/app.log
project/config/settings.conf

$ find project -name "*.log"
project/logs/app.log

$ find project -type d
project
project/src
project/logs
project/config
```

`grep -v` is one I use constantly, because `ps -ef | grep nginx` always matches the grep
command itself, and `| grep -v grep` removes that noise.

## Permissions

```bash
$ echo "echo hello" > script.sh
$ ls -l script.sh
-rw-r--r-- 1 root root 11 Aug 31 11:35 script.sh

$ chmod +x script.sh
$ ls -l script.sh
-rwxr-xr-x 1 root root 11 Aug 31 11:35 script.sh

$ chmod 644 script.sh
$ ls -l script.sh
-rw-r--r-- 1 root root 11 Aug 31 11:35 script.sh

$ chmod 755 script.sh
$ ls -l script.sh
-rwxr-xr-x 1 root root 11 Aug 31 11:35 script.sh
```

How to read `-rwxr-xr-x`. The first character is the type, then three groups of three:

```
 -      rwx      r-x      r-x
type   owner    group   everyone else
```

Each group is read, write, execute. As numbers: read is 4, write is 2, execute is 1, and
they get added up.

| Number | Letters | Means |
|---|---|---|
| 7 | `rwx` | read, write, execute |
| 6 | `rw-` | read and write |
| 5 | `r-x` | read and execute |
| 4 | `r--` | read only |
| 0 | `---` | nothing |

So `755` is `rwxr-xr-x`, which is the normal setting for a script or a program: the owner
can change it, everyone else can only run it. `644` is `rw-r--r--`, the normal setting for
a plain file. And `600` is for something private like an SSH key, where nobody except the
owner should be able to read it at all.

```bash
$ chown tempuser:tempuser script.sh
$ ls -l script.sh
-rwxr-xr-x 1 tempuser tempuser 11 Aug 31 11:35 script.sh
```

| Command | What it does |
|---|---|
| `chmod +x file` | Make it executable |
| `chmod 755 file` | Set permissions by number |
| `chmod -R 755 dir` | Do it for everything inside a folder as well |
| `chown user:group file` | Change owner and group |
| `sudo command` | Run one command as root |

## Processes

```bash
$ sleep 600 &
$ sleep 600 &
$ jobs
[1]-  Running                 sleep 600 &
[2]+  Running                 sleep 600 &

$ ps aux | head -6
USER         PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root           1  0.0  0.0   4300  3608 pts/0    Ss+  11:28   0:00 bash
root        3798  0.0  0.0   4036  3028 ?        Ss   11:36   0:00 bash /root/proc.sh
root        3804  0.0  0.0   2272  1276 ?        S    11:36   0:00 sleep 600
root        3805  0.0  0.0   2272  1284 ?        S    11:36   0:00 sleep 600
root        3806  0.0  0.0   7632  3652 ?        R    11:36   0:00 ps aux

$ ps -ef | grep -w 'sleep' | grep -v grep
root        3804    3798  0 11:36 ?        00:00:00 sleep 600
root        3805    3798  0 11:36 ?        00:00:00 sleep 600
```

In `ps -ef` the second column is the PID and the third is the PPID, the parent's PID. Both
sleeps show `3798` as their parent, which is the script that started them. That is how the
process tree works, every process except PID 1 has a parent.

```bash
$ kill 3804
$ ps -p 3804 > /dev/null 2>&1 && echo "still running" || echo "PID 3804 is gone"
PID 3804 is gone

$ kill -9 3805
[2]+  Killed                  sleep 600
```

| Command | What it does |
|---|---|
| `ps` | Processes of my current terminal |
| `ps aux` | Every process on the machine with CPU and memory columns |
| `ps -ef` | Every process in a different format, includes the parent PID |
| `top` | Live view, sorted by CPU. `q` to quit |
| `command &` | Run it in the background |
| `jobs` | List my background jobs |
| `kill PID` | Ask the process to stop cleanly |
| `kill -9 PID` | Force it to die immediately |
| `pkill -f pattern` | Kill by matching the command line |
| `free -h` | Memory usage |

The difference between `kill` and `kill -9` is worth knowing. Plain `kill` sends SIGTERM,
which asks the program politely and lets it save and close files first. `kill -9` sends
SIGKILL, which the program cannot catch or handle at all, so it dies straight away and can
leave things half written. So SIGTERM first, and `-9` only if it is stuck.

```bash
$ free -h
               total        used        free      shared  buff/cache   available
Mem:            15Gi       1.1Gi       155Mi        22Mi        14Gi        14Gi
Swap:          4.0Gi       4.5Mi       4.0Gi

$ uptime
 11:36:05 up 5 days, 23:18,  0 user,  load average: 0.19, 0.30, 0.28
```

`free` output looks alarming at first because `free` is only 155Mi, but that is normal.
Linux uses spare memory as disk cache and gives it back the moment a program needs it, so
the number to actually read is `available`, which is 14Gi.

I hit a real trap while practising this. I tried to clean up with
`pkill -f "sleep 300"` from inside a shell whose own command line contained the text
`sleep 300`, so `pkill` matched the shell itself and killed the whole thing. `-f` matches
against the entire command line, not just the program name. Since then I kill by PID when
I can.

## Disk

```bash
$ df -h
Filesystem            Size  Used Avail Use% Mounted on
overlay               911G   53G  812G   7% /
tmpfs                  64M     0   64M   0% /dev
shm                    64M     0   64M   0% /dev/shm
/run/host_mark/Users  927G  269G  659G  29% /home/work
```

| Command | What it does |
|---|---|
| `df -h` | Free space per filesystem |
| `du -sh dir` | Size of one folder |
| `du -sh *` | Size of everything in the current folder, good for finding what is big |
| `lsblk` | Block devices and partitions |
| `mount` | What is mounted where |

## Archives

```bash
$ tar -czf project.tar.gz project
$ ls -lh project.tar.gz
-rw-r--r-- 1 root root 257 Aug 31 11:36 project.tar.gz

$ tar -tzf project.tar.gz
project/
project/src/
project/src/app.py
project/logs/
project/logs/app.log
project/config/
project/config/settings.conf

$ mkdir -p restored && tar -xzf project.tar.gz -C restored
$ find restored -type f
restored/project/src/app.py
restored/project/logs/app.log
restored/project/config/settings.conf
```

The `tar` flags stop being confusing once you know what each letter is:

| Flag | Meaning |
|---|---|
| `c` | create an archive |
| `x` | extract an archive |
| `t` | list what is inside without extracting |
| `z` | run it through gzip |
| `f` | the next argument is the filename |
| `v` | verbose, print every file as it goes |
| `-C dir` | change into this folder first |

So `czf` is create gzip file and `xzf` is extract gzip file. Always run `tzf` first to see
what is inside, otherwise an archive without a top folder dumps its files all over the
current directory.

## Pipes and redirection

The `|` pipe takes the output of one command and hands it to the next one as input. This is
the part of Linux that makes small commands add up to something useful.

```bash
$ cat fruits.txt
banana
apple
banana
cherry
apple
banana

$ sort fruits.txt
apple
apple
banana
banana
banana
cherry

$ sort fruits.txt | uniq -c
      2 apple
      3 banana
      1 cherry

$ sort fruits.txt | uniq -c | sort -rn
      3 banana
      2 apple
      1 cherry
```

That last one is three commands chained together and it answers "what appears most often".
`uniq` only collapses lines that are next to each other, which is why `sort` has to come
first. Then `sort -rn` sorts by the count, `n` for numeric and `r` for reverse.

```bash
$ wc -l < fruits.txt
6
```

| Symbol | What it does |
|---|---|
| `\|` | Send output into the next command |
| `>` | Write to a file, wiping it first |
| `>>` | Add to the end of a file |
| `<` | Read input from a file |
| `2>` | Redirect only the error messages |
| `2>&1` | Send errors to the same place as normal output |
| `&>` | Shortcut for both at once |
| `/dev/null` | The bin. Anything sent here disappears |

Standard output and standard error are two separate streams, which is easy to see:

```bash
$ ls /this/does/not/exist 2> error.log
nothing on screen because 2> sent it to the file
$ cat error.log
ls: cannot access '/this/does/not/exist': No such file or directory

$ ls /this/does/not/exist > all.log 2>&1
$ cat all.log
ls: cannot access '/this/does/not/exist': No such file or directory
```

The first one catches only errors, and plain `>` would not have caught that message at all
because errors do not travel on standard output. `2>&1` sends both to one place, which is
why `command > file 2>&1` shows up in so many scripts and cron jobs.

## Text editing on the command line

```bash
$ sed "s/banana/mango/g" fruits.txt | head -3
mango
apple
mango

$ awk "{print NR\": \"\$1}" fruits.txt | head -3
1: banana
2: apple
3: banana
```

| Command | What it does |
|---|---|
| `sed 's/old/new/g' file` | Replace text. `g` means every match on the line, not just the first |
| `sed -i` | Edit the file itself instead of just printing the result |
| `sed '/pattern/d'` | Delete the lines that match |
| `awk '{print $1}'` | Print the first column |
| `awk -F: '{print $1}'` | Use `:` as the separator, which is how to read `/etc/passwd` |
| `cut -d: -f1` | Simpler version of the same thing |
| `sort` / `uniq` / `tr` | Sort, remove duplicates, swap characters |

In `awk`, `NR` is the current line number and `$1` is the first column. I used `sed -i` for
real in the journalctl task above to delete the broken line out of the nginx config.

## Packages

| Command (Debian and Ubuntu) | What it does |
|---|---|
| `apt update` | Refresh the list of available packages |
| `apt upgrade` | Update the installed packages |
| `apt install name` | Install something |
| `apt remove name` | Remove it |
| `apt search name` | Search for a package |
| `dpkg -l` | List installed packages |

On RHEL, CentOS and Amazon Linux the same jobs are done by `yum` or `dnf`. It is worth
knowing both, because a Dockerfile based on `ubuntu` needs `apt-get` and one based on
`amazonlinux` needs `yum`, and mixing them up is a common build failure.

## Services

| Command | What it does |
|---|---|
| `systemctl status nginx` | Is it running, and the last few log lines |
| `systemctl start nginx` | Start it now |
| `systemctl stop nginx` | Stop it now |
| `systemctl restart nginx` | Stop then start |
| `systemctl reload nginx` | Reread the config without dropping connections |
| `systemctl enable nginx` | Start it automatically on boot |
| `systemctl disable nginx` | Do not start it on boot |
| `systemctl is-active nginx` | Just prints active or inactive, handy in scripts |
| `journalctl -u nginx` | Its logs |

`enable` and `start` are two different things and it is a normal mistake to mix them up.
`start` runs it right now but it will be gone after a reboot. `enable` sets it to come up
on boot but does nothing this minute. A service that needs both gets
`systemctl enable --now nginx`.

## Shortcuts that save time

| Keys | What they do |
|---|---|
| `Tab` | Complete a filename or command |
| `Ctrl + C` | Stop the command that is running |
| `Ctrl + D` | End of input, also logs out of a shell |
| `Ctrl + L` | Clear the screen, same as `clear` |
| `Ctrl + R` | Search backwards through the commands I typed before |
| `Ctrl + A` / `Ctrl + E` | Jump to the start or the end of the line |
| `!!` | The previous command again, so `sudo !!` reruns it as root |
| Up and Down | Walk through history |

## What I took away from this session

- A filename is not the file. The inode is the file. Once that clicked, hard links, soft
  links, and why `rm` on a hard link does not lose data all made sense at once.
- `useradd` and `adduser` are not two competing commands, one is a wrapper around the
  other, and the portable low level one is what belongs in automation.
- `journalctl -xeu servicename` is the command to reach for when a service will not start.
  It gave me the exact config file line number when I broke nginx.
- Small commands joined with pipes beat one big complicated command. `sort | uniq -c |
  sort -rn` is three simple tools answering a question none of them could answer alone.
