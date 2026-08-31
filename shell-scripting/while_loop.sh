#!/bin/bash
# A while loop keeps running while its condition stays true.

count=0
while [ "$count" -lt 5 ]
do
  echo "This is iteration number $count"
  ((count++))
done
