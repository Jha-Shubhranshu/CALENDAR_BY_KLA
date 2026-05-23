resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}-secrets"
}

resource "aws_secretsmanager_secret_version" "app_secrets_version" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  
  # Initial placeholder — actual values are managed via CLI rotation.
  # The lifecycle below prevents Terraform from ever overwriting them.
  secret_string = jsonencode({
    DATABASE_URL = "placeholder"
    JWT_SECRET   = "placeholder"
  })
  
  lifecycle {
    ignore_changes = [secret_string]
  }
}






resource "aws_secretsmanager_secret" "rds_proxy" {
  name = "${var.project_name}-rds-proxy-credentials"
}

resource "aws_secretsmanager_secret_version" "rds_proxy_version" {
  secret_id = aws_secretsmanager_secret.rds_proxy.id
  secret_string = jsonencode({
    username = "placeholder"
    password = "placeholder"
  })

  lifecycle {
    ignore_changes = [secret_string]
  }
}
