terraform {
  required_providers {
    ssh = {
      source = "loafoe/ssh"
    }
  }
}

resource "null_resource" "install_docker" {
  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command     = "curl https://releases.rancher.com/install-docker/${var.install_docker_version}.sh -o ${path.root}/config/install-docker${var.install_docker_version}.sh"
  }
}

resource "ssh_resource" "node_preparation" {
  count        = length(var.server_names) + length(var.agent_names)
  host         = concat(var.server_names, var.agent_names)[count.index]
  private_key  = file(var.ssh_private_key_path)
  user         = var.ssh_user
  bastion_host = var.ssh_bastion_host
  bastion_user = var.ssh_bastion_user
  timeout      = "600s"

  file {
    source      = "${path.root}/config/install-docker${var.install_docker_version}.sh"
    destination = "/tmp/install-docker${var.install_docker_version}.sh"
    permissions = "0700"
  }

  commands = [
    "command -v docker > /dev/null 2>&1 || sudo /tmp/install-docker${var.install_docker_version}.sh > >(tee install-docker${var.install_docker_version}.log) 2> >(tee install-docker${var.install_docker_version}.err >&2)",
    "sudo usermod -aG docker ${var.ssh_user}"
  ]
  depends_on = [null_resource.install_docker]
}

resource "local_file" "rke_config" {
  content = templatefile("${path.module}/cluster.yaml", {
    server_names         = var.server_names
    agent_names          = var.agent_names
    ssh_private_key_path = var.ssh_private_key_path
    ssh_user             = var.ssh_user
    ssh_bastion_host     = var.ssh_bastion_host
    ssh_bastion_user     = var.ssh_bastion_user
    kubernetes_version   = split(" ", var.distro_version)[1]
    max_pods             = var.max_pods
    node_cidr_mask_size  = var.node_cidr_mask_size
    sans                 = var.sans
    agent_labels         = var.agent_labels
    agent_taints         = var.agent_taints
  })

  filename = "${path.root}/config/rke_config/${var.name}.yaml"

  provisioner "local-exec" {
    when    = destroy
    command = "rm -f ${replace(self.filename, "/^(.+).yaml$/", "$1.rkestate")}"
  }
  provisioner "local-exec" {
    when    = destroy
    command = "rm -f ${replace(self.filename, "/^(.+)/(.+?).yaml$/", "$1/kube_config_$2.yaml")}"
  }
}

resource "null_resource" "rke_up_execution" {
  count      = length(var.server_names) > 0 ? 1 : 0
  depends_on = [ssh_resource.node_preparation, local_file.rke_config]

  provisioner "local-exec" {
    interpreter = ["bash", "-c"]
    command = templatefile("${path.module}/download_rke.sh", {
      version = split(" ", var.distro_version)[0]
      target  = "${path.root}/config"
    })
  }

  provisioner "local-exec" {
    command = "${path.root}/config/rke up --config ${path.root}/config/rke_config/${var.name}.yaml"
  }

  triggers = {
    node_names = join(",", concat(var.server_names, var.agent_names))
  }
}
