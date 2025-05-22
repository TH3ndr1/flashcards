#!/usr/bin/env bash
# scripts/export_codebase.sh
# Generates a Markdown overview of your codebase, excluding specified files & dirs.

set -euo pipefail

OUTPUT="codebase_overview.md"

# 1) Start fresh with a title
printf "# Project Codebase Overview\n\n" > "$OUTPUT"

# 2) Print an indentation-only tree, skipping unwanted dirs/files
tree -i -f \
  -I '.*|logs|node_modules|public|*.yaml|*.txt|*.pdf|*.md|.DS_Store|.env.local|tsconfig.tsbuildinfo' \
  >> "$OUTPUT"

printf "\n\n" >> "$OUTPUT"

# 3) Walk each directory, then dump files
find . -type d \
  ! -path '*/.*' \
  ! -path './logs' \
  ! -path './node_modules' \
  ! -path './public' \
  ! -path './public/*' \
| sort \
| while read -r dir; do
  DIR_NAME=${dir#./}; [[ -z "$DIR_NAME" ]] && DIR_NAME="Root"
  printf "## Directory: %s\n\n" "$DIR_NAME" >> "$OUTPUT"

  find "$dir" -maxdepth 1 -type f \
    ! -name "*.yaml" \
    ! -name "*.txt" \
    ! -name "*.pdf" \
    ! -name "*.md" \
    ! -name ".DS_Store" \
    ! -name ".env.local" \
    ! -name "tsconfig.tsbuildinfo" \
    ! -name "$OUTPUT" \
  | sort \
  | while read -r file; do
    REL=${file#./}
    printf "### File: %s\n\n" "$REL" >> "$OUTPUT"
    printf '```\n' >> "$OUTPUT"
    sed '' "$file" >> "$OUTPUT"
    printf '\n```\n\n' >> "$OUTPUT"
  done
done