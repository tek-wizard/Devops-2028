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
