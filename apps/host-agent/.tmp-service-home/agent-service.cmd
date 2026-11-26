@echo off
set "CLAUDERON_HOME=D:\home\study\AI\toi-nguyen\clauderon-wt-218\apps\host-agent/.tmp-service-home"
set CLAUDERON_SERVICE=1
cd /d "/Users/ann/.clauderon"
"/Users/ann/.clauderon/node/bin/node" "/Users/ann/.clauderon/agent/agent.mjs" "run" >> "D:\home\study\AI\toi-nguyen\clauderon-wt-218\apps\host-agent\.tmp-service-home\agent.log" 2>&1
