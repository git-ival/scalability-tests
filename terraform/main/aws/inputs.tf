locals {
  project_name = "st"
  upstream_cluster = {
    name                        = "upstream"
    server_count                = 1
    agent_count                 = 0
    distro_version              = "v1.27.7+k3s2"
    reserve_node_for_monitoring = true

    // aws-specific
    public_ip     = true
    instance_type = "i3.large"
    ami           = var.x86_64_ami
  }

  downstream_clusters = [
    for i in range(1) :
    {
      name                        = "downstream-${i}"
      server_count                = 1
      agent_count                 = 0
      distro_version              = "v1.27.7+k3s2"
      reserve_node_for_monitoring = false

      // aws-specific
      public_ip     = false
      instance_type = "t4g.large"
      ami           = var.arm_64_ami
    }
  ]

  clusters = concat([local.upstream_cluster], local.downstream_clusters)

  // aws-specific
  first_local_kubernetes_api_port = 7445
  first_tunnel_app_http_port      = 9080
  first_tunnel_app_https_port     = 9443
  region                          = "us-west-1"
  availability_zone               = "us-west-1a"
}


variable "ssh_public_key_path" {
  description = "Path to SSH public key file (can be generated with `ssh-keygen -t ed25519`)"
  default     = "~/.ssh/id_ed25519.pub"
}

variable "ssh_private_key_path" {
  description = "Path to SSH private key file (can be generated with `ssh-keygen -t ed25519`)"
  default     = "~/.ssh/id_ed25519"
}

variable "aws_credentials_profile" {
  description = "Name of AWS .config containing credentials for the desired AWS environment."
  default     = null
}

variable "iam_instance_profile" {
  description = "IAM profile to use for the EC2 instance"
  default     = null
}

variable "x86_64_ami" {
  description = "AMI ID for x86_64 instance types"
  default     = "ami-009fd8a4732ea789b" // openSUSE-Leap-15-5-v20230608-hvm-ssd-x86_64
}

variable "arm_64_ami" {
  description = "AMI ID for ARM64 instance types"
  default     = "ami-0e55a8b472a265e3f" // openSUSE-Leap-15-5-v20230608-hvm-ssd-arm64
}
