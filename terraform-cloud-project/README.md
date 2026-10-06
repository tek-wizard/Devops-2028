# Cloud and Terraform in Action (Session 19)

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## Homework task

Build an end-to-end cloud infrastructure project with Terraform showing providers, variables,
resources, outputs, dependencies, AWS infrastructure, state, and the `plan`, `apply` and
`destroy` workflow.

Suggested architecture: VPC, subnet, security group, EC2, S3.

As in [session 18](../terraform-iac), the provider points at **LocalStack** so nothing is
created in a real AWS account and nothing is billed.

## Architecture

```
                         Internet
                             |
                    +-----------------+
                    | Internet Gateway|
                    +-----------------+
                             |
  ===========================|=============================  VPC  10.0.0.0/16
                             |
                    +-----------------+
                    |  Route table    |   0.0.0.0/0 -> IGW
                    +-----------------+
                             |
                    +-----------------------------+
                    | Public subnet 10.0.1.0/24   |
                    | ap-south-1a                 |
                    |                             |
                    |   +---------------------+   |
                    |   | Security group      |   |
                    |   |  in : 80, 443       |   |
                    |   |  in : 22 from VPC   |   |
                    |   |  out: all           |   |
                    |   |  +---------------+  |   |
                    |   |  | EC2 t3.micro  |  |   |
                    |   |  | nginx         |  |   |
                    |   |  | 10.0.1.4      |  |   |
                    |   |  +---------------+  |   |
                    |   +---------------------+   |
                    +-----------------------------+

  ===========================================================

                    +-----------------------------+
                    | S3 bucket                   |   (regional, outside the VPC)
                    | devops-2028-assets-prateek  |
                    | public access blocked       |
                    +-----------------------------+
```

S3 is drawn outside the VPC on purpose. It is a regional service reached over its own
endpoint, not something that sits inside a subnet. That was something I got wrong at first.

## The files

| File | Contents |
|---|---|
| `provider.tf` | AWS provider and version |
| `variables.tf` | Inputs with types, descriptions and defaults |
| `terraform.tfvars` | The actual values |
| `network.tf` | VPC, internet gateway, subnet, route table, association |
| `security.tf` | Security group |
| `compute.tf` | AMI lookup and the EC2 instance |
| `storage.tf` | S3 bucket and its public access block |
| `outputs.tf` | Values printed at the end |

Splitting by purpose rather than putting everything in `main.tf` makes it much easier to find
things once there is more than a handful of resources.

---

## Providers

```hcl
terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}
```

`~> 5.0` allows 5.x but not 6.0, so a major release with breaking changes cannot arrive on its
own.

## Variables

```hcl
variable "vpc_cidr" {
  description = "Address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"
}
```

Every variable has a type and a description. Values come from `terraform.tfvars`, so the same
code builds a different environment by swapping that one file.

## Dependencies

This is the part I wanted to see properly. I never wrote a single `depends_on`. Terraform
works out the order from the references between resources:

```hcl
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id        # needs the VPC first
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id   # needs the gateway first
  }
}

resource "aws_instance" "web" {
  subnet_id              = aws_subnet.public.id          # needs the subnet
  vpc_security_group_ids = [aws_security_group.web.id]   # and the security group
}
```

So the real dependency chain is:

```
aws_vpc.main
  ├── aws_internet_gateway.main ──┐
  ├── aws_subnet.public ──────────┼── aws_route_table.public ── aws_route_table_association.public
  └── aws_security_group.web      │
                                  └── aws_instance.web  (needs subnet + security group)

aws_s3_bucket.assets  (independent of all of the above)
```

## The AMI data source

```hcl
data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]
  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }
}
```

A `data` block **reads** something that already exists instead of creating it. AMI IDs are
different in every region, so hardcoding one makes the code work in exactly one region. This
looks the right one up at plan time.

---

## terraform plan

```text
$ terraform plan
Plan: 9 to add, 0 to change, 0 to destroy.

Changes to Outputs:
  + bucket_name         = (known after apply)
  + instance_id         = (known after apply)
  + instance_private_ip = (known after apply)
  + public_subnet_id    = (known after apply)
  + security_group_id   = (known after apply)
  + vpc_cidr            = "10.0.0.0/16"
  + vpc_id              = (known after apply)
```

9 resources. Note `vpc_cidr` already has its value because it comes from a variable, while
everything else says `(known after apply)` because AWS assigns those IDs.

## terraform apply

```text
$ terraform apply -auto-approve
aws_vpc.main: Creating...
aws_s3_bucket.assets: Creating...
aws_s3_bucket.assets: Creation complete after 0s [id=devops-2028-assets-prateek]
aws_s3_bucket_public_access_block.assets: Creating...
aws_s3_bucket_public_access_block.assets: Creation complete after 0s
aws_vpc.main: Creation complete after 10s [id=vpc-9a4fbde3]
aws_subnet.public: Creating...
aws_internet_gateway.main: Creating...
aws_security_group.web: Creating...
aws_internet_gateway.main: Creation complete after 0s [id=igw-3ffee18b]
aws_route_table.public: Creating...
aws_route_table.public: Creation complete after 0s [id=rtb-a3f503b4]
aws_security_group.web: Creation complete after 0s [id=sg-d39beac96c9da3f8c]
aws_subnet.public: Creation complete after 10s [id=subnet-0ec7438a]
aws_route_table_association.public: Creating...
aws_instance.web: Creating...
aws_route_table_association.public: Creation complete after 0s
aws_instance.web: Creation complete after 10s [id=i-c7cdefb5af8f59076]

Apply complete! Resources: 9 added, 0 changed, 0 destroyed.
```

The order is the dependency graph playing out:

- The **S3 bucket started at the same time as the VPC**, because it depends on nothing in the
  network. Terraform parallelises anything independent.
- The subnet, internet gateway and security group all waited for the VPC, then ran together.
- The EC2 instance was last, because it needed both the subnet and the security group.

## terraform output

```text
$ terraform output
bucket_name = "devops-2028-assets-prateek"
instance_id = "i-c7cdefb5af8f59076"
instance_private_ip = "10.0.1.4"
public_subnet_id = "subnet-0ec7438a"
security_group_id = "sg-d39beac96c9da3f8c"
vpc_cidr = "10.0.0.0/16"
vpc_id = "vpc-9a4fbde3"
```

The instance got `10.0.1.4`, which is inside the subnet range `10.0.1.0/24`, which is inside
the VPC range `10.0.0.0/16`. The addressing worked out exactly as planned, and `.4` is the
first usable one because AWS reserves `.0` to `.3`.

## Checking it outside Terraform

```text
$ aws ec2 describe-vpcs --filters Name=tag:Name,Values=devops-2028-vpc
|    Cidr     |    State    |     VpcId      |
|  10.0.0.0/16|  available  |  vpc-9a4fbde3  |

$ aws ec2 describe-subnets --filters Name=tag:Name,Values=devops-2028-public-subnet
|     AZ      |     Cidr      |     SubnetId      |
|  ap-south-1a|  10.0.1.0/24  |  subnet-0ec7438a  |

$ aws ec2 describe-instances --filters Name=tag:Name,Values=devops-2028-web
|          Id          | PrivateIp  |  State   |   Type     |
|  i-c7cdefb5af8f59076 |  10.0.1.4  |  running |  t3.micro  |

$ aws s3 ls
2026-10-07 00:48:59 devops-2028-assets-prateek
```

## Terraform state

```text
$ terraform state list
data.aws_ami.amazon_linux
aws_instance.web
aws_internet_gateway.main
aws_route_table.public
aws_route_table_association.public
aws_s3_bucket.assets
aws_s3_bucket_public_access_block.assets
aws_security_group.web
aws_subnet.public
aws_vpc.main
```

The data source is tracked too, even though it creates nothing, because Terraform needs to
know what it resolved to.

## terraform destroy

```text
$ terraform destroy -auto-approve
aws_route_table_association.public: Destroying...
aws_s3_bucket_public_access_block.assets: Destroying...
aws_instance.web: Destroying...
aws_route_table.public: Destroying...
aws_s3_bucket.assets: Destroying...
aws_internet_gateway.main: Destroying...
aws_instance.web: Destruction complete after 10s
aws_subnet.public: Destroying...
aws_security_group.web: Destroying...
aws_subnet.public: Destruction complete after 0s
aws_security_group.web: Destruction complete after 0s
aws_vpc.main: Destroying...
aws_vpc.main: Destruction complete after 0s

Destroy complete! Resources: 9 destroyed.
```

Destroy ran the graph **backwards**. The route table association went first and the VPC last,
because the VPC cannot be deleted while anything is still inside it.

---

## Running it

```bash
terraform init
terraform fmt
terraform validate
terraform plan
terraform apply -auto-approve
terraform output
terraform destroy -auto-approve
```

## What I took away

- Terraform works out ordering from references between resources, so `depends_on` is almost
  never needed. Watching apply and destroy run in opposite orders made that obvious.
- Independent resources are created in parallel, which is why the S3 bucket finished before
  the VPC even existed.
- A `data` source reads something rather than creating it, and looking up the AMI is what
  makes the same code work in more than one region.
- What makes a subnet public is the `0.0.0.0/0` route to the internet gateway, not a setting
  on the subnet.
- The three address ranges nest: VPC `/16`, subnet `/24`, instance IP inside that, and AWS
  reserves the first four addresses in every subnet.
