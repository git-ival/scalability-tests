locals {
  project_name = "st"

  upstream_cluster = {
    name                        = "upstream"
    server_count                = 3
    agent_count                 = 2
    distro_version              = "v1.29.6+rke2r1"
    reserve_node_for_monitoring = true

    // aws-specific
    public_ip     = true
    instance_type = "i3.large"
    ami           = length(local.x86_64_ami) > 0 ? local.x86_64_ami : var.x86_64_ami
  }

  downstream_clusters = [
    {
      name                        = "downstream-k3s"
      server_count                = 1
      agent_count                 = 0
      distro_version              = "v1.29.6+k3s2"
      reserve_node_for_monitoring = false

      // aws-specific
      public_ip     = false
      instance_type = "t4g.large"
      ami           = length(local.arm_64_ami) > 0 ? local.arm_64_ami : var.arm_64_ami
    },
    {
      name                        = "downstream-rke1"
      server_count                = 1
      agent_count                 = 0
      distro_version              = "v1.6.0-rc8/rke_linux-amd64 v1.29.6-rancher1-1"
      reserve_node_for_monitoring = false

      // aws-specific
      public_ip     = false
      instance_type = "t3a.large"
      ami           = length(local.x86_64_ami) > 0 ? local.x86_64_ami : var.x86_64_ami
    }
  ]

  tester_cluster = {
    name                        = "tester"
    server_count                = 1
    agent_count                 = 0
    distro_version              = "v1.29.6+k3s2"
    reserve_node_for_monitoring = false

    // aws-specific
    public_ip     = false
    instance_type = "t3a.large"
    ami           = length(local.x86_64_ami) > 0 ? local.x86_64_ami : var.x86_64_ami
  }

  clusters = concat([local.upstream_cluster], local.downstream_clusters, [local.tester_cluster])

  ssh_user = "ubuntu"
  ssh_bastion_user = "ubuntu"

  // aws-specific
  aws_profile = "rancher-eng"
  // Added these local values to override any set in tfvars
  // If you want to use tfvars to set them, set the locals to an empty string and update the ssh_user locals accordingly
  x86_64_ami = "ami-0b03b9afed756bb4b" // ubuntu 22.04
  arm_64_ami = "ami-094571ba1361204cd" // ubuntu 22.04
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

variable "arm_64_ami" {
  description = "AMI with ARM64 architecture to use where appropriate"
  type = string
  default = "ami-0e55a8b472a265e3f" // openSUSE-Leap-15-5-v20230608-hvm-ssd-arm64
}

variable "x86_64_ami" {
  description = "AMI with x86_64 architecture to use where appropriate"
  type = string
  default = "ami-009fd8a4732ea789b" // openSUSE-Leap-15-5-v20230608-hvm-ssd-x86_64
}
