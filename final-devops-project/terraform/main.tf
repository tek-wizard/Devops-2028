# Where CI stores build artifacts and backups.
resource "aws_s3_bucket" "artifacts" {
  bucket = "${var.project_name}-artifacts-prateek"

  tags = {
    Project   = var.project_name
    ManagedBy = "Terraform"
    Owner     = "Prateek Singh"
  }
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_public_access_block" "artifacts" {
  bucket                  = aws_s3_bucket.artifacts.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# The table Terraform itself would use for state locking, so two people cannot
# run apply at the same time.
resource "aws_dynamodb_table" "tf_locks" {
  name         = "${var.project_name}-terraform-locks"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = {
    Project   = var.project_name
    ManagedBy = "Terraform"
  }
}
