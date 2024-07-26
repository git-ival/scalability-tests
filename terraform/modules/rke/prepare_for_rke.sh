#!/usr/bin/env bash

set -xe

# https://rancher.com/docs/rke/latest/en/os/#red-hat-enterprise-linux-rhel-oracle-linux-ol-centos
if grep --quiet --ignore-case rhel </etc/os-release; then
  dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
  dnf install -y docker-ce docker-ce-cli containerd.io
fi

# https://rancher.com/docs/rke/latest/en/os/#suse-linux-enterprise-server-sles-opensuse
if grep --quiet --ignore-case suse </etc/os-release; then
  zypper install -y docker
fi

# https://docs.docker.com/engine/install/ubuntu/#install-using-the-repository
if grep --quiet --ignore-case ubuntu </etc/os-release; then
  # remove all conflicting packages
  for pkg in docker.io docker-doc docker-compose docker-compose-v2 podman-docker containerd runc; do ${sudo_prefix} apt-get remove -y $pkg || true; done
  ${sudo_prefix} apt-get purge -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin docker-ce-rootless-extras || true
  ${sudo_prefix} apt-get remove -y docker docker-engine docker.io containerd runc || true
  ${sudo_prefix} rm -rf /var/lib/docker
  ${sudo_prefix} rm -rf /var/lib/containerd

  ${sudo_prefix} mkdir -p /etc/apt/keyrings
  ${sudo_prefix} apt-get update
  ${sudo_prefix} apt-get install ca-certificates curl
  ${sudo_prefix} install -m 0755 -d /etc/apt/keyrings
  ${sudo_prefix} curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc

  ${sudo_prefix} echo \
    "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" |
    ${sudo_prefix} tee /etc/apt/sources.list.d/docker.list >/dev/null

  export DEBIAN_FRONTEND=noninteractive
  ${sudo_prefix} apt-get update
  # HACK: use fixed versions RKE supports
  ${sudo_prefix} apt-get install --yes --allow-downgrades docker-ce=5:24.0.9-1~ubuntu.22.04~jammy docker-ce-cli=5:24.0.9-1~ubuntu.22.04~jammy containerd.io docker-compose-plugin
fi

${sudo_prefix} systemctl enable docker
${sudo_prefix} systemctl start docker
