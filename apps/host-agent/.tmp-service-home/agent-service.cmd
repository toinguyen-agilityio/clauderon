@echo off
set "CLAUDERON_HOME=C:\Users\Toi Nguyen\.clauderon\runs\79b03023-a47d-4b41-866d-a948588e802d\apps\host-agent/.tmp-service-home"
set CLAUDERON_SERVICE=1
cd /d "/Users/ann/.clauderon"
"/Users/ann/.clauderon/node/bin/node" "/Users/ann/.clauderon/agent/agent.mjs" "run" >> "C:\Users\Toi Nguyen\.clauderon\runs\79b03023-a47d-4b41-866d-a948588e802d\apps\host-agent\.tmp-service-home\agent.log" 2>&1
