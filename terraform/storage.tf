# Enable Storage API
resource "google_project_service" "storage" {
  service            = "storage-api.googleapis.com"
  disable_on_destroy = false
}

# Feedback Bucket
resource "google_storage_bucket" "feedback_bucket" {
  name          = var.feedback_bucket_name
  location      = var.region
  force_destroy = false

  uniform_bucket_level_access = true

  cors {
    origin          = ["*"]
    method          = ["GET", "POST", "PUT", "HEAD", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  depends_on = [google_project_service.storage]
}

# Public IAM binding for reading objects (optional, or rely on signed URLs)
# For now, we will use signed URLs or make it private. 
# If we want public read access, uncomment the following:
# resource "google_storage_bucket_iam_member" "public_read" {
#   bucket = google_storage_bucket.feedback_bucket.name
#   role   = "roles/storage.objectViewer"
#   member = "allUsers"
# }

# Grant Service Account access to the bucket
resource "google_storage_bucket_iam_member" "backend_access" {
  bucket = google_storage_bucket.feedback_bucket.name
  role   = "roles/storage.admin" # Using admin for simplicity to allow signing URLs and managing objects
  member = "serviceAccount:${data.google_project.project.number}-compute@developer.gserviceaccount.com"
}
