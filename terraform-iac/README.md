# Terraform and Infrastructure as Code (Session 18)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework tasks

**Task 1: Terraform S3 demo** — build a Terraform project with `main.tf`, `variables.tf`,
`outputs.tf`, `provider.tf` and `terraform.tfvars`, create an S3 bucket, and run the whole
workflow: `init`, `fmt`, `validate`, `plan`, `apply`, `show`, `output`, `destroy`.

**Task 2: AWS services research** — learn and document IAM, EC2, S3, VPC and DynamoDB/RDS,
with a separate README for each.

```
terraform-iac/
├── terraform-s3-demo/
└── aws-services/
    ├── 01-iam/
    ├── 02-ec2/
    ├── 03-s3/
    ├── 04-vpc/
    └── 05-dynamodb-rds/
```

## How I ran this without spending money

I do not want to run up a bill on a real AWS account for homework, so the provider points at
**LocalStack**, which emulates AWS services in a Docker container on my own laptop.

```bash
docker run -d --name localstack -p 4566:4566 -e SERVICES=s3,ec2,iam,dynamodb localstack/localstack:3
```

Everything below is a real Terraform run with real state files. The only difference from real
AWS is the endpoint in `provider.tf`:

```hcl
provider "aws" {
  region                      = var.aws_region
  access_key                  = "test"
  secret_key                  = "test"
  skip_credentials_validation = true
  skip_metadata_api_check     = true
  skip_requesting_account_id  = true

  endpoints {
    s3 = "http://localhost:4566"
  }
  s3_use_path_style = true
}
```

To point the same code at real AWS I would delete the `endpoints` block and the three `skip_`
lines, and use real credentials.

---

# What Infrastructure as Code means

Before IaC, servers were made by clicking around a console or running commands by hand. The
problems with that are that nobody can tell exactly what was done, two environments drift
apart, and rebuilding after a failure means remembering every step.

Infrastructure as Code means the infrastructure is described in files kept in git. The files
are the source of truth, they get reviewed like any other code, and the same files produce
the same result every time.

Terraform is **declarative**. I describe the end state I want and Terraform works out the
steps, the same idea as Kubernetes manifests.

## The state file

This is the part that is unique to Terraform. It keeps a `terraform.tfstate` file recording
what it created, so on the next run it can compare three things:

```
what I wrote  <->  what the state says  <->  what is really in AWS
```

That is how it knows whether to create, change, or do nothing. It is also why the state file
matters so much: losing it means Terraform forgets it owns the resources and tries to create
them all again. On a real team the state goes in a shared backend like an S3 bucket with
locking, not on one laptop.

I have `.tfstate` in `.gitignore`, because state files can contain secrets and two people
committing their own copies would conflict constantly.

---

# Task 1: The S3 demo

## The files

| File | What goes in it |
|---|---|
| `provider.tf` | Which provider, which version, how to reach it |
| `variables.tf` | The inputs, with types, descriptions and defaults |
| `main.tf` | The resources themselves |
| `outputs.tf` | Values to print after apply |
| `terraform.tfvars` | The actual values for this environment |

Splitting them up is only a convention. Terraform reads every `.tf` file in the folder, so
this could all be one file, but then nobody could find anything.

`main.tf`:

```hcl
resource "aws_s3_bucket" "demo" {
  bucket = var.bucket_name

  tags = {
    Name        = var.bucket_name
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "Prateek Singh"
  }
}

# Versioning keeps old copies of an object when it is overwritten.
resource "aws_s3_bucket_versioning" "demo" {
  bucket = aws_s3_bucket.demo.id

  versioning_configuration {
    status = "Enabled"
  }
}

# Block all public access. A bucket should never be public unless it has to be.
resource "aws_s3_bucket_public_access_block" "demo" {
  bucket = aws_s3_bucket.demo.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
```

`aws_s3_bucket.demo.id` in the second and third resources is doing something important. It
creates an implicit **dependency**, so Terraform knows the bucket must exist before versioning
can be set on it, without me writing `depends_on` anywhere.

## terraform init

```text
$ terraform init
- Installed hashicorp/aws v5.100.0 (signed by HashiCorp)

Terraform has created a lock file .terraform.lock.hcl to record the provider
selections it made above.

Terraform has been successfully initialized!
```

Downloads the provider plugin and creates `.terraform/`. Has to be run once per project, and
again whenever the provider or backend changes.

## terraform fmt

```text
$ terraform fmt -check -diff
exit code: 0 (0 means everything already formatted)
```

Rewrites files to the standard style. `-check` makes it report instead of rewriting, which is
what a CI pipeline would use so badly formatted code fails the build.

## terraform validate

```text
$ terraform validate
Success! The configuration is valid.
```

Checks the syntax and that the arguments make sense, without talking to AWS at all. Good for
catching typos early.

## terraform plan

```text
$ terraform plan
  # aws_s3_bucket_public_access_block.demo will be created
  + resource "aws_s3_bucket_public_access_block" "demo" {
      + block_public_acls       = true
      + block_public_policy     = true
      + bucket                  = (known after apply)
      + ignore_public_acls      = true
      + restrict_public_buckets = true
    }

  # aws_s3_bucket_versioning.demo will be created
  + resource "aws_s3_bucket_versioning" "demo" {
      + bucket = (known after apply)
      + versioning_configuration {
          + status = "Enabled"
        }
    }

Plan: 3 to add, 0 to change, 0 to destroy.

Changes to Outputs:
  + bucket_arn    = (known after apply)
  + bucket_name   = (known after apply)
  + bucket_region = (known after apply)
```

A dry run. Nothing is created. The `+` marks additions, and `-` would mark destroys, so
`Plan: 3 to add, 0 to change, 0 to destroy` is the line to read before approving anything.

`(known after apply)` means the value does not exist yet because AWS assigns it.

## terraform apply

```text
$ terraform apply -auto-approve
aws_s3_bucket.demo: Creating...
aws_s3_bucket.demo: Creation complete after 1s [id=prateek-devops-2028-demo]
aws_s3_bucket_versioning.demo: Creating...
aws_s3_bucket_public_access_block.demo: Creating...
aws_s3_bucket_public_access_block.demo: Creation complete after 0s [id=prateek-devops-2028-demo]
aws_s3_bucket_versioning.demo: Creation complete after 1s [id=prateek-devops-2028-demo]

Apply complete! Resources: 3 added, 0 changed, 0 destroyed.

Outputs:

bucket_arn = "arn:aws:s3:::prateek-devops-2028-demo"
bucket_name = "prateek-devops-2028-demo"
bucket_region = "ap-south-1"
```

The order confirms the dependency. The bucket was created **first and on its own**, and only
once it finished did the other two start, and those two ran at the same time as each other
because neither depends on the other.

Without `-auto-approve` it shows the plan and waits for `yes`, which is what you want
anywhere near production.

## terraform output

```text
$ terraform output
bucket_arn = "arn:aws:s3:::prateek-devops-2028-demo"
bucket_name = "prateek-devops-2028-demo"
bucket_region = "ap-south-1"
```

Outputs are how one Terraform project hands values to something else, like a CI job or
another module. `terraform output -raw bucket_name` gives just the value for use in a script.

## terraform show

```text
$ terraform show
# aws_s3_bucket.demo:
resource "aws_s3_bucket" "demo" {
    arn                         = "arn:aws:s3:::prateek-devops-2028-demo"
    bucket                      = "prateek-devops-2028-demo"
    bucket_domain_name          = "prateek-devops-2028-demo.s3.amazonaws.com"
    bucket_regional_domain_name = "prateek-devops-2028-demo.s3.ap-south-1.amazonaws.com"
    hosted_zone_id              = "Z11RGJOFQNVJUP"
    id                          = "prateek-devops-2028-demo"
    region                      = "ap-south-1"
    tags                        = {
        "Environment" = "dev"
        "ManagedBy"   = "Terraform"
        "Name"        = "prateek-devops-2028-demo"
        "Owner"       = "Prateek Singh"
    }
}
```

Shows the full state, including every attribute AWS filled in that I never wrote.

## Checking it from outside Terraform

Terraform saying it worked is one thing, so I checked with the AWS CLI as well:

```text
$ aws --endpoint-url=http://localhost:4566 s3 ls
2026-10-07 00:43:24 prateek-devops-2028-demo

$ aws --endpoint-url=http://localhost:4566 s3api get-bucket-versioning --bucket prateek-devops-2028-demo
{
    "Status": "Enabled"
}
```

The bucket is really there and versioning really is on.

```text
$ terraform state list
aws_s3_bucket.demo
aws_s3_bucket_public_access_block.demo
aws_s3_bucket_versioning.demo
```

## terraform destroy

```text
$ terraform destroy -auto-approve
aws_s3_bucket_versioning.demo: Destroying... [id=prateek-devops-2028-demo]
aws_s3_bucket_public_access_block.demo: Destroying... [id=prateek-devops-2028-demo]
aws_s3_bucket_versioning.demo: Destruction complete after 0s
aws_s3_bucket_public_access_block.demo: Destruction complete after 0s
aws_s3_bucket.demo: Destroying... [id=prateek-devops-2028-demo]
aws_s3_bucket.demo: Destruction complete after 0s

Destroy complete! Resources: 3 destroyed.

$ aws --endpoint-url=http://localhost:4566 s3 ls
(no output, no buckets left)
```

Destroy ran in the **reverse** order of apply. Versioning and the access block went first and
the bucket last, because you cannot delete something other resources still point at.

## The whole workflow

```bash
terraform init      # download providers, set up the working directory
terraform fmt       # tidy the formatting
terraform validate  # check the syntax
terraform plan      # see what would change, change nothing
terraform apply     # make it so
terraform show      # look at the current state
terraform output    # just the output values
terraform destroy   # remove everything it created
```

In practice: `init` once, then `fmt`, `validate` and `plan` constantly while writing, `apply`
when the plan looks right, and `destroy` for throwaway environments.

---

# Task 2: AWS services

A separate README for each one:

| Service | Notes |
|---|---|
| IAM | [aws-services/01-iam](aws-services/01-iam) |
| EC2 | [aws-services/02-ec2](aws-services/02-ec2) |
| S3 | [aws-services/03-s3](aws-services/03-s3) |
| VPC | [aws-services/04-vpc](aws-services/04-vpc) |
| DynamoDB and RDS | [aws-services/05-dynamodb-rds](aws-services/05-dynamodb-rds) |

---

## Things worth remembering

- `plan` before `apply`, every time. The `x to add, y to change, z to destroy` line is the
  safety check, and a surprise `destroy` count is how accidents happen.
- Referring to one resource from another creates the dependency automatically, which is why
  the apply and destroy ordering came out right without me specifying it.
- The state file is how Terraform knows what it owns. It belongs in a shared backend, not in
  git and not only on one laptop.
- `validate` works offline and `plan` needs to reach the provider, so they catch different
  kinds of mistakes.
