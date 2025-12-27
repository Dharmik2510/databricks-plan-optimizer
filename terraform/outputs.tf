output "secret_ids" {
  description = "IDs of all created secrets"
  value = {
    database_url  = google_secret_manager_secret.database_url.id
    jwt_secret    = google_secret_manager_secret.jwt_secret.id
    gemini_api_key = google_secret_manager_secret.gemini_api_key.id
    smtp_pass     = google_secret_manager_secret.smtp_pass.id
    smtp_user     = google_secret_manager_secret.smtp_user.id
    frontend_url  = google_secret_manager_secret.frontend_url.id
  }
}

output "secret_names" {
  description = "Names of all created secrets"
  value = {
    database_url  = google_secret_manager_secret.database_url.secret_id
    jwt_secret    = google_secret_manager_secret.jwt_secret.secret_id
    gemini_api_key = google_secret_manager_secret.gemini_api_key.secret_id
    smtp_pass     = google_secret_manager_secret.smtp_pass.secret_id
    smtp_user     = google_secret_manager_secret.smtp_user.secret_id
    frontend_url  = google_secret_manager_secret.frontend_url.secret_id
  }
}

output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.brickoptima.name
}

output "compute_service_account" {
  description = "Default Compute Engine service account"
  value       = "${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}
