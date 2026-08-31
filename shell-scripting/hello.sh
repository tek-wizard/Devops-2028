#!/bin/bash
# First script from class: make a folder, make a file, write into it, read it back.

mkdir -p hello
touch hello/app.log
echo "This is my logfile" > hello/app.log
cat hello/app.log
