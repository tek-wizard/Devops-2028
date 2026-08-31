# Shell Scripting (Session 3)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

This folder has all the shell scripting practice from session 3 plus the homework script.
For every task I have written down what the commands do, the script I wrote, and the
output I got when I ran it.

## Homework that was given

Write a shell script that prints the current date, hostname, username, disk usage and
the running processes. The script has to use variables, take input with `read`, create a
directory, and save the process information into a file inside that directory. The
commands to use are `mkdir`, `touch`, `echo`, `df`, `ps`, `>`, `read -p` and variables.

That script is [`system_info.sh`](system_info.sh) and it is task 10 below. The other nine
scripts are the practice exercises we did in class.

## How I ran everything

My laptop is a MacBook, so to keep the output the same as a normal Linux machine I ran
all the scripts inside an Ubuntu container that has the repo mounted inside it:

```bash
docker run -dit --name devops-lab --hostname devops-lab \
  -v "$PWD":/home/work ubuntu:24.04 bash

docker exec -it devops-lab bash
apt update && apt install -y procps
cd /home/work/shell-scripting
chmod +x *.sh
```

That is why the hostname in the output is `devops-lab` and the username is `root`.

## Quick notes before the scripts

| Thing | What it means |
|---|---|
| `#!/bin/bash` | The shebang line. It tells Linux which program should run this file. |
| `chmod +x file.sh` | Gives the file permission to be executed, otherwise I get "Permission denied". |
| `./file.sh` | Runs the script from the current folder. |
| `name="value"` | Creates a variable. There must be no space around the `=` sign. |
| `$name` | Reads the value back out of the variable. |
| `$(command)` | Runs the command and gives me its output so I can store it in a variable. |
| `>` | Sends output into a file and wipes whatever was in the file before. |
| `>>` | Sends output into a file and keeps the old content. |

---

## 1. Create a folder and a file, `hello.sh`

`mkdir` makes a directory, `touch` makes an empty file, `echo` with `>` writes text into
that file, and `cat` prints the file back out. I used `mkdir -p` instead of plain `mkdir`
because `-p` does not complain if the folder is already there, so I can run the script
twice without an error.

```bash
#!/bin/bash
# First script from class: make a folder, make a file, write into it, read it back.

mkdir -p hello
touch hello/app.log
echo "This is my logfile" > hello/app.log
cat hello/app.log
```

**Output**

```text
This is my logfile
```

---

## 2. Overwrite and append, `redirect.sh`

This is the one that confused me at first, so I made a script that shows both in a row.
`>` replaces the whole file every time. `>>` adds a new line at the bottom and leaves the
old lines alone.

```bash
#!/bin/bash
# Shows the difference between > (overwrite) and >> (append).

mkdir -p redirect
echo "This is line one" > redirect/app.log
echo "After using > once:"
cat redirect/app.log

echo "This is line two" > redirect/app.log
echo "After using > a second time (line one is gone):"
cat redirect/app.log

echo "This is line three" >> redirect/app.log
echo "After using >> (line three is added, line two stays):"
cat redirect/app.log
```

**Output**

```text
After using > once:
This is line one
After using > a second time (line one is gone):
This is line two
After using >> (line three is added, line two stays):
This is line two
This is line three
```

So "line one" is gone forever after the second `>`. That is the part to be careful about,
because there is no undo.

---

## 3. Variables, `variable.sh`

A variable holds a value under a name so I do not have to type the value again and again.
Two rules I noted from class: no spaces around the `=` sign, and do not name a variable
after an existing command like `ls`, because then it becomes confusing to read.

`$(date)` is command substitution. Bash runs `date` first and puts its output into the
variable.

```bash
#!/bin/bash
# Variables store a value once and let me reuse it as many times as I want.

name="Prateek Singh"
roll_no="24BCS10135"
course="DevOps"

# No spaces around the = sign, and I read the value back with a $ in front.
echo "My name is $name"
echo "My roll number is $roll_no"
echo "I am learning $course"

# A variable can also hold the output of a command using $( )
today=$(date)
echo "Today is $today"
```

**Output**

```text
My name is Prateek Singh
My roll number is 24BCS10135
I am learning DevOps
Today is Mon Aug 31 12:11:26 UTC 2026
```

---

## 4. Taking input, `input.sh`

`read` stops the script and waits for me to type something, then stores it in a variable.
The `-p` flag lets me print the question on the same line instead of using a separate
`echo`.

```bash
#!/bin/bash
# read -p prints the question and waits for me to type the answer.

read -p "Enter your name: " name
read -p "Enter your roll number: " roll_no
read -p "Enter your comment: " comment

echo "My name is $name"
echo "My roll number is $roll_no"
echo "My comment is: $comment"
```

**What I typed:** `Prateek Singh`, `24BCS10135`, `Shell scripting is fun`

**Output**

```text
Enter your name: Prateek Singh
Enter your roll number: 24BCS10135
Enter your comment: Shell scripting is fun
My name is Prateek Singh
My roll number is 24BCS10135
My comment is: Shell scripting is fun
```

---

## 5. If and else, `condition.sh`

`if` checks a condition. If it is false bash moves down to `elif`, and if nothing matched
it runs `else`. The checks are done with `-lt` which means less than. I put the variable
in double quotes because if the variable is empty the test would break otherwise.

Number comparisons inside `[ ]`:

| Operator | Meaning |
|---|---|
| `-eq` | equal to |
| `-ne` | not equal to |
| `-lt` | less than |
| `-le` | less than or equal to |
| `-gt` | greater than |
| `-ge` | greater than or equal to |

```bash
#!/bin/bash
# if / elif / else picks one branch depending on the value I type.

read -p "Enter your age: " age

if [ "$age" -lt 0 ]; then
    echo "Invalid age. Please enter a valid age."
elif [ "$age" -lt 13 ]; then
    echo "You are a child."
elif [ "$age" -lt 20 ]; then
    echo "You are a teenager."
else
    echo "You are an adult."
fi
```

**What I typed:** `20`

**Output**

```text
Enter your age: 20
You are an adult.
```

I tested the other branches too:

```text
$ ./condition.sh
Enter your age: 5
You are a child.

$ ./condition.sh
Enter your age: 15
You are a teenager.

$ ./condition.sh
Enter your age: -3
Invalid age. Please enter a valid age.
```

---

## 6. For loop, `loop.sh`

A `for` loop takes a list of values and runs the same block once for each value.
`{1..5}` is a brace expansion, bash turns it into `1 2 3 4 5` before the loop even starts.

```bash
#!/bin/bash
# A for loop runs the same block once for every value in the list.

for i in {1..5}
do
  echo "This is iteration number $i"
done
```

**Output**

```text
This is iteration number 1
This is iteration number 2
This is iteration number 3
This is iteration number 4
This is iteration number 5
```

---

## 7. While loop with a counter, `while_loop.sh`

A `while` loop keeps repeating as long as the condition is true. The important part is
that something inside the loop has to change the condition, otherwise it never stops.
Here `((count++))` adds one to the counter on every round, so after five rounds `count`
becomes 5, the condition `count -lt 5` turns false, and the loop ends.

```bash
#!/bin/bash
# A while loop keeps running while its condition stays true.

count=0
while [ "$count" -lt 5 ]
do
  echo "This is iteration number $count"
  ((count++))
done
```

**Output**

```text
This is iteration number 0
This is iteration number 1
This is iteration number 2
This is iteration number 3
This is iteration number 4
```

It starts at 0 and not 1 because I set `count=0` before the loop.

---

## 8. Infinite loop with break and continue, `menu_loop.sh`

`while true` never ends on its own, so I need `break` to get out. `continue` is different,
it skips the rest of the block and jumps straight to the next round.

The check `[[ "$input" =~ ^[0-9]+$ ]]` is a regular expression. `^` is the start of the
text, `[0-9]+` means one or more digits, and `$` is the end. So it only passes if the
whole thing is digits. The `!` in front flips it, so the `elif` catches anything that is
not a number.

```bash
#!/bin/bash
# while true runs forever, so I need break to get out of it.
# continue skips the rest of the block and starts the next round.

while true; do
    read -p "Enter a number (or 'q' to quit): " input

    if [[ "$input" == "q" ]]; then
        echo "Exiting the loop."
        break
    elif ! [[ "$input" =~ ^[0-9]+$ ]]; then
        echo "Invalid input. Please enter a valid number."
        continue
    fi

    echo "You entered: $input"
done
```

**What I typed:** `7`, then `abc`, then `42`, then `q`

**Output**

```text
Enter a number (or 'q' to quit): 7
You entered: 7
Enter a number (or 'q' to quit): abc
Invalid input. Please enter a valid number.
Enter a number (or 'q' to quit): 42
You entered: 42
Enter a number (or 'q' to quit): q
Exiting the loop.
```

`abc` never reached the last `echo` because `continue` sent it back to the top.

---

## 9. Functions, `function.sh`

A function is a group of commands stored under one name. Writing the function does not
run it, I have to call the name on its own line. Functions can also take arguments, and
inside the function `$1` is the first argument, `$2` the second and so on.

```bash
#!/bin/bash
# A function is a block of commands with a name. It only runs when I call the name.

show_info() {
  echo "This is a function"
  echo "This is a function to show information"
}

# Functions can also take arguments. $1 is the first argument.
greet() {
  echo "Hello $1, welcome to the DevOps class"
}

show_info
greet "Prateek"
```

**Output**

```text
This is a function
This is a function to show information
Hello Prateek, welcome to the DevOps class
```

One mistake I made here: I first wrote `show_info()` with the brackets when calling it,
the way you call a function in C or Python. In bash that does not call the function, it
declares a new empty one. To call it I just write `show_info` with no brackets.

---

## 10. The homework script, `system_info.sh`

This is the actual homework. It brings together everything from above.

**Commands used and why**

| Command | What it gives me |
|---|---|
| `read -p` | Asks for my name, roll number and a folder name |
| `date` | Current date and time |
| `hostname` | The name of the machine |
| `whoami` | The user who is running the script |
| `df -h` | Disk usage. `-h` makes it print GB and MB instead of raw blocks |
| `ps` | The list of running processes |
| `mkdir -p` | Creates the report folder |
| `touch` | Creates the empty `process.log` file inside it |
| `>` | Sends the `ps` output into `process.log` instead of the screen |
| `wc -l` | Counts how many lines ended up in the file |
| `head -5` | Prints the first 5 lines so I can check the file really got written |

I also added a small check with `-z`, which is true when a variable is empty. If I just
press Enter at the folder question, the script falls back to `system_report` instead of
trying to create a folder with no name.

```bash
#!/bin/bash
# ---------------------------------------------------------------
# Session 3 homework
# A small system report script.
#
# What it does:
#   1. asks me a few questions with read -p
#   2. collects date, hostname, username, disk usage and processes
#   3. creates a folder, and saves the process list inside that folder
# ---------------------------------------------------------------

# ---------- 1. take input from the user ----------
read -p "Enter your name: " name
read -p "Enter your roll number: " roll_no
read -p "Enter a name for the report folder: " folder_name

# If I just press Enter, fall back to a default folder name
# so the script never tries to create a folder with an empty name.
if [ -z "$folder_name" ]; then
    folder_name="system_report"
fi

# ---------- 2. store the system details in variables ----------
current_date=$(date)
host_name=$(hostname)
user_name=$(whoami)

# ---------- 3. create the folder and the file inside it ----------
mkdir -p "$folder_name"
touch "$folder_name/process.log"

# ---------- 4. print everything on the screen ----------
echo ""
echo "==============================================="
echo " System report for $name (Roll no: $roll_no)"
echo "==============================================="

echo ""
echo "Current date and time : $current_date"
echo "Hostname              : $host_name"
echo "Username              : $user_name"

echo ""
echo "----- Disk usage (df -h) -----"
df -h

echo ""
echo "----- Running processes (ps) -----"
ps

# ---------- 5. save the process list into the file ----------
# > sends the output of ps into the file instead of the screen.
# It overwrites the file, so the log always holds the latest run.
ps > "$folder_name/process.log"

echo ""
echo "Process information has been saved in $folder_name/process.log"
echo "Number of lines saved: $(wc -l < "$folder_name/process.log")"

# ---------- 6. read the file back to prove it was written ----------
echo ""
echo "----- First 5 lines of $folder_name/process.log -----"
head -5 "$folder_name/process.log"
```

**How I ran it**

```bash
chmod +x system_info.sh
./system_info.sh
```

**What I typed:** `Prateek Singh`, `24BCS10135`, `system_report`

**Output**

```text
Enter your name: Prateek Singh
Enter your roll number: 24BCS10135
Enter a name for the report folder: system_report

===============================================
 System report for Prateek Singh (Roll no: 24BCS10135)
===============================================

Current date and time : Mon Aug 31 12:11:35 UTC 2026
Hostname              : devops-lab
Username              : root

----- Disk usage (df -h) -----
Filesystem            Size  Used Avail Use% Mounted on
overlay               911G   55G  811G   7% /
tmpfs                  64M     0   64M   0% /dev
shm                    64M     0   64M   0% /dev/shm
/run/host_mark/Users  927G  274G  654G  30% /home/work
/dev/vda1             911G   55G  811G   7% /etc/hosts
tmpfs                 7.8G     0  7.8G   0% /proc/scsi
tmpfs                 7.8G     0  7.8G   0% /sys/firmware

----- Running processes (ps) -----
    PID TTY          TIME CMD
   4125 ?        00:00:00 bash
   4132 ?        00:00:00 system_info.sh
   4139 ?        00:00:00 ps

Process information has been saved in system_report/process.log
Number of lines saved: 4

----- First 5 lines of system_report/process.log -----
    PID TTY          TIME CMD
   4125 ?        00:00:00 bash
   4132 ?        00:00:00 system_info.sh
   4140 ?        00:00:00 ps
```

**Checking the file separately**

I ran the script one more time and then looked at the file on its own to confirm it is
really there and really has the process list in it:

```bash
$ ls -l system_report/
total 4
-rw-r--r-- 1 root root 131 Aug 31 12:11 process.log

$ cat system_report/process.log
    PID TTY          TIME CMD
   4125 ?        00:00:00 bash
   4145 ?        00:00:00 system_info.sh
   4153 ?        00:00:00 ps
```

The PIDs here are different from the run above because this was a separate run of the
script, and every run gets fresh process IDs.

Two things I noticed while testing this:

1. The PID of `ps` inside the saved file is not the same as the PID printed on the screen.
   That is because the script runs `ps` twice, once for the screen and once for the file,
   and each run is a brand new process with a new PID.
2. The process list is short because inside a container only the processes of that
   container are visible. On a normal machine the same script prints a much longer list.

---

## Running all the scripts

```bash
chmod +x *.sh
./hello.sh
./redirect.sh
./variable.sh
./input.sh
./condition.sh
./loop.sh
./while_loop.sh
./menu_loop.sh
./function.sh
./system_info.sh
```

The folders `hello/`, `redirect/` and `system_report/` are created by the scripts when
they run, so I have kept them out of the repo with a `.gitignore`.

## Mistakes I hit and how I fixed them

| Problem | Reason | Fix |
|---|---|---|
| `Permission denied` when running `./hello.sh` | The file did not have the execute permission | `chmod +x hello.sh` |
| `name = "Prateek"` gave "command not found" | Spaces around `=` make bash read `name` as a command | Write it as `name="Prateek"` |
| `mkdir: cannot create directory 'hello': File exists` on the second run | Plain `mkdir` fails if the folder is already there | Use `mkdir -p` |
| The function printed nothing | I called it as `show_info()` with brackets, which redeclares it | Call it as `show_info` |
| `[: : integer expression expected` in `condition.sh` | I pressed Enter without typing an age, so the variable was empty | Put the variable in double quotes as `"$age"` |
