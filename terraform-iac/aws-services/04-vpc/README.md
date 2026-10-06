# VPC, Virtual Private Cloud

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## What a VPC is

A VPC is my own private network inside AWS. I choose the IP range, split it into subnets,
and control what can reach what. Nothing in it is reachable from the internet unless I
deliberately make it so.

This builds directly on the [networking homework](../../../networking): the CIDR notation,
subnet masks and private IP ranges are exactly the same, applied to a cloud network.

## CIDR and address planning

A VPC gets a CIDR block, usually from the private ranges:

```
10.0.0.0/16        65,536 addresses
172.16.0.0/16      the range Docker also uses
192.168.0.0/16     common on home networks
```

`/16` is the usual choice because it leaves plenty of room to carve out subnets. The block
**cannot be changed after creation** without rebuilding, so it is worth planning. Overlapping
ranges between two VPCs makes peering them impossible later, which is a real problem when two
teams both pick `10.0.0.0/16`.

AWS takes **5 addresses** out of every subnet: network address, VPC router, DNS, one reserved,
and broadcast. So a `/24` with 256 addresses gives 251 usable, not 254 as it would on a normal
network.

## Subnets

A subnet is a slice of the VPC range, and each one lives in exactly one **availability zone**.
That is the key point: subnets are how a design spreads across AZs for resilience.

**Public subnet** — has a route to an internet gateway. For load balancers and bastion hosts.

**Private subnet** — no direct route in from the internet. For application servers and
databases. This is where most things belong.

A typical two-AZ layout:

| Subnet | CIDR | AZ | Type |
|---|---|---|---|
| public-1a | 10.0.1.0/24 | ap-south-1a | Public |
| public-1b | 10.0.2.0/24 | ap-south-1b | Public |
| private-1a | 10.0.11.0/24 | ap-south-1a | Private |
| private-1b | 10.0.12.0/24 | ap-south-1b | Private |

## Gateways

**Internet Gateway (IGW)** attaches to the VPC and lets public subnets reach the internet both
ways. One per VPC, and it costs nothing.

**NAT Gateway** lets private subnets reach **out** to the internet, for things like downloading
packages, while blocking anything coming in. It sits in a public subnet.

NAT Gateways are the expensive surprise in a VPC bill. They are charged per hour **and** per
GB processed. One per AZ is the resilient design and multiplies that cost. A common saving is
a **VPC endpoint** for S3, which routes S3 traffic privately and skips the NAT entirely.

## Route tables

A route table decides where traffic goes, the same `ip route` idea from the networking
homework.

A public subnet's table:

| Destination | Target |
|---|---|
| 10.0.0.0/16 | local |
| 0.0.0.0/0 | igw-xxxx |

A private subnet's table:

| Destination | Target |
|---|---|
| 10.0.0.0/16 | local |
| 0.0.0.0/0 | nat-xxxx |

The `local` route is automatic and cannot be removed, which is what makes everything inside
the VPC able to reach everything else by default. **What actually makes a subnet "public" is
that `0.0.0.0/0` route to an internet gateway**, nothing else.

## Security groups and NACLs

Two layers of filtering, and they behave differently.

| | Security group | Network ACL |
|---|---|---|
| Attached to | An instance or ENI | A subnet |
| Rules | Allow only | Allow and deny |
| State | Stateful, replies allowed automatically | Stateless, both directions needed |
| Evaluation | All rules together | In number order, first match wins |

Stateless is the one that catches people. With a NACL, allowing inbound 443 is not enough,
the reply goes out on a high ephemeral port so outbound 1024 to 65535 has to be allowed too.

In practice security groups do almost all the work, and NACLs are used for coarse blocks like
banning an IP range.

## VPC endpoints

Let resources reach AWS services without going over the internet.

- **Gateway endpoints** for S3 and DynamoDB, free, added as a route
- **Interface endpoints** for most other services, charged per hour, an ENI in the subnet

Worth it for security, since traffic never leaves the AWS network, and for cost, since it
skips NAT charges.

## Connecting VPCs

| Option | For |
|---|---|
| Peering | Two VPCs, one to one, not transitive |
| Transit Gateway | Many VPCs through one hub |
| VPN | Office to AWS over the internet, encrypted |
| Direct Connect | A dedicated physical line |

Peering is simple but does not scale, because ten VPCs fully meshed means 45 connections. That
is what Transit Gateway solves.

## A standard design

```
VPC 10.0.0.0/16
├── Public subnets  (2 AZs)  -> Internet Gateway
│     Load balancer, NAT Gateway
├── Private app subnets (2 AZs) -> NAT Gateway
│     EC2, EKS nodes
└── Private data subnets (2 AZs) -> no internet route at all
      RDS, ElastiCache
```

Three tiers, each more protected than the last, spread over two AZs. The database tier has no
route to the internet in either direction.

## Things that go wrong

| Symptom | Usual cause |
|---|---|
| Instance in a public subnet unreachable | No public IP, or no `0.0.0.0/0` route, or the security group |
| Private instance cannot download packages | No NAT Gateway, or no route to it |
| Cannot peer two VPCs | Their CIDR blocks overlap |
| Large unexplained bill | NAT Gateway data processing |
| Works one way only | A NACL, because it is stateless |
