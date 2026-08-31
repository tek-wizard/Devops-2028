#!/bin/bash
# Variables store a value once and let me reuse it as many times as I want.

name="Prateek Singh"
roll_no="ENROLLMENT_PLACEHOLDER"
course="DevOps"

# No spaces around the = sign, and I read the value back with a $ in front.
echo "My name is $name"
echo "My roll number is $roll_no"
echo "I am learning $course"

# A variable can also hold the output of a command using $( )
today=$(date)
echo "Today is $today"
