# Pods connect out to the app through a Pod Daemon

Pods are machines the team already owns, often behind NAT or firewalls. Instead of the app holding SSH keys and dialing into each Pod, a Pod Daemon installed on the Pod opens an outbound connection to the app, receives Steps and streams their output back. This needs no inbound port on the Pod and keeps privileged credentials off the app server, at the cost of an install step per Pod.

## Considered Options

- **App SSHes into Pods**: nothing to install, but needs inbound SSH to every Pod and the app holds high-privilege keys for all of them.
