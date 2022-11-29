output "rancher_help" {
  value = <<-EOT
    UPSTREAM CLUSTER ACCESS:
      export KUBECONFIG=../config/upstream.yaml

    RANCHER UI:
      https://${local.upstream_san}:3000

    DOWNSTREAM CLUSTER ACCESS:
      export KUBECONFIG=../config/downstream.yaml
 EOT
}