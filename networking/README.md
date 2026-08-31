# Networking (Session 4)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework

Practise the networking commands from the session, mainly `ping` and subnetting with the
special IP addresses, and put what I understood in an MD file with the output.

---

# IP addresses

An IP address is a number that identifies a device on a network. IPv4 has 32 bits, written as
four numbers from 0 to 255.

An IP address is really two parts joined together:

- the **network part**, which says which network the device is on
- the **host part**, which says which device it is on that network

The **subnet mask** is what decides where the split is. That is why an IP address always
comes with a mask.

## Classes

| Class | First number | Default mask | Network bits | Host bits |
|---|---|---|---|---|
| A | 1 to 126 | 255.0.0.0 (/8) | 8 | 24 |
| B | 128 to 191 | 255.255.0.0 (/16) | 16 | 16 |
| C | 192 to 223 | 255.255.255.0 (/24) | 24 | 8 |
| D | 224 to 239 | multicast | | |
| E | 240 to 255 | reserved | | |

127 is missing from class A because the whole `127.0.0.0/8` block is loopback.

## Subnet mask

The mask is 32 bits where the network bits are 1 and the host bits are 0.

```
Address:   197.23.45.10        11000101.00010111.00101101.00001010
Netmask:   255.255.255.0 /24   11111111.11111111.11111111.00000000
                               \______ network ______/  \ host /
```

## The four numbers to work out

- **Network address:** host bits all 0
- **Broadcast address:** host bits all 1
- **First host:** network address + 1
- **Last host:** broadcast address - 1

Number of hosts is 2 to the power of the host bits, minus 2, because the network address and
the broadcast address cannot be given to a device.

## Example 1: 197.23.45.10 with mask 255.255.255.0

- 197 is between 192 and 223, so class C, mask /24
- Network bits 24, host bits 8
- Hosts = 2^8 - 2 = **254**
- Network address: **197.23.45.0**
- Broadcast: **197.23.45.255**
- Usable range: **197.23.45.1 to 197.23.45.254**

Checked with `ipcalc`:

```bash
$ ipcalc 197.23.45.10/24
Address:   197.23.45.10         11000101.00010111.00101101. 00001010
Netmask:   255.255.255.0 = 24   11111111.11111111.11111111. 00000000
Network:   197.23.45.0/24
HostMin:   197.23.45.1
HostMax:   197.23.45.254
Broadcast: 197.23.45.255
Hosts/Net: 254                   Class C
```

## Example 2: 120.27.1.0 with mask 255.0.0.0

- 120 is between 1 and 126, so class A, mask /8
- Network bits 8, host bits 24
- Hosts = 2^24 - 2 = **16,777,214**
- Network address: **120.0.0.0**
- Broadcast: **120.255.255.255**

```bash
$ ipcalc 120.27.1.0/8
Address:   120.27.1.0           01111000. 00011011.00000001.00000000
Netmask:   255.0.0.0 = 8        11111111. 00000000.00000000.00000000
Network:   120.0.0.0/8
HostMin:   120.0.0.1
HostMax:   120.255.255.254
Broadcast: 120.255.255.255
Hosts/Net: 16777214              Class A
```

The `.27.1` part is ignored when working out the network, because with a /8 mask those are
host bits.

## Subnetting

Subnetting means borrowing bits from the host part to make more, smaller networks.

Taking `192.168.10.0/24` and borrowing 2 bits makes it /26:

- Host bits go from 8 to 6, so hosts = 2^6 - 2 = **62**
- Subnets = 2^2 = **4**
- Mask becomes 255.255.255.192

Working out all four subnets by hand, and then I checked them with
`ipcalc 192.168.10.0/24 -s 62 62 62 62`:

| Subnet | Network | First host | Last host | Broadcast |
|---|---|---|---|---|
| 1 | 192.168.10.0/26 | 192.168.10.1 | 192.168.10.62 | 192.168.10.63 |
| 2 | 192.168.10.64/26 | 192.168.10.65 | 192.168.10.126 | 192.168.10.127 |
| 3 | 192.168.10.128/26 | 192.168.10.129 | 192.168.10.190 | 192.168.10.191 |
| 4 | 192.168.10.192/26 | 192.168.10.193 | 192.168.10.254 | 192.168.10.255 |

The networks go up by 64 each time, because 256 divided by 4 subnets is 64. The first host is
always the network address plus 1 and the last host is the broadcast minus 1.

| Slash | Mask | Subnets | Hosts each |
|---|---|---|---|
| /24 | 255.255.255.0 | 1 | 254 |
| /25 | 255.255.255.128 | 2 | 126 |
| /26 | 255.255.255.192 | 4 | 62 |
| /27 | 255.255.255.224 | 8 | 30 |
| /28 | 255.255.255.240 | 16 | 14 |
| /30 | 255.255.255.252 | 64 | 2 |

## Private IP ranges

These are for internal networks and are not used on the internet, so everyone can reuse them.

| Class | Range |
|---|---|
| A | 10.0.0.0 to 10.255.255.255 |
| B | 172.16.0.0 to 172.31.255.255 |
| C | 192.168.0.0 to 192.168.255.255 |

Docker uses the 172 range, which is why containers get addresses like 172.17.0.3.

## Special IP addresses

| Address | Meaning |
|---|---|
| `0.0.0.0` | All interfaces when a server listens on it |
| `127.0.0.1` | Loopback, this machine |
| `255.255.255.255` | Broadcast to everything on the network |
| `x.x.x.0` | Network address, cannot be used by a device |
| `x.x.x.255` | Broadcast address of that network |
| `169.254.0.0/16` | The machine gives itself this when DHCP fails |
| `224.0.0.0` to `239.255.255.255` | Multicast |

`0.0.0.0` comes up a lot in Docker. In `docker ps` the port shows as `0.0.0.0:8080->3000/tcp`,
and in my Python app I wrote `app.run(host="0.0.0.0")`. Both mean listen on all interfaces
instead of only on loopback.

---

# The commands

## ip addr

```bash
$ ip addr show eth0
11: eth0: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 65535 state UP
    link/ether da:8d:3c:47:22:49 brd ff:ff:ff:ff:ff:ff
    inet 172.17.0.3/16 brd 172.17.255.255 scope global eth0
```

- `UP,LOWER_UP` means the interface is on and the cable is connected
- `link/ether` is the MAC address, the hardware address used on the local network
- `inet 172.17.0.3/16` is the IP and the mask
- `brd 172.17.255.255` is the broadcast address, which is what a /16 mask gives

## ip route

```bash
$ ip route
default via 172.17.0.1 dev eth0
172.17.0.0/16 dev eth0 proto kernel scope link src 172.17.0.3
```

Anything in 172.17.0.0/16 is on my own network and goes out directly. Everything else goes to
the gateway at 172.17.0.1, which is the way out of the network.

## ping

`ping` sends an ICMP packet and waits for the reply. It shows if a machine is reachable and
how long it takes.

```bash
$ ping -c 4 172.17.0.1
64 bytes from 172.17.0.1: icmp_seq=1 ttl=64 time=0.363 ms
64 bytes from 172.17.0.1: icmp_seq=2 ttl=64 time=0.134 ms
--- 172.17.0.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
rtt min/avg/max/mdev = 0.100/0.179/0.363/0.106 ms
```

```bash
$ ping -c 4 8.8.8.8
64 bytes from 8.8.8.8: icmp_seq=1 ttl=63 time=20.2 ms
--- 8.8.8.8 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss
rtt min/avg/max/mdev = 18.030/21.134/23.554/2.166 ms
```

0.179 ms to my own gateway and 21 ms to 8.8.8.8. The difference is distance and the number of
routers in between.

| Field | Meaning |
|---|---|
| `icmp_seq` | Sequence number, a gap means a lost packet |
| `ttl` | Time to live left in the packet |
| `time` | Round trip time |
| `packet loss` | Anything above 0% is a problem |

**TTL** goes down by 1 at every router. Linux starts at 64, so the gateway reply with `ttl=64`
had no router in between and 8.8.8.8 with `ttl=63` had one hop.

## When ping fails

```bash
$ ping -c 2 -W 2 10.255.255.1
2 packets transmitted, 0 received, 100% packet loss

$ ping -c 1 thisnamedoesnotexistatall.example
ping: thisnamedoesnotexistatall.example: Name or service not known
```

These two mean different things:

- **100% packet loss** means the name worked but the network did not
- **Name or service not known** means DNS failed and it never even tried the network

That is why `ping 8.8.8.8` and `ping google.com` are used together. If the IP works but the
name fails, DNS is broken. If both fail, the connection is down.

## ping with a name

```bash
$ ping -c 3 google.com
PING google.com (172.217.24.206) 56(84) bytes of data.
64 bytes from 172.217.24.206: icmp_seq=1 ttl=63 time=29.4 ms
64 bytes from 172.217.24.206: icmp_seq=2 ttl=63 time=13.8 ms
```

DNS turns the name into an IP first, then the ping starts. The first packet is slower because
of the DNS lookup.

## DNS

```bash
$ nslookup google.com
Server:		192.168.65.7
Address:	192.168.65.7#53
Name:	google.com
Address: 172.217.24.206

$ dig +short google.com
172.217.24.206
```

`#53` is the port, because DNS runs on port 53.

## Checking a port

`ping` only says if the machine is up. To check a service, check the port:

```bash
$ nc -zv -w 3 github.com 443
Connection to github.com (20.207.73.82) 443 port [tcp/https] succeeded!

$ nc -zv -w 3 github.com 23
nc: connect to github.com port 23 (tcp) timed out
```

Port 443 is HTTPS and is open. Port 23 is telnet and is closed.

## Ports listening on the machine

```bash
$ ss -tuln
Netid State  Recv-Q Send-Q Local Address:Port
tcp   LISTEN 0      511          0.0.0.0:80
tcp   LISTEN 0      4096   127.0.0.53%lo:53
```

nginx on `0.0.0.0:80` can be reached from outside. The DNS resolver on `127.0.0.53:53` is
loopback only, so nothing outside the machine can reach it.

## traceroute

```bash
$ traceroute -m 8 8.8.8.8
traceroute to 8.8.8.8 (8.8.8.8), 8 hops max
 1  172.17.0.1 (172.17.0.1)  0.082 ms  0.007 ms  0.005 ms
 2  * * *
 3  * * *
```

Only the first hop showed up. `traceroute` works by sending packets with TTL 1, then 2, and so
on, and each router that drops a packet sends back a message revealing itself. My containers
run inside the Docker Desktop VM on a Mac, and the NAT in between does not pass those messages
back, so the rest show as `*`. On a normal Linux machine it would list every router.

## curl

```bash
$ curl -I https://github.com
HTTP/2 200
date: Mon, 31 Aug 2026 11:51:23 GMT
content-type: text/html; charset=utf-8
```

`-I` gets only the headers, so it is a quick way to check a website is working.

## Command summary

| Command | What it answers |
|---|---|
| `ip addr` | What IP do I have |
| `ip route` | Where do my packets go |
| `ping host` | Is it reachable |
| `traceroute host` | What path do packets take |
| `nslookup name` | What IP does this name have |
| `nc -zv host port` | Is that port open |
| `ss -tuln` | What is listening here |
| `curl -I url` | Is the website working |

## Order to check things when the network is broken

1. `ip addr` to see if I have an address
2. `ip route` to see if there is a gateway
3. `ping <gateway>` to check the local network
4. `ping 8.8.8.8` to check the internet
5. `ping google.com` to check DNS
6. `nc -zv host port` to check the service

Wherever it first fails is where the problem is.

## Common ports

| Port | Service |
|---|---|
| 22 | SSH |
| 53 | DNS |
| 80 | HTTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 8080 | HTTP alternate |
