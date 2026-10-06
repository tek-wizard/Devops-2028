# EC2, Elastic Compute Cloud

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## What EC2 is

EC2 is virtual servers in AWS. An **instance** is one virtual machine, and I choose the CPU
and memory, the operating system, the network it sits in and the storage attached to it.

It is the oldest and most general AWS compute service. Anything that runs on a Linux or
Windows box can run on EC2, which is also its weakness: I am responsible for patching,
scaling and keeping it alive.

## Instance types

Named like `t3.micro`, which reads as family `t`, generation `3`, size `micro`.

| Family | Built for | Example use |
|---|---|---|
| `t` | General purpose, burstable | Small web servers, dev boxes |
| `m` | General purpose, steady | Application servers |
| `c` | Compute heavy | Batch jobs, video encoding |
| `r` | Memory heavy | Databases, caches |
| `g` and `p` | GPU | Machine learning, rendering |

The `t` family is worth understanding because it is the cheap one and it is **burstable**. It
earns CPU credits while idle and spends them under load. Run it hard for long enough and the
credits run out and it gets throttled, which looks like a mysterious slowdown.

`t2.micro` and `t3.micro` are in the free tier, which is why they turn up in every tutorial.

## AMI

An **Amazon Machine Image** is the template an instance boots from: the OS and whatever was
baked in. There are AWS-provided ones like Amazon Linux and Ubuntu, marketplace ones, and
custom ones I build myself.

Building a custom AMI with the app already installed makes new instances start in seconds
instead of installing everything on boot. This is the same idea as a Docker image, one layer
up.

## Storage

**EBS** is a network attached disk. It survives the instance being stopped and started, can
be detached and reattached, and can be snapshotted for backup.

**Instance store** is a disk physically attached to the host. It is faster but it is
**ephemeral**, so everything on it is lost when the instance stops. Good for scratch and cache,
wrong for anything that matters.

The catch to remember: EBS volumes are charged whether the instance is running or not, and
deleting an instance does not always delete its volumes.

## Security groups

A security group is a firewall around the instance.

- Rules are **allow only**, there is no deny rule
- They are **stateful**, so a reply to an allowed inbound request goes out automatically
- Default is: deny all inbound, allow all outbound

A typical web server:

| Direction | Port | Source | Why |
|---|---|---|---|
| Inbound | 443 | 0.0.0.0/0 | HTTPS from anywhere |
| Inbound | 80 | 0.0.0.0/0 | HTTP, usually redirected to HTTPS |
| Inbound | 22 | my office IP only | SSH, never from 0.0.0.0/0 |

Opening 22 to the whole internet is the classic mistake. Bots find it within minutes.

A nice pattern is to reference one security group from another: the database security group
allows 3306 **from the web security group** rather than from an IP range, so it keeps working
as instances come and go.

## Key pairs

SSH access uses a key pair. AWS keeps the public key and I keep the private `.pem` file. Lose
the private key and there is no way to recover it, so the usual fix is to detach the volume
and attach it to another instance, which is painful. Session Manager avoids SSH keys entirely
and is the better answer on a real account.

## Pricing models

| Model | What it is | Good for |
|---|---|---|
| On-demand | Pay per second, no commitment | Short or unpredictable work |
| Reserved | Commit 1 or 3 years for a big discount | Steady baseline load |
| Savings Plans | Commit to spend per hour, more flexible | Steady but changing shape |
| Spot | Spare capacity, very cheap, can be taken back with 2 minutes notice | Batch jobs that can be interrupted |
| Dedicated hosts | A physical server to myself | Licensing or compliance rules |

Spot is up to about 90% cheaper, which is excellent for CI runners and batch work and useless
for a database.

## Scaling

- **Vertical** is a bigger instance type. Simple, but it needs a restart and there is a limit.
- **Horizontal** is more instances behind a load balancer, with an Auto Scaling Group adding
  and removing them on a metric like CPU.

This is exactly the Horizontal Pod Autoscaler idea from the Kubernetes homework, one level
down: there the unit was a Pod, here it is a whole virtual machine. Pods scale in seconds and
EC2 instances take minutes, which is a lot of why containers are attractive.

## EC2 compared with containers

EC2 gives a whole machine to manage. ECS and EKS run containers on top of EC2 or on Fargate,
where AWS runs the machines. Lambda goes further and runs just a function.

The trade is control against operational work. EC2 is the most control and the most work.

## Typical setup

- Instances in **private** subnets, with a load balancer in the public subnets
- An **IAM role** attached rather than access keys on disk
- Security groups allowing only the ports actually needed
- An Auto Scaling Group across at least two availability zones
- EBS snapshots on a schedule
