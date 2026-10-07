variable "aws_region" {
  description = "Region for the project infrastructure"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix for resource names"
  type        = string
  default     = "taskboard"
}
