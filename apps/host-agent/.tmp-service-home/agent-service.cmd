@echo off
set "CLAUDERON_HOME=C:\Users\Toi Nguyen\.clauderon\runs\3aa1bd3b-d4e0-4a5d-b170-bfd1235f0b20\apps\host-agent/.tmp-service-home"
set CLAUDERON_SERVICE=1
cd /d "/Users/ann/.clauderon"
"/Users/ann/.clauderon/node/bin/node" "/Users/ann/.clauderon/agent/agent.mjs" "run" >> "C:\Users\Toi Nguyen\.clauderon\runs\3aa1bd3b-d4e0-4a5d-b170-bfd1235f0b20\apps\host-agent\.tmp-service-home\agent.log" 2>&1
