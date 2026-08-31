# Linux Fundamentals (Session 2)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework

1. Learn about soft links and hard links.
2. Find the difference between `adduser` and `useradd`, and which one is the standard way.
3. Learn about the `journalctl` command.
4. Go through the Linux command cheat sheet.

I ran everything in an Ubuntu container because my laptop is a MacBook.

---

# 1. Soft links and hard links

Every file has an **inode**, which holds the actual data and the file details. The filename
is just a label that points to the inode number.

- A **hard link** is a second name pointing to the same inode. Both names are equal.
- A **soft link** is a separate small file that just stores the path of another file. Like a
  shortcut.

```bash
ln original.txt hardlink.txt      # hard link
ln -s original.txt softlink.txt   # soft link, -s means symbolic
```

## What I ran

```bash
$ echo "This is the original file" > original.txt
$ ln original.txt hardlink.txt
$ ln -s original.txt softlink.txt

$ ls -li
807855 -rw-r--r-- 2 root root 26 Aug 31 11:30 hardlink.txt
807855 -rw-r--r-- 2 root root 26 Aug 31 11:30 original.txt
807856 lrwxrwxrwx 1 root root 12 Aug 31 11:30 softlink.txt -> original.txt
```

`-li` shows the inode number. The original and the hard link both have inode **807855**, so
they are the same file. The soft link has its own inode 807856.

The number after the permissions is the link count. It is 2 for the hard link because two
names point to that inode. The soft link line starts with `l` and shows `-> original.txt`.

## Deleting the original

```bash
$ rm original.txt

$ cat hardlink.txt
This is the original file

$ cat softlink.txt
cat: softlink.txt: No such file or directory
```

The hard link still works because the data belongs to the inode and one name is still
pointing at it. The soft link is broken because the file it pointed to is gone.

## Two things a hard link cannot do

```bash
$ ln mydir dirlink
ln: mydir: hard link not allowed for directory

$ ln /root/linkdemo/crossfile.txt /home/work/crossfile-hard.txt
ln: failed to create hard link: Invalid cross-device link
```

A hard link cannot point to a directory and cannot go across two different filesystems. A
soft link can do both, because it only stores a path.

## Difference

| | Hard link | Soft link |
|---|---|---|
| Command | `ln file link` | `ln -s file link` |
| Inode | Same as original | Its own |
| If original is deleted | Still works | Breaks |
| Can point to a directory | No | Yes |
| Can cross filesystems | No | Yes |

**Short answer:** a hard link is another name for the same file so the data survives if the
first name is deleted, but it cannot be used on directories or across filesystems. A soft
link is a shortcut holding a path, so it works anywhere but breaks if the target is removed.

Soft links are used a lot in real life, for example `/usr/bin/python3`:

```bash
$ ls -l /usr/bin/python3
lrwxrwxrwx 1 root root 10 Nov 12  2025 /usr/bin/python3 -> python3.12
```

---

# 2. adduser vs useradd

```bash
$ ls -l /usr/sbin/useradd /usr/sbin/adduser
-rwxr-xr-x 1 root root  55191 Jul  5  2023 /usr/sbin/adduser
-rwxr-xr-x 1 root root 142784 May 30  2024 /usr/sbin/useradd

$ head -1 /usr/sbin/adduser
#! /usr/bin/perl
```

So `adduser` is a Perl script and `useradd` is the real program. `adduser` calls `useradd`
inside it.

## useradd

```bash
$ useradd testuser1

$ grep testuser1 /etc/passwd
testuser1:x:1001:1001::/home/testuser1:/bin/sh

$ ls /home | grep testuser1
no home directory for testuser1
```

It made the account but **did not create the home folder**, and the shell is `/bin/sh`.

## adduser

```bash
$ adduser testuser2
info: Adding user `testuser2' ...
info: Adding new group `testuser2' (1002) ...
info: Adding new user `testuser2' (1002) with group `testuser2' ...
info: Creating home directory `/home/testuser2' ...
info: Copying files from `/etc/skel' ...

$ grep testuser2 /etc/passwd
testuser2:x:1002:1002:Prateek Test User,101,,:/home/testuser2:/bin/bash

$ ls -la /home/testuser2
-rw-r--r-- 1 testuser2 testuser2  220 Aug 31 11:33 .bash_logout
-rw-r--r-- 1 testuser2 testuser2 3771 Aug 31 11:33 .bashrc
-rw-r--r-- 1 testuser2 testuser2  807 Aug 31 11:33 .profile
```

It created the home folder, copied the starter files, used `/bin/bash`, and it also asks for
the password and full name while running.

## Both users side by side

```bash
$ grep -E "testuser1|testuser2" /etc/passwd
testuser1:x:1001:1001::/home/testuser1:/bin/sh
testuser2:x:1002:1002:Prateek Test User,101,,:/home/testuser2:/bin/bash

$ ls /home
testuser2  ubuntu  work
```

`testuser1` has no home folder at all.

## useradd with the right flags does the same job

```bash
$ useradd -m -s /bin/bash -c "Prateek Singh" testuser3
$ grep testuser3 /etc/passwd
testuser3:x:1003:1003:Prateek Singh:/home/testuser3:/bin/bash
```

- `-m` creates the home folder
- `-s` sets the shell
- `-c` is the comment, usually the full name

## Difference

| | useradd | adduser |
|---|---|---|
| What it is | The actual command | Perl script that calls useradd |
| Works on | All Linux distributions | Debian and Ubuntu only |
| Home folder | Only with `-m` | Made automatically |
| Asks questions | No | Yes |
| Works in a script | Yes | No, it waits for answers |

## Answer to the question

**`useradd` is the standard one.** It is the real command and it exists on every Linux
distribution.

`adduser` is not preferred because:

1. It only exists on Debian and Ubuntu, so a script using it breaks on other distributions.
2. It is interactive and stops to ask for a password, so it hangs inside a Dockerfile or any
   automation where nobody is there to type.
3. Its defaults come from a config file, so the result can be different on two machines.

`adduser` is easier when typing by hand on Ubuntu, but `useradd -m -s /bin/bash` is what
should be used in scripts.

## Other user commands

```bash
passwd username              # set a password
usermod -aG docker prateek   # add to a group
userdel -r username          # delete the user and the home folder
groups username              # which groups a user is in
id username                  # UID, GID and groups
```

---

# 3. journalctl

On systems using systemd, all the logs go into one place instead of separate text files in
`/var/log`. The journal is a binary file so `cat` cannot read it. `journalctl` is the command
that reads it.

The main reason to know it is that when a service does not start, `journalctl` shows the
actual error.

## Common commands

```bash
journalctl                     # everything
journalctl -n 20               # last 20 lines
journalctl -f                  # follow live, like tail -f
journalctl -u nginx            # logs of one service only
journalctl -xeu nginx          # the one to use when a service failed
journalctl -b                  # only this boot
journalctl -p err              # only errors
journalctl --since "1 hour ago"
journalctl --disk-usage        # how much space the journal is using
```

`-e` jumps to the end and `-x` adds extra explanation, so `-xeu servicename` is the normal
command for checking a failure.

## What I ran

`journalctl` needs systemd running, and a normal container does not have it, so I built a
small image with systemd as PID 1:

```dockerfile
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update -qq && apt-get install -y -qq systemd systemd-sysv nginx procps
CMD ["/sbin/init"]
```

```bash
$ journalctl -n 5
Aug 31 11:34:51 systemd-lab systemd[1]: Starting systemd-update-utmp-runlevel.service...
Aug 31 11:34:51 systemd-lab systemd[1]: Finished systemd-update-utmp-runlevel.service.
Aug 31 11:34:51 systemd-lab systemd[1]: Startup finished in 227ms.
```

Each line is the date, hostname, then the process with its PID, then the message.

Logs of one service:

```bash
$ systemctl start nginx
$ journalctl -u nginx
Aug 31 11:34:50 systemd-lab systemd[1]: Starting nginx.service...
Aug 31 11:34:50 systemd-lab systemd[1]: Started nginx.service.
```

## Breaking nginx on purpose to see a real error

```bash
$ echo "this_is_not_valid_nginx_config;" >> /etc/nginx/nginx.conf
$ systemctl restart nginx
Job for nginx.service failed because the control process exited with error code.
See "systemctl status nginx.service" and "journalctl -xeu nginx.service" for details.
```

```bash
$ journalctl -u nginx -n 6
Aug 31 11:35:21 systemd-lab systemd[1]: Starting nginx.service...
Aug 31 11:35:21 systemd-lab nginx[162]: [emerg] unknown directive "this_is_not_valid_nginx_config" in /etc/nginx/nginx.conf:84
Aug 31 11:35:21 systemd-lab nginx[162]: nginx: configuration file test failed
Aug 31 11:35:21 systemd-lab systemd[1]: nginx.service: Control process exited, code=exited, status=1/FAILURE
Aug 31 11:35:21 systemd-lab systemd[1]: Failed to start nginx.service.
```

This is the useful part. `systemctl restart` only said it failed, but the journal gave the
bad line and even the line number in the config file, line 84.

Then I fixed it:

```bash
$ sed -i "/this_is_not_valid_nginx_config/d" /etc/nginx/nginx.conf
$ nginx -t
nginx: configuration file /etc/nginx/nginx.conf test is successful
$ systemctl start nginx
```

Only errors:

```bash
$ journalctl -p err -n 10
Aug 31 11:35:21 systemd-lab systemd[1]: Failed to start nginx.service.
```

**Short answer:** `journalctl` reads the systemd journal, which is where all logs go on a
systemd machine. `journalctl -xeu servicename` is what shows why a service failed.

---

# 4. Linux command cheat sheet

I went through the cheat sheet and ran the commands.

## Where am I, who am I

```bash
$ pwd
/root/cheat
$ whoami
root
$ uname -a
Linux devops-lab 6.12.76-linuxkit #1 SMP aarch64 GNU/Linux
```

| Command | What it does |
|---|---|
| `pwd` | Current folder |
| `whoami` | My username |
| `id` | My UID, GID and groups |
| `hostname` | Machine name |
| `uname -a` | Kernel and architecture |
| `date` | Date and time |
| `uptime` | How long the machine has been up |

## Files and folders

```bash
$ mkdir -p project/{src,logs,config}
$ tree project
project
|-- config
|-- logs
`-- src
```

| Command | What it does |
|---|---|
| `ls -l` | Long list with permissions and size |
| `ls -a` | Show hidden files |
| `ls -lh` | Sizes in KB and MB |
| `cd ..` | Go up one folder |
| `cd ~` | Go to home |
| `touch file` | Make an empty file |
| `mkdir -p a/b` | Make the whole path |
| `cp file copy` | Copy |
| `cp -r dir dir2` | Copy a folder |
| `mv a b` | Move or rename |
| `rm file` | Delete |
| `rm -r dir` | Delete a folder |

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

`tail -f file` keeps watching a file as new lines come in, which is the one used for logs.

## Searching

```bash
$ grep -n "two" project/logs/app.log
2:line two

$ find project -name "*.log"
project/logs/app.log

$ find project -type d
project
project/src
project/logs
project/config
```

| Command | What it does |
|---|---|
| `grep "text" file` | Lines containing the text |
| `grep -i` | Ignore capital letters |
| `grep -n` | Show line numbers |
| `grep -v` | Show lines that do not match |
| `grep -r "text" .` | Search all files in the folder |
| `find . -name "*.log"` | Find files by name |

## Permissions

```bash
$ ls -l script.sh
-rw-r--r-- 1 root root 11 Aug 31 11:35 script.sh
$ chmod +x script.sh
$ ls -l script.sh
-rwxr-xr-x 1 root root 11 Aug 31 11:35 script.sh
```

How to read `-rwxr-xr-x`: the first letter is the type, then three groups of three for owner,
group and everyone else. Read is 4, write is 2, execute is 1, added together.

- 7 is `rwx`
- 6 is `rw-`
- 5 is `r-x`
- 4 is `r--`

So `755` is `rwxr-xr-x`, normal for a script, and `644` is `rw-r--r--`, normal for a file.

```bash
chmod 755 file           # set by number
chown user:group file    # change owner
```

## Processes

```bash
$ ps aux | head -4
USER   PID %CPU %MEM   VSZ  RSS TTY STAT START TIME COMMAND
root     1  0.0  0.0  4300 3608 pts/0 Ss+ 11:28 0:00 bash
root  3804  0.0  0.0  2272 1276 ?     S   11:36 0:00 sleep 600
root  3805  0.0  0.0  2272 1284 ?     S   11:36 0:00 sleep 600

$ kill 3804
$ kill -9 3805
```

| Command | What it does |
|---|---|
| `ps` | Processes of my terminal |
| `ps aux` | All processes with CPU and memory |
| `top` | Live view, q to quit |
| `command &` | Run in the background |
| `kill PID` | Ask it to stop |
| `kill -9 PID` | Force it to stop |
| `free -h` | Memory usage |

`kill` asks the program to close properly. `kill -9` forces it, so it is used only when the
program is stuck.

## Disk

```bash
$ df -h
Filesystem            Size  Used Avail Use% Mounted on
overlay               911G   53G  812G   7% /
/run/host_mark/Users  927G  269G  659G  29% /home/work
```

`df -h` shows free space and `du -sh folder` shows the size of one folder.

## Archives

```bash
$ tar -czf project.tar.gz project
$ tar -tzf project.tar.gz
project/
project/src/app.py
project/logs/app.log
$ tar -xzf project.tar.gz -C restored
```

- `c` create, `x` extract, `t` list
- `z` for gzip, `f` for the filename

So `czf` is create and `xzf` is extract.

## Pipes and redirection

The `|` pipe sends the output of one command into the next one.

```bash
$ sort fruits.txt | uniq -c | sort -rn
      3 banana
      2 apple
      1 cherry
```

`sort` first because `uniq` only removes lines that are next to each other, then `uniq -c`
counts them, then `sort -rn` puts the biggest first.

| Symbol | What it does |
|---|---|
| `\|` | Send output to the next command |
| `>` | Write to a file, replacing it |
| `>>` | Add to the end of a file |
| `2>` | Redirect only errors |
| `2>&1` | Send errors to the same place as output |
| `/dev/null` | Throw the output away |

Errors do not travel on normal output, which is easy to see:

```bash
$ ls /this/does/not/exist 2> error.log
$ cat error.log
ls: cannot access '/this/does/not/exist': No such file or directory
```

## Services

```bash
systemctl status nginx
systemctl start nginx
systemctl stop nginx
systemctl restart nginx
systemctl enable nginx     # start automatically on boot
```

`start` runs it now, `enable` makes it start on boot. They are two different things.

## Shortcuts

| Keys | What they do |
|---|---|
| Tab | Complete a filename |
| Ctrl + C | Stop the running command |
| Ctrl + L | Clear the screen |
| Ctrl + R | Search my old commands |
| Up arrow | Previous command |
