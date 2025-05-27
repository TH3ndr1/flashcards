#!/bin/bash

# Create fonts directory if it doesn't exist
mkdir -p public/fonts

# Download OpenDyslexic font
curl -L -o public/fonts/OpenDyslexic-Regular.woff2 "https://github.com/antijingoist/opendyslexic/raw/master/compiled/OpenDyslexic-Regular.woff2"

# Download Atkinson Hyperlegible font
curl -L -o public/fonts/AtkinsonHyperlegibleNext-Regular.woff2 "https://github.com/googlefonts/atkinson-hyperlegible/raw/main/fonts/webfonts/AtkinsonHyperlegibleNext-Regular.woff2"

echo "Fonts have been downloaded to public/fonts/" 