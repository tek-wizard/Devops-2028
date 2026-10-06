# DynamoDB and RDS

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

Two managed database services that solve different problems. The useful thing is knowing which
one a given job needs.

---

# RDS, Relational Database Service

## What it is

RDS runs a normal relational database for me. Same MySQL or PostgreSQL I would install myself,
except AWS handles backups, patching, failover and replicas.

Engines available: MySQL, PostgreSQL, MariaDB, Oracle, SQL Server, and Aurora, which is
Amazon's own MySQL and PostgreSQL compatible engine.

## What AWS does and what stays mine

| AWS handles | I still handle |
|---|---|
| OS and database patching | Schema design and indexes |
| Automated backups and restore | Query performance |
| Replication and failover | Choosing the instance size |
| Monitoring metrics | Security groups and access |

The point is I lose shell access to the box. No SSH into an RDS instance, which rules out
some tuning but removes most of the maintenance.

## Multi-AZ and read replicas

These two get mixed up constantly and do different jobs.

**Multi-AZ** keeps a **synchronous standby** in another availability zone. It is for
availability, not performance. The standby takes no traffic and AWS fails over to it
automatically, usually in a minute or two, keeping the same endpoint.

**Read replicas** are **asynchronous** copies that do serve traffic, for read queries. They
are for performance. Because replication is async they can lag slightly behind.

So: Multi-AZ for surviving a failure, read replicas for taking load off the primary. A busy
production database often has both.

## Backups

- **Automated backups** with a retention window up to 35 days, supporting point-in-time
  restore to any second in that window.
- **Manual snapshots** which stay until deleted.

The catch: deleting an instance deletes its automated backups, so a final snapshot matters.

## Storage and scaling

Scaling up means a bigger instance class, which needs a restart unless Multi-AZ lets it fail
over instead. Storage can grow but never shrink, and autoscaling storage avoids running out at
3am.

**Aurora Serverless v2** scales capacity up and down automatically, which suits spiky or
unpredictable load and costs more per unit than a right-sized fixed instance.

## Security

- Put it in **private subnets** with no public access
- Security group allowing 3306 or 5432 **only from the application's security group**
- Encryption at rest with KMS, which has to be chosen at creation time
- SSL/TLS in transit
- Credentials in **Secrets Manager** rather than in the application config, with rotation

---

# DynamoDB

## What it is

DynamoDB is a managed NoSQL key-value and document database. There are no servers, no instance
sizes and no version upgrades. It scales to very large throughput with single digit
millisecond latency.

The trade is that it is **not relational**. No joins, and queries are limited to patterns the
keys support.

## Keys

This is the part that decides whether DynamoDB works for a given application.

- **Partition key** on its own, which must be unique
- **Partition key plus sort key**, where the combination must be unique

The partition key decides which physical partition the item lands on, so it needs to spread
data evenly. A partition key with few distinct values, like a status of `active` or `inactive`,
creates a **hot partition** and throttles.

The sort key allows range queries inside one partition, like all orders for one customer
between two dates.

## Query against Scan

- **Query** uses the partition key and is fast and cheap
- **Scan** reads the whole table and is slow and expensive

A Scan on a large table in production is the classic DynamoDB mistake. If the access pattern
needs a Scan, the key design is probably wrong, or it needs an index.

## Indexes

| Index | What it allows | Notes |
|---|---|---|
| Local Secondary Index (LSI) | A different sort key, same partition key | Must be created with the table |
| Global Secondary Index (GSI) | A completely different partition and sort key | Can be added later, costs extra |

## Capacity modes

**On-demand** charges per request with no capacity planning. Good for unpredictable traffic
and for anything new, since nobody knows the traffic yet.

**Provisioned** sets read and write capacity units, cheaper for steady predictable load, and
can autoscale.

## Design approach

The thing that took me longest to accept: with DynamoDB you design the table **around the
queries**, not around the data. In SQL you normalise first and query however you like
afterwards. In DynamoDB, if an access pattern was not designed for, it is slow or impossible,
and denormalising and duplicating data is normal rather than a mistake.

## Other features

- **TTL** deletes items automatically after a timestamp, good for sessions and caches
- **Streams** emit a change feed, often consumed by Lambda
- **Global tables** replicate across regions
- **Point-in-time recovery** for the last 35 days

---

# Choosing between them

| | RDS | DynamoDB |
|---|---|---|
| Model | Relational, tables and rows | NoSQL, key-value and documents |
| Query language | SQL, joins and ad hoc queries | Key based access, no joins |
| Schema | Fixed, enforced | Flexible per item |
| Scaling | Bigger instance, read replicas | Automatic, effectively unlimited |
| Latency | Milliseconds, varies with query | Single digit ms, predictable |
| Transactions | Full ACID across tables | Supported, more limited |
| Servers | Instance sizes to choose | None |
| Best for | Complex relationships, reporting, unknown future queries | Huge scale with known access patterns |

**Use RDS when** the data is relational, queries involve joins, reporting is needed, or the
future query patterns are not known yet. Most normal applications.

**Use DynamoDB when** the access patterns are known and simple, scale is very large, latency
must be predictable, or the workload is spiky and serverless.

Plenty of systems use both: RDS for core business data, DynamoDB for sessions, carts or event
data.

## Where DynamoDB shows up in DevOps

Terraform's S3 backend uses a DynamoDB table for **state locking**, so two people cannot run
`apply` at the same time and corrupt the state. That one small table is the most common
DynamoDB usage a DevOps engineer meets.

```hcl
terraform {
  backend "s3" {
    bucket         = "my-terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "terraform-locks"
    encrypt        = true
  }
}
```
