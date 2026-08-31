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
