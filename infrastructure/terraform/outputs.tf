output "ecs_cluster_name" { value = aws_ecs_cluster.main.name }
output "web_repository_url" { value = aws_ecr_repository.web.repository_url }
output "api_repository_url" { value = aws_ecr_repository.api.repository_url }
output "uploads_bucket" { value = aws_s3_bucket.uploads.bucket }
output "database_endpoint" { value = aws_db_instance.postgres.address; sensitive = true }

