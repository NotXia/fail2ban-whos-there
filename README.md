# Who's there?

A simple web app to monitor and locate IPs banned by fail2ban.


## Installation

### 1. Setup web app

#### Locally
To start the server locally, fill the environment variables in `.env` and run:
```
npm install
npm start
```

#### Through Docker
WIP

### 2. Setup fail2ban action

A fail2ban action has to be created to notify new bans. A simple example of action is the following:
```conf
# /usually-etc/fail2ban/action.d/whos-there.local

[Definition]
actionban = curl -X POST <domain>/api/bans -H 'Content-Type: application/json' -d '{"ip": <ip>, "jail_name": %(name)s, "timestamp": <time>}'

[Init]
domain = http://localhost:3000
```

Then, the action must be invoked when a ban happens. The following example notifies a ban independently of the jail:
```conf
# /usually-etc/fail2ban/jail.local

action = %(action_)s
         whos-there[domain="https://insert-domain-here"]
```


### (Optional) Import current bans
An easy way to import currently banned IPs is to restart fail2ban. Note that it will unban all banned IPs on shutdown and restore them during its initialization phase.