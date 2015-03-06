
MyKanban
=============

An online kanban tool for managing your tasks. Features google SSO.


Openshift setup
=============

To install a matching cartridge in openshift from the commandline:
```
rhc app create mykanban nodejs-0.10 mongodb-2.4 GOOGLE_AUTH_CLIENTID=[your google clientid] GOOGLE_AUTH_CLIENTSECRET=[your google clientsecret]
```
Check https://scotch.io/tutorials/easy-node-authentication-google for how to create the clientid and clientsecret.
