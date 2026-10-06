resource "aws_s3_bucket" "assets" {
  bucket = "${var.project_name}-assets-prateek"

  tags = {
    Name    = "${var.project_name}-assets"
    Purpose = "Static assets for the web server"
  }
}

resource "aws_s3_bucket_public_access_block" "assets" {
  bucket = aws_s3_bucket.assets.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
