FROM pixel-agents:1.5.0
COPY cli.js /usr/local/lib/node_modules/pixel-agents/dist/cli.js
COPY webview /usr/local/lib/node_modules/pixel-agents/dist/webview
COPY office-assets /opt/office-assets
USER node
# A killed container leaves a registry entry with pid 1, which every new container also has;
# clear it so the server never mistakes itself for a running instance.
CMD ["sh","-c","rm -f $HOME/.pixel-agents/server.json $HOME/.pixel-agents/servers/*.json; exec pixel-agents --host 127.0.0.1 --port 3150 --no-terminal"]
