output "artifacts_bucket" {
  description = "Bucket where CI stores build artifacts"
  value       = aws_s3_bucket.artifacts.id
}

output "lock_table" {
  description = "DynamoDB table used for Terraform state locking"
  value       = aws_dynamodb_table.tf_locks.name
}
