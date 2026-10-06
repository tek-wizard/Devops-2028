# S3, Simple Storage Service

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## What S3 is

S3 is object storage. I put files, called **objects**, into **buckets**, and get them back by
key over HTTP. It is not a filesystem. There are no real folders, and what looks like
`photos/2026/img.jpg` is just a key with slashes in it.

It is one of the oldest AWS services and it turns up everywhere: static websites, backups,
logs, data lakes, Terraform state.

## Buckets and objects

A **bucket** is the container. The name is globally unique across all of AWS, which is why
every tutorial bucket name has a random suffix. A bucket lives in one region.

An **object** is the file plus its metadata. Up to 5 TB each, and anything over 5 GB has to be
uploaded in parts.

I created a bucket with Terraform in [the S3 demo](../../terraform-s3-demo):

```hcl
resource "aws_s3_bucket" "demo" {
  bucket = var.bucket_name
}
```

```text
$ aws s3 ls
2026-10-07 00:43:24 prateek-devops-2028-demo
```

## Storage classes

S3 charges for storage and for retrieval, and the classes trade one against the other.

| Class | For | Retrieval |
|---|---|---|
| Standard | Frequently accessed | Instant |
| Intelligent-Tiering | Unpredictable access | Instant, moves data automatically |
| Standard-IA | Infrequent but needed quickly | Instant, costs per GB retrieved |
| One Zone-IA | Same, but only one AZ | Instant, cheaper, less durable |
| Glacier Instant | Archive needed instantly | Instant |
| Glacier Flexible | Archive | Minutes to hours |
| Glacier Deep Archive | Long term compliance | Up to 12 hours |

The trap is that the cheap classes have a **minimum storage duration**, so deleting something
from Glacier after a week still gets charged for 90 days. Cheap storage is only cheap for data
that genuinely sits still.

**Lifecycle rules** move objects between classes on a schedule, like Standard for 30 days,
then Standard-IA, then Glacier after a year.

## Versioning

With versioning on, overwriting an object keeps the old copy and deleting it adds a **delete
marker** rather than removing anything.

```hcl
resource "aws_s3_bucket_versioning" "demo" {
  bucket = aws_s3_bucket.demo.id
  versioning_configuration {
    status = "Enabled"
  }
}
```

```text
$ aws s3api get-bucket-versioning --bucket prateek-devops-2028-demo
{
    "Status": "Enabled"
}
```

It protects against overwriting and deleting by accident, and it is required for replication.

Two things to know: versioning can be suspended but never turned off again, and every old
version is still charged for, so without a lifecycle rule to expire them the bill grows
quietly.

## Security

This is where S3 goes wrong in the news. Most "S3 breaches" are a bucket somebody made public
on purpose and forgot.

**Block Public Access** is the switch that overrides everything else:

```hcl
resource "aws_s3_bucket_public_access_block" "demo" {
  bucket                  = aws_s3_bucket.demo.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

With all four on, nothing can make the bucket public even if a policy tries. I set this on my
demo bucket because a bucket should start closed.

The access controls, from most to least recommended:

| Control | What it does |
|---|---|
| Block Public Access | Account or bucket level override. Leave it on |
| Bucket policy | JSON policy on the bucket. The normal way to grant access |
| IAM policy | Permissions attached to a user or role |
| ACLs | The old way, per object. AWS now discourages these |

**Encryption** is on by default now (SSE-S3). SSE-KMS gives control over the key and an audit
trail of who decrypted what, at a little extra cost.

## Static website hosting

S3 can serve a static site directly, which is cheap and needs no servers. In practice it is
usually put behind CloudFront for HTTPS, a custom domain and caching.

## Why DevOps people care

- **Terraform state.** The shared backend is normally an S3 bucket, with DynamoDB for locking.
  Versioning on that bucket means a corrupted state can be recovered.
- **Artifacts.** Build outputs from CI go here.
- **Logs.** ALB, CloudFront and CloudTrail logs all land in S3.
- **Backups.** Database dumps, with lifecycle rules to Glacier.
- **Data lakes.** Raw data queried in place with Athena.

## Things that catch people out

| Problem | Cause |
|---|---|
| Bucket name already taken | Names are globally unique, not per account |
| Surprise bill after enabling versioning | Old versions are charged for until a lifecycle rule expires them |
| Glacier delete still charged | Minimum storage duration |
| Public bucket by accident | Block Public Access turned off to "fix" an access error |
| Slow listing of a huge bucket | S3 is not a filesystem, listing millions of keys is expensive |
