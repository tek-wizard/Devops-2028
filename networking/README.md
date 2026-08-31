# Networking (Session 4)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework that was given

Practise the networking commands from the session, mainly `ping` and the subnetting work,
along with the special IP addresses, and put what I understood into an MD file with the
output.

So this file has the IP addressing theory worked through by hand, then every command run for
real with its output pasted in.

I ran the commands inside an Ubuntu container, because the class is Linux based and my
laptop is a MacBook where some of these tools behave differently:

```bash
docker run -dit --name devops-lab --hostname devops-lab ubuntu:24.04 bash
docker exec -it devops-lab bash
apt update && apt install -y iproute2 iputils-ping net-tools dnsutils traceroute ipcalc netcat-openbsd
```

---

# Part 1: IP addresses

## What an IP address is

An IP address is a number that identifies one device on a network. IPv4 uses 32 bits,
written as four numbers separated by dots, where each number is one byte and so can be 0 to
255. That gives about 4.3 billion addresses in total, which sounded like plenty in the 1980s
and is the reason IPv6 exists now.

The thing that took me longest to get is that an IP address is **two things joined
together**, not one:

- the **network part**, which says which network the device is on
- the **host part**, which says which device it is inside that network

Where the split falls is not visible in the address itself. The subnet mask is what says
where it falls. This is why `192.168.1.10` on its own is not enough information, it always
comes with a mask.

## Binary, because the rest does not make sense without it

Each of the four numbers is 8 bits:

```
      120    .     27     .      1     .      0
  01111000   .  00011011  .  00000001  .  00000000
```

The bit values in one byte are 128, 64, 32, 16, 8, 4, 2, 1. So `11111111` is
128+64+32+16+8+4+2+1 = 255, which is why 255 is the biggest number in an IP address, and
`00000000` is 0.

## Classes

The original design split the whole address space into classes based on the first number:

| Class | First number | Default mask | Network bits | Host bits | Hosts per network |
|---|---|---|---|---|---|
| A | 1 to 126 | 255.0.0.0 (/8) | 8 | 24 | 16,777,214 |
| B | 128 to 191 | 255.255.0.0 (/16) | 16 | 16 | 65,534 |
| C | 192 to 223 | 255.255.255.0 (/24) | 24 | 8 | 254 |
| D | 224 to 239 | not used this way | multicast | | |
| E | 240 to 255 | not used this way | reserved for experiments | | |

127 is missing from class A on purpose. The whole `127.0.0.0/8` block is loopback, so
`127.0.0.1` is always the machine you are typing on.

Classes are useful for exams and interviews, but real networks stopped working this way in
the 1990s. Class C giving only 254 hosts and class B giving 65,534 with nothing in between
wasted enormous numbers of addresses. CIDR replaced it, where the mask can be any length and
is written as a slash number.

## Subnet mask

The mask is a 32 bit number where the network bits are 1 and the host bits are 0. The 1s
always come first with no gaps, so there are only 33 possible masks.

| Mask | Slash | 1 bits |
|---|---|---|
| 255.0.0.0 | /8 | 8 |
| 255.255.0.0 | /16 | 16 |
| 255.255.255.0 | /24 | 24 |
| 255.255.255.192 | /26 | 26 |
| 255.255.255.252 | /30 | 30 |

Lining an address up with its mask shows the split:

```
Address:   197.23.45.10        11000101.00010111.00101101.00001010
Netmask:   255.255.255.0 /24   11111111.11111111.11111111.00000000
                               \______ network, 24 bits ______/\host/
```

## The four numbers to be able to work out

For any address and mask:

- **Network address:** host bits all set to 0. The name of the network itself.
- **Broadcast address:** host bits all set to 1. Reaches every device on that network.
- **First usable host:** network address plus 1.
- **Last usable host:** broadcast address minus 1.

Number of hosts is 2 to the power of the host bits, and then subtract 2, because the network
address and the broadcast address cannot be given to a device.

## Worked by hand, the class example

`197.23.45.10` with mask `255.255.255.0`

- 197 is between 192 and 223, so class C, and /24 is its default mask.
- Network bits 24, host bits 32 minus 24 = 8.
- Hosts = 2^8 = 256, usable = 256 - 2 = **254**
- Network address: keep the first three bytes, zero the last, so **197.23.45.0**
- Broadcast: keep the first three, set the last to 255, so **197.23.45.255**
- Usable range: **197.23.45.1 to 197.23.45.254**

Then checked with `ipcalc`:

```bash
$ ipcalc 197.23.45.10/24
Address:   197.23.45.10         11000101.00010111.00101101. 00001010
Netmask:   255.255.255.0 = 24   11111111.11111111.11111111. 00000000
Wildcard:  0.0.0.255            00000000.00000000.00000000. 11111111
=>
Network:   197.23.45.0/24       11000101.00010111.00101101. 00000000
HostMin:   197.23.45.1          11000101.00010111.00101101. 00000001
HostMax:   197.23.45.254        11000101.00010111.00101101. 11111110
Broadcast: 197.23.45.255        11000101.00010111.00101101. 11111111
Hosts/Net: 254                   Class C
```

Matches. The space in the binary column is `ipcalc` marking exactly where the network part
ends and the host part begins, which is a nice way to see it.

## Worked by hand, the class A example

`120.27.1.0` with mask `255.0.0.0`, which is `120.27.1.0/8`

- 120 is between 1 and 126, so class A.
- Network bits 8, host bits 24.
- Hosts = 2^24 = 16,777,216, usable = **16,777,214**
- Network address: keep only the first byte, so **120.0.0.0**
- Broadcast: **120.255.255.255**
- Usable range: **120.0.0.1 to 120.255.255.254**

```bash
$ ipcalc 120.27.1.0/8
Address:   120.27.1.0           01111000. 00011011.00000001.00000000
Netmask:   255.0.0.0 = 8        11111111. 00000000.00000000.00000000
Wildcard:  0.255.255.255        00000000. 11111111.11111111.11111111
=>
Network:   120.0.0.0/8          01111000. 00000000.00000000.00000000
HostMin:   120.0.0.1            01111000. 00000000.00000000.00000001
HostMax:   120.255.255.254      01111000. 11111111.11111111.11111110
Broadcast: 120.255.255.255      01111000. 11111111.11111111.11111111
Hosts/Net: 16777214              Class A
```

The `.27.1` part of the address is completely ignored in working out the network, because
with a /8 mask those bytes are host bits. `120.27.1.0/8` and `120.99.200.5/8` are on the same
network.

## Subnetting: splitting a network into smaller ones

This is the part that actually matters in practice, and it is what the mask being adjustable
gives you. Borrowing bits from the host part creates more, smaller networks.

Take `192.168.10.0/24`, one network with 254 hosts. Borrowing 2 bits makes it /26:

- Host bits drop from 8 to 6, so hosts per subnet = 2^6 - 2 = **62**
- Number of subnets = 2^2 = **4**
- The mask becomes 255.255.255.192, because `11000000` is 128 + 64 = 192

```bash
$ ipcalc 192.168.10.0/26
Address:   192.168.10.0         11000000.10101000.00001010.00 000000
Netmask:   255.255.255.192 = 26 11111111.11111111.11111111.11 000000
Wildcard:  0.0.0.63             00000000.00000000.00000000.00 111111
=>
Network:   192.168.10.0/26      11000000.10101000.00001010.00 000000
HostMin:   192.168.10.1         11000000.10101000.00001010.00 000001
HostMax:   192.168.10.62        11000000.10101000.00001010.00 111110
Broadcast: 192.168.10.63        11000000.10101000.00001010.00 111111
Hosts/Net: 62                    Class C, Private Internet
```

And all four subnets:

```bash
$ ipcalc 192.168.10.0/24 -s 62 62 62 62
Network:   192.168.10.0/26      11000000.10101000.00001010.00 000000
HostMin:   192.168.10.1
HostMax:   192.168.10.62
Broadcast: 192.168.10.63

Network:   192.168.10.64/26     11000000.10101000.00001010.01 000000
HostMin:   192.168.10.65
HostMax:   192.168.10.126
Broadcast: 192.168.10.127

Network:   192.168.10.128/26    11000000.10101000.00001010.10 000000
HostMin:   192.168.10.129
HostMax:   192.168.10.190
Broadcast: 192.168.10.191

Network:   192.168.10.192/26    11000000.10101000.00001010.11 000000
HostMin:   192.168.10.193
HostMax:   192.168.10.254
Broadcast: 192.168.10.255
```

Look at the two borrowed bits in the binary column: `00`, `01`, `10`, `11`. Those two bits
are the subnet number, and that is literally all subnetting is. The networks step by 64 each
time, because 64 is the block size, and 256 divided by 4 subnets is 64.

Handy table for /24 splits:

| Slash | Mask | Block size | Subnets | Usable hosts each |
|---|---|---|---|---|
| /24 | 255.255.255.0 | 256 | 1 | 254 |
| /25 | 255.255.255.128 | 128 | 2 | 126 |
| /26 | 255.255.255.192 | 64 | 4 | 62 |
| /27 | 255.255.255.224 | 32 | 8 | 30 |
| /28 | 255.255.255.240 | 16 | 16 | 14 |
| /29 | 255.255.255.248 | 8 | 32 | 6 |
| /30 | 255.255.255.252 | 4 | 64 | 2 |

/30 giving 2 usable hosts is not a mistake, it is used all the time for a point to point
link between two routers where only two addresses are ever needed.

## Private IP ranges

These are the blocks reserved for internal networks. They are not routed on the internet, so
everyone can reuse them, and that is what NAT on a home router is doing.

| Class | Range | CIDR | Where you see it |
|---|---|---|---|
| A | 10.0.0.0 to 10.255.255.255 | 10.0.0.0/8 | Big company networks, AWS VPCs |
| B | 172.16.0.0 to 172.31.255.255 | 172.16.0.0/12 | Docker uses this one |
| C | 192.168.0.0 to 192.168.255.255 | 192.168.0.0/16 | Home routers |

The class B range is worth reading carefully. It is 172.16 to 172.31, not all of 172. So
`172.20.0.5` is private and `172.35.0.5` is public.

`ipcalc` labelled `192.168.10.0` as "Class C, Private Internet" above, so it knows about
these ranges too.

## Special addresses

| Address | What it means |
|---|---|
| `0.0.0.0` | "This host, unknown address", and when a server binds to it, "all interfaces" |
| `127.0.0.1` | Loopback, this machine. The whole `127.0.0.0/8` block is loopback |
| `255.255.255.255` | Broadcast to everything on the local link |
| `x.x.x.0` in a /24 | The network address, not usable by a device |
| `x.x.x.255` in a /24 | The broadcast address for that network |
| `169.254.0.0/16` | Link local. A machine gives itself one of these when DHCP fails, so seeing one usually means the network is broken |
| `224.0.0.0` to `239.255.255.255` | Multicast, class D |
| `8.8.8.8` and `1.1.1.1` | Not special in the protocol, they are just Google's and Cloudflare's public DNS servers, handy for testing |

The `0.0.0.0` one is worth dwelling on because it turns up constantly in Docker. In
`docker ps` the mapping shows as `0.0.0.0:8080->3000/tcp`, and in the Flask app I wrote
`app.run(host="0.0.0.0")`. In both cases it means listen on every interface rather than only
loopback, and that is exactly why the Flask app fails to be reachable if it is left on
`127.0.0.1`.

---

# Part 2: The commands, with output

## `ip addr`, what addresses this machine has

```bash
$ ip addr show eth0
11: eth0@if4240: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 65535 qdisc noqueue state UP group default
    link/ether da:8d:3c:47:22:49 brd ff:ff:ff:ff:ff:ff link-netnsid 0
    inet 172.17.0.3/16 brd 172.17.255.255 scope global eth0
       valid_lft forever preferred_lft forever
```

Reading it line by line:

- `eth0` is the interface name, and `UP,LOWER_UP` means the interface is enabled and the link
  is actually connected. If a machine has no network, this is the first thing to look at.
- `link/ether da:8d:3c:47:22:49` is the MAC address, the hardware level address that works
  only on the local link. IP addresses get routed between networks, MAC addresses do not.
- `inet 172.17.0.3/16` is the IP and mask. `172.17.x.x` is in the private class B range, and
  Docker uses that block for its default bridge.
- `brd 172.17.255.255` is the broadcast address, which is what a /16 mask on 172.17.0.3 gives,
  matching the hand calculation method above.

`ip addr` replaces the older `ifconfig`, which is no longer installed by default on modern
distributions.

## `ip route`, where packets go

```bash
$ ip route
default via 172.17.0.1 dev eth0
172.17.0.0/16 dev eth0 proto kernel scope link src 172.17.0.3
```

Two rules, and this is the whole routing decision:

- Anything in `172.17.0.0/16` is on my own network, so send it straight out of `eth0` with no
  router involved.
- Everything else has no matching rule, so it goes to the `default` route, which hands it to
  the gateway at `172.17.0.1`. The gateway is the way out of the local network.

This is why the subnet mask matters so much in practice. It is what decides "is this address
local, or does it need the router", and a wrong mask means a machine tries to reach a local
neighbour through the gateway, or the other way round.

## `ping`, is it reachable

`ping` sends an ICMP echo request and waits for an echo reply. It answers two questions at
once: can I reach it at all, and how long does a round trip take.

Something on my own network, the gateway:

```bash
$ ping -c 4 172.17.0.1
PING 172.17.0.1 (172.17.0.1) 56(84) bytes of data.
64 bytes from 172.17.0.1: icmp_seq=1 ttl=64 time=0.363 ms
64 bytes from 172.17.0.1: icmp_seq=2 ttl=64 time=0.134 ms
64 bytes from 172.17.0.1: icmp_seq=3 ttl=64 time=0.122 ms
64 bytes from 172.17.0.1: icmp_seq=4 ttl=64 time=0.100 ms

--- 172.17.0.1 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3101ms
rtt min/avg/max/mdev = 0.100/0.179/0.363/0.106 ms
```

Something far away, Google's public DNS:

```bash
$ ping -c 4 8.8.8.8
PING 8.8.8.8 (8.8.8.8) 56(84) bytes of data.
64 bytes from 8.8.8.8: icmp_seq=1 ttl=63 time=20.2 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=63 time=23.6 ms
64 bytes from 8.8.8.8: icmp_seq=3 ttl=63 time=22.7 ms
64 bytes from 8.8.8.8: icmp_seq=4 ttl=63 time=18.0 ms

--- 8.8.8.8 ping statistics ---
4 packets transmitted, 4 received, 0% packet loss, time 3009ms
rtt min/avg/max/mdev = 18.030/21.134/23.554/2.166 ms
```

Comparing the two is the interesting bit. **0.179 ms average to the gateway, 21 ms average
to 8.8.8.8.** Over a hundred times slower, and that is not because 8.8.8.8 is a slow
machine, it is distance and the number of hops in between. Physics puts a floor on latency
that no amount of bandwidth fixes.

The fields:

| Field | What it means |
|---|---|
| `64 bytes` | Size of the reply |
| `icmp_seq` | Sequence number. A gap here means a lost packet |
| `ttl` | Time to live left in the packet |
| `time` | Round trip, there and back |
| `packet loss` | The number to look at. Anything above 0% on a stable network is a problem |
| `mdev` | How much the times varied. High mdev means jitter, which is what ruins calls and games |

**TTL is the field worth understanding.** Every router that forwards a packet subtracts 1
from the TTL, and if it hits 0 the packet is thrown away. It exists so a misconfigured
network cannot have packets circling forever. The gateway reply came back with `ttl=64` and
8.8.8.8 came back with `ttl=63`. Linux starts at 64, so `64` means zero routers in between,
it is directly attached, and `63` means one hop. So TTL is a rough hop counter for free.

## When ping fails, and the two different failures

An address that does not answer:

```bash
$ ping -c 2 -W 2 10.255.255.1
--- 10.255.255.1 ping statistics ---
2 packets transmitted, 0 received, 100% packet loss, time 1039ms
```

A name that does not resolve:

```bash
$ ping -c 1 thisnamedoesnotexistatall.example
ping: thisnamedoesnotexistatall.example: Name or service not known
```

These two failures look similar but mean opposite things, and telling them apart is most of
network troubleshooting.

- **100% packet loss** means DNS worked and the network did not. The address was found, the
  packets went out, nothing came back. Could be the host being down, a firewall dropping
  ICMP, or no route.
- **Name or service not known** means it never got as far as the network. DNS failed. The
  network itself might be perfectly fine.

That is why `ping 8.8.8.8` and `ping google.com` are the classic pair of tests. IP works but
the name fails means DNS is broken. Both fail means the connection is down.

The same thing showed up in the Docker networking task, where containers on separate networks
failed with `bad address`, a DNS failure, rather than a timeout.

`-W 2` sets the timeout to 2 seconds, otherwise a dead address makes ping sit there.

## `ping` with a name, so DNS happens first

```bash
$ ping -c 3 google.com
PING google.com (172.217.24.206) 56(84) bytes of data.
64 bytes from pnmaaa-at-in-f14.1e100.net (172.217.24.206): icmp_seq=1 ttl=63 time=29.4 ms
64 bytes from pnmaaa-at-in-f14.1e100.net (172.217.24.206): icmp_seq=2 ttl=63 time=13.8 ms
64 bytes from pnmaaa-at-in-f14.1e100.net (172.217.24.206): icmp_seq=3 ttl=63 time=13.2 ms

--- google.com ping statistics ---
3 packets transmitted, 3 received, 0% packet loss, time 2005ms
rtt min/avg/max/mdev = 13.164/18.795/29.440/7.531 ms
```

`ping` resolved the name to `172.217.24.206` before sending anything, and it also did a
reverse lookup on the way back which is where `pnmaaa-at-in-f14.1e100.net` comes from.
`1e100.net` is Google's own domain for its servers, 1e100 being 1 followed by 100 zeros,
a googol.

The first packet took 29.4 ms and the next two took about 13 ms. The first one is slower
because of the DNS lookup and the ARP resolution that had not been cached yet.

## DNS lookups

```bash
$ nslookup google.com
Server:		192.168.65.7
Address:	192.168.65.7#53

Non-authoritative answer:
Name:	google.com
Address: 172.217.24.206
```

`Server` is which DNS server answered, and `#53` is the port, since DNS runs on port 53.
"Non-authoritative" means this server is not the owner of the google.com zone, it is giving
me a cached answer, which is normal and much faster.

```bash
$ dig +short google.com
172.217.24.206
```

`dig` is the tool network people actually use because it shows the full DNS response with
sections and record types. `+short` cuts it down to the answer.

Common record types worth knowing:

| Type | What it holds |
|---|---|
| `A` | An IPv4 address |
| `AAAA` | An IPv6 address |
| `CNAME` | An alias pointing at another name |
| `MX` | Mail servers for the domain |
| `NS` | Which name servers are authoritative |
| `TXT` | Free text, used for domain verification and SPF |

## `traceroute`, the path a packet takes

```bash
$ traceroute -m 8 -w 2 8.8.8.8
traceroute to 8.8.8.8 (8.8.8.8), 8 hops max, 60 byte packets
 1  172.17.0.1 (172.17.0.1)  0.082 ms  0.007 ms  0.005 ms
 2  * * *
 3  * * *
 4  * * *
 5  * * *
 6  * * *
 7  * * *
 8  * * *
```

Hop 1 is my gateway, then everything after it is stars.

That is not a broken command, and working out why taught me more than a clean result would
have. `traceroute` works by abusing TTL. It sends a packet with TTL 1, the first router
decrements it to 0, throws it away and politely sends back an ICMP "time exceeded" message
which reveals that router's address. Then TTL 2 to find the second router, and so on. So
traceroute depends entirely on routers being willing to send those ICMP messages back.

My containers run inside the Docker Desktop Linux VM on a Mac, and the layers of NAT between
that VM and the real network do not pass those ICMP time exceeded messages back through. So
after the first hop there is nothing to report and traceroute prints `*`. On a normal Linux
machine on a real network this would have listed every router along the way.

Stars in the middle of an otherwise complete traceroute usually mean one router is configured
not to reply, which is common and does not mean traffic is not passing through it.

## Checking ports

`ping` says whether a machine is reachable. It says nothing about whether the service you
want is running, because that is TCP and ports, not ICMP. `nc` checks a specific port:

```bash
$ nc -zv -w 3 github.com 443
Connection to github.com (20.207.73.82) 443 port [tcp/https] succeeded!

$ nc -zv -w 3 github.com 23
nc: connect to github.com (20.207.73.82) port 23 (tcp) timed out: Operation now in progress
```

Same host, two results. Port 443 is HTTPS and it is open. Port 23 is telnet, and it is
closed, which is correct because nobody should be running telnet in 2026.

`-z` means just check, do not send data. `-v` prints the result. `-w 3` gives up after 3
seconds.

This is the everyday DevOps test. "The app is down" usually turns into: can I ping the
server, and is the port open. If ping works and the port is closed, the machine is fine and
the service is not running or a firewall is in the way.

## Ports currently listening

```bash
$ ss -tuln
Netid State  Recv-Q Send-Q Local Address:Port Peer Address:Port
udp   UNCONN 0      0         127.0.0.54:53        0.0.0.0:*
udp   UNCONN 0      0      127.0.0.53%lo:53        0.0.0.0:*
tcp   LISTEN 0      511          0.0.0.0:80        0.0.0.0:*
tcp   LISTEN 0      4096   127.0.0.53%lo:53        0.0.0.0:*
tcp   LISTEN 0      4096      127.0.0.54:53        0.0.0.0:*
tcp   LISTEN 0      511             [::]:80           [::]:*
```

The two addresses in the `Local Address` column are the interesting part, and it is the same
`0.0.0.0` idea from the special addresses section:

- `0.0.0.0:80` means nginx is listening on **every** interface, so it can be reached from
  outside the machine.
- `127.0.0.53:53` means the DNS resolver is listening on loopback **only**, so nothing
  outside this machine can reach it.

That difference is a real security control and it is also the exact reason a Flask app on
`127.0.0.1` inside a container is unreachable from the host.

| Flag | Meaning |
|---|---|
| `-t` | TCP |
| `-u` | UDP |
| `-l` | Only listening sockets |
| `-n` | Numbers instead of service names, and it is faster because it skips DNS |
| `-p` | Which process owns the socket, needs root |

The older tool does the same job:

```bash
$ netstat -tuln
Active Internet connections (only servers)
Proto Recv-Q Send-Q Local Address           Foreign Address         State
tcp        0      0 0.0.0.0:9000            0.0.0.0:*               LISTEN

$ netstat -i
Kernel Interface table
Iface             MTU    RX-OK RX-ERR RX-DRP RX-OVR    TX-OK TX-ERR TX-DRP TX-OVR Flg
eth0            65535     4479      0      0 0          2329      0      0      0 BMRU
lo              65536        0      0      0 0             0      0      0      0 LRU
```

`netstat -i` is useful because `RX-ERR` and `RX-DRP` are error and drop counters. If those
climb, something physical is wrong, a bad cable or a failing card, rather than a
configuration problem.

## HTTP without downloading the page

```bash
$ curl -I https://github.com
HTTP/2 200
date: Mon, 31 Aug 2026 11:51:23 GMT
content-type: text/html; charset=utf-8
content-language: en-US
vary: X-PJAX, X-PJAX-Container, Turbo-Visit, Turbo-Frame, ...
etag: W/"29280dc9eb882b26cde0b621e0990d0b"
cache-control: max-age=0, private, must-revalidate
strict-transport-security: max-age=31536000; includeSubdomains; preload
```

`-I` fetches only the headers. `HTTP/2 200` is the whole answer when checking if a site is
up, and it is a lot lighter than downloading the page.

This is the top of the stack, and it makes the layers concrete. To get that one line: DNS
turned `github.com` into an IP, routing decided where to send the packets, TCP made a
connection to port 443, TLS encrypted it, and only then did HTTP ask for the headers. When
something is broken, working up from the bottom is much faster than guessing.

## Command summary

| Command | Question it answers |
|---|---|
| `ip addr` | What IP addresses do I have |
| `ip route` | Where do my packets go |
| `ping host` | Is it reachable, and how far away |
| `traceroute host` | What path do packets take |
| `nslookup name` / `dig name` | What IP does this name resolve to |
| `nc -zv host port` | Is that specific port open |
| `ss -tuln` | What is listening on this machine |
| `netstat -i` | Interface statistics and error counters |
| `curl -I url` | Is the web service actually answering |
| `hostname -I` | My IP, short version |
| `arp -a` | MAC addresses seen on the local network |

## A troubleshooting order that follows the layers

Going bottom up saves a lot of guessing:

1. `ip addr`: do I even have an address, and is the link up
2. `ip route`: is there a default route
3. `ping <gateway>`: can I reach my own router
4. `ping 8.8.8.8`: can I reach the internet by IP
5. `ping google.com`: does DNS work
6. `nc -zv host port`: is the service's port open
7. `curl -I url`: is the application actually replying

Where it first fails tells you which layer to fix. Steps 4 and 5 are the pair that separates
a connectivity problem from a DNS problem, which is the most common confusion of the lot.

---

# Part 3: Notes on the surrounding topics

## OSI layers

Seven layers, but the ones that come up daily are 2, 3, 4 and 7.

| Layer | Name | What lives there | Address used | Device |
|---|---|---|---|---|
| 7 | Application | HTTP, DNS, SSH | URL, hostname | |
| 6 | Presentation | TLS, encoding | | |
| 5 | Session | Session handling | | |
| 4 | Transport | TCP, UDP | Port number | Firewall, load balancer |
| 3 | Network | IP, ICMP, routing | IP address | Router |
| 2 | Data link | Ethernet, ARP | MAC address | Switch |
| 1 | Physical | Cables, radio | | Hub, cable |

The practical version: a **switch** works at layer 2 with MAC addresses and moves frames
inside one network. A **router** works at layer 3 with IP addresses and moves packets between
networks. `ping` is layer 3, `nc -z` on a port is layer 4, `curl` is layer 7. The gateway in
`ip route` is a router, and it is the only way out of the local network.

TCP versus UDP at layer 4:

| | TCP | UDP |
|---|---|---|
| Connection | Handshake first | Just sends |
| Delivery | Guaranteed, retransmits | No guarantee |
| Order | Kept in order | Can arrive out of order |
| Speed | Slower, more overhead | Faster, minimal overhead |
| Used by | HTTP, SSH, MySQL, most things | DNS, video calls, streaming |

DNS on UDP is the good example of why UDP exists. A lookup is one small question and one
small answer, so a TCP handshake would cost more than just asking again if it gets lost.

## Common ports

| Port | Service |
|---|---|
| 20, 21 | FTP |
| 22 | SSH |
| 23 | Telnet, obsolete and insecure |
| 25 | SMTP |
| 53 | DNS |
| 67, 68 | DHCP |
| 80 | HTTP |
| 123 | NTP |
| 443 | HTTPS |
| 3306 | MySQL |
| 5432 | PostgreSQL |
| 6379 | Redis |
| 8080 | HTTP alternate, very common for apps in containers |
| 27017 | MongoDB |

3306 turned up for real in the Docker networking task, where `nc -z db 3306` was how I proved
the backend container could reach MySQL.

## How DHCP works

Without DHCP every device would need its address typed in by hand. DHCP hands them out
automatically in four steps, remembered as DORA:

1. **Discover**: the new device broadcasts to 255.255.255.255 asking if there is a DHCP
   server, since it has no address yet and cannot address anyone directly.
2. **Offer**: a server replies offering an address, a mask, a gateway and DNS servers.
3. **Request**: the device says yes to that offer, still by broadcast, so any other DHCP
   servers know their offers were not taken.
4. **Acknowledge**: the server confirms and records the lease.

The address is a **lease** with an expiry, not a permanent gift, and the device renews it
part way through. This is where `169.254.x.x` comes from: if no DHCP server answers, the
machine assigns itself a link local address, so seeing one is a strong hint that DHCP is
down or the machine is on the wrong network.

Docker is doing the same job in miniature. I never assigned an address to any container and
they all got one, plus a gateway and a DNS server at 127.0.0.11.

## NAT, and why private addresses work at all

Private ranges are reused by everyone, so they cannot be routed on the internet. NAT is what
bridges that. The router replaces the private source address with its own single public
address on the way out, remembers the mapping in a table, and swaps it back on the replies.
That is how a whole house of devices shares one public IP, and it is also why an incoming
connection from outside does not reach a device on the inside unless a port forward is set up.

Docker does exactly this. A container has a private `172.x.x.x` address, and `-p 8080:80` is
a port forward through Docker's NAT. That is why `docker ps` shows `0.0.0.0:8080->80/tcp`,
and why the container can reach the internet but nothing on the internet can reach it unless
a port is published.

## NTP

NTP keeps clocks in sync over UDP port 123. It sounds unimportant until a clock drifts, and
then TLS certificates look expired, logs from different servers cannot be lined up, and
token based authentication starts rejecting valid tokens. I actually saw a clock message in
the journal while doing the Linux tasks:

```
Aug 31 11:35:07 systemd-lab systemd-resolved[72]: Clock change detected. Flushing caches.
```

## NetFlow and IPFIX

These are not troubleshooting tools, they are traffic accounting. Instead of capturing every
packet, a router summarises conversations into flow records, source and destination address,
ports, protocol, byte and packet counts, and exports them to a collector. NetFlow is Cisco's
version and IPFIX is the standardised one based on it. They are what answers questions like
which host is using all the bandwidth, or which internal machine is talking to somewhere it
should not be, without the cost of storing full packet captures.

---

# What I took away

- An IP address is meaningless without its mask, because the mask is the only thing that says
  where the network part ends.
- Subnetting is just borrowing bits from the host part. The borrowed bits become the subnet
  number, which is visible in the binary output from `ipcalc`.
- TTL in a ping reply is a free hop counter, and it is also the mechanism traceroute is built
  on.
- "100% packet loss" and "Name or service not known" are completely different problems. One
  is the network, the other is DNS.
- `0.0.0.0` versus `127.0.0.1` is the same idea whether it is in `ss -tuln`, in a Flask app,
  or in `docker ps`.
- Working up from the bottom layer is faster than guessing, because whichever step fails
  first tells you where the problem is.
