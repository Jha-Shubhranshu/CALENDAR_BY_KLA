variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "production"
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "calendar-by-kla"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "calendar"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "dbadmin"
}

# In a real production scenario, passwords should be managed via Secrets Manager
# This variable is here for convenience but we will use Secrets Manager in the implementation
variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT Secret Key"
  type        = string
  sensitive   = true
}

variable "jwt_algorithm" {
  description = "JWT Algorithm"
  type        = string
  default     = "HS256"
}
