#!/bin/bash
# Session 3 homework
# Prints the date, hostname, username, disk usage and processes,
# then saves the process list into a file inside a new folder.

read -p "Enter your name: " name
read -p "Enter your roll number: " roll_no
read -p "Enter a folder name: " folder_name

current_date=$(date)
host_name=$(hostname)
user_name=$(whoami)

mkdir $folder_name
touch $folder_name/process.log

echo "Name: $name"
echo "Roll number: $roll_no"
echo "Date: $current_date"
echo "Hostname: $host_name"
echo "Username: $user_name"

echo ""
echo "Disk usage:"
df -h

echo ""
echo "Running processes:"
ps

ps > $folder_name/process.log
echo ""
echo "Process list saved in $folder_name/process.log"
