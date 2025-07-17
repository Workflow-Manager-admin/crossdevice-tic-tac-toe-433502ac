#!/bin/bash
cd /home/kavia/workspace/code-generation/crossdevice-tic-tac-toe-433502ac/game_frontend
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi

