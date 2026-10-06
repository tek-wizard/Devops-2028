# IAM, Identity and Access Management

**Name:** Prateek Singh
**Enrollment number:** 24BCS10135

## What IAM is

IAM controls **who can do what** in an AWS account. Every single AWS API call is checked
against IAM first, so if IAM says no, nothing else matters.

It is free, it is global rather than per region, and it is the first thing to get right in a
new account.

## The four building blocks

### Users

A user is one identity, usually one person or one application. It has long lived credentials:
a password for the console and access keys for the CLI and SDKs.

The problem with users is the access keys. They do not expire on their own, so a key leaked
into a git repo keeps working until somebody notices. That is why roles are preferred.

### Groups

A collection of users. Permissions are attached to the group and everyone in it inherits
them.

Groups exist so permissions are managed by job rather than by person. A `developers` group and
an `admins` group means a new developer gets the right access by being added to one group,
and a leaver loses it by being removed.

Groups cannot be nested, and a group is not an identity, so nothing can "log in as" a group.

### Roles

A role is a set of permissions that can be **assumed temporarily**. It has no password and no
permanent access keys. When something assumes a role it gets credentials that expire, usually
after an hour.

This is the important one. An EC2 instance that needs to read S3 should get a role, not an
access key baked into the code. The credentials rotate automatically and there is nothing to
leak.

Roles are used for:

- EC2 instances, Lambda functions and other AWS services that need permissions
- a user in one account getting access to another account
- federated login, where a company's own directory signs people in

### Policies

A policy is the JSON document that actually lists what is allowed or denied. Policies attach
to users, groups or roles.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-app-bucket",
        "arn:aws:s3:::my-app-bucket/*"
      ]
    }
  ]
}
```

The parts:

| Field | Meaning |
|---|---|
| `Effect` | `Allow` or `Deny` |
| `Action` | Which API calls, like `s3:GetObject` |
| `Resource` | Which things, written as ARNs |
| `Condition` | Optional extra rules, like only from a certain IP |

Two ARNs are needed in the example above because `ListBucket` acts on the bucket itself while
`GetObject` acts on the objects inside it, and those are different resources.

## How permissions are decided

1. Everything is **denied by default**.
2. An `Allow` in any attached policy turns it on.
3. An explicit `Deny` anywhere beats every `Allow`.

So an explicit `Deny` is absolute. That is useful for guardrails, for example denying anything
outside an approved region no matter what else is granted.

## Least privilege

Give exactly the permissions needed and nothing more.

It is tempting to attach `AdministratorAccess` to make an error go away, and that is how
accounts end up where every service can do everything. The damage from one leaked credential
is then the whole account rather than one bucket.

The practical approach is to start with nothing, run the thing, see what it fails on, and add
only those permissions.

## Best practices

- **Do not use the root user.** It can do anything including closing the account. Set a strong
  password, turn on MFA, and then leave it alone.
- **Turn on MFA**, especially for anyone with admin rights.
- **Prefer roles over users with access keys**, so credentials are temporary.
- **Attach policies to groups**, not to individual users.
- **Least privilege**, and review it as things change.
- **Rotate access keys** where they genuinely cannot be avoided.
- **Use IAM Access Analyzer** to find resources shared outside the account.
- **Turn on CloudTrail** so there is a record of who did what.

## Where it comes up

- An EC2 instance reading from S3 gets an instance role.
- A Lambda function writing to DynamoDB gets an execution role.
- A CI/CD pipeline deploying to AWS assumes a deployment role. GitHub Actions can do this with
  OIDC so no AWS keys are stored in GitHub at all.
- Developers get read-only access to production and full access to dev.
- A third party auditor gets a cross-account role with read-only permissions.

## The link to the CI/CD homework

In [session 17](../../../cicd-devsecops) the pipeline needs credentials to push images and
deploy. Storing an access key in a GitHub secret works but it is a long lived credential in
someone else's system. The better pattern is OIDC, where GitHub proves who it is and AWS hands
back temporary credentials for a role. Same idea as giving EC2 a role instead of a key.
