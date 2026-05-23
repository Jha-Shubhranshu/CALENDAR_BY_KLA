terraform {
  backend "s3" {
    bucket       = "calendar-by-kla-tfstate-099210689603"
    key          = "infra/terraform.tfstate"
    region       = "us-east-1"
    encrypt      = true
    use_lockfile = true
  }
}