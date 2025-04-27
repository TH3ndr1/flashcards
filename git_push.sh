#!/bin/bash

# Check if a commit message was provided
if [ "$#" -ne 1 ]; then
  echo "Usage: $0 <commit message>"
  exit 1
fi

# Ensure Git user is configured
if ! git config user.name > /dev/null || ! git config user.email > /dev/null; then
  echo "Git user not configured. Please run:"
  echo "  git config --global user.name \"Your Name\""
  echo "  git config --global user.email \"you@example.com\""
  exit 1
fi

# Ensure GitHub CLI is authenticated
if ! gh auth status &> /dev/null; then
  echo "GitHub CLI is not authenticated. Attempting to authenticate..."
  gh auth login
  if [ $? -ne 0 ]; then
    echo "Authentication failed."
    exit 1
  fi
fi

# Stage all changes
git add .

# Commit with the provided message
git commit -m "$1"

# Push changes to the refactor branch on the origin remote
git push origin refactor