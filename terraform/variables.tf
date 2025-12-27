variable "project_id" {
  description = "GCP Project ID"
  type        = string
  default     = "gen-lang-client-0997977661"
}

variable "region" {
  description = "GCP Region"
  type        = string
  default     = "us-central1"
}

# Secret values - should be provided via terraform.tfvars or environment variables
variable "database_url" {
  description = "PostgreSQL database connection string"
  type        = string
  sensitive   = true
}

variable "jwt_secret" {
  description = "JWT signing secret"
  type        = string
  sensitive   = true
}

variable "gemini_api_key" {
  description = "Google Gemini API key"
  type        = string
  sensitive   = true
}

variable "smtp_pass" {
  description = "SMTP password for email service"
  type        = string
  sensitive   = true
}

variable "smtp_user" {
  description = "SMTP username for email service"
  type        = string
  sensitive   = true
  default     = "brickoptima@gmail.com"
}

variable "frontend_url" {
  description = "Frontend application URL"
  type        = string
  default     = "https://brickoptima-frontend-abc123.run.app"
}
