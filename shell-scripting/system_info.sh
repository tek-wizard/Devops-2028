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
