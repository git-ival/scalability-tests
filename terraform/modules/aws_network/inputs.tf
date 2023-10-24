variable "project_name" {
  description = "A prefix for names of objects created by this module"
  default     = "st"
}

variable "region" {
  description = "Region where the instance is created"
  type        = string
}

variable "ami" {
  description = "Optional AMI to use for bastion host. Will use the default from `aws_host` module if not set"
  type        = string
  default     = null
}

variable "instance_type" {
  description = "Optional instance_type to use for bastion host. Will use the default from `aws_host` module if not set"
  type        = string
  default     = null
}

variable "availability_zone" {
  description = "Availability zone where the instance is created"
  type        = string
}

variable "secondary_availability_zone" {
  description = "Optional secondary availability zone. Setting creates of a secondary private subnet"
  type        = string
  default     = null
}

variable "ssh_public_key_path" {
  description = "Path of public ssh key for AWS"
  type        = string
}

variable "ssh_private_key_path" {
  description = "Path of private ssh key for AWS"
  type        = string
}
