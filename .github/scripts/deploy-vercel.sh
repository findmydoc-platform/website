#!/usr/bin/env bash

echo "📊 Directory sizes:"
du -h -d 2 ./
echo "🔍 Vercel output directory structure:"
find ./ -type f -not -path "*/node_modules/*" | sort

vercel deploy --yes --prebuilt --token=${VERCEL_TOKEN} >deployment-url.txt 2>error.txt

# check the exit code
code=$?
if [ $code -eq 0 ]; then
    # Now you can use the deployment url from stdout for the next step of your workflow
    deploymentUrl=$(cat deployment-url.txt)
    echo "deploymentUrl=$deploymentUrl" >> "$GITHUB_OUTPUT"
else
    # Handle the error
    errorMessage=$(cat error.txt)
    echo "There was an error: $errorMessage"
fi
