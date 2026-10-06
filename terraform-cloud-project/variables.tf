variable "aws_region" {
  description = "Region to build the infrastructure in"
  type        = string
  default     = "ap-south-1"
}

variable "project_name" {
  description = "Prefix used in the name of every resource"
  type        = string
  default     = "devops-2028"
}

variable "vpc_cidr" {
  description = "Address range for the whole VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "public_subnet_cidr" {
  description = "Address range for the public subnet"
  type        = string
  default     = "10.0.1.0/24"
}

variable "availability_zone" {
  description = "Availability zone for the subnet"
  type        = string
  default     = "ap-south-1a"
}

variable "instance_type" {
  description = "EC2 instance size"
  type        = string
  default     = "t3.micro"
}
