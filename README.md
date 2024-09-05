# Who's there?


```conf
# fail2ban/action.d/whos-there.local

[Definition]
actionban = curl -X POST <scheme>://<domain>/api/bans -H 'Content-Type: application/json' -d '{"ip": <ip>, "jail_name": %(name)s, "timestamp": <time>}'

[Init]
scheme = https
domain = localhost
```

```conf
# fail2ban/jail.local

action = %(action_)s
         whos-there[scheme="https", domain="my-domain"]
```