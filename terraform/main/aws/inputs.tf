locals {
  project_name = "st"

  upstream_cluster = {
    name                        = "upstream"
    server_count                = 3
    agent_count                 = 2
    distro_version              = "v1.27.7+k3s2"
    reserve_node_for_monitoring = true

    // aws-specific
    public_ip     = true
    instance_type = "i3.large"
    ami           = "ami-0f8e81a3da6e2510a" // ubuntu-jammy-22.04-amd64-server-20230516
  }

  downstream_clusters = [
    for i in range(2) :
    {
      name                        = "downstream-${i}"
      server_count                = 1
      agent_count                 = 0
      distro_version              = "v1.27.7+k3s2"
      reserve_node_for_monitoring = false

      // aws-specific
      public_ip     = false
      instance_type = "t4g.large"
      ami           = "ami-0b1e35bb86d836c49" // Ubuntu-22.04-arm64-server-20230623
    }
  ]

  tester_cluster = {
    name                        = "tester"
    server_count                = 1
    agent_count                 = 0
    distro_version              = "v1.27.7+k3s2"
    reserve_node_for_monitoring = false

    // aws-specific
    public_ip     = false
    instance_type = "t3a.large"
    ami           = "ami-0f8e81a3da6e2510a" // ubuntu-jammy-22.04-amd64-server-20230516
  }

  clusters = concat([local.upstream_cluster], local.downstream_clusters, [local.tester_cluster])

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

variable "iam_instance_profile" {
  description = "IAM profile to use for the EC2 instance"
  default     = null
}
