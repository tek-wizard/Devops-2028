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
