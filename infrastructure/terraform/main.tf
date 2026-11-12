data "aws_availability_zones" "available" { state = "available" }

resource "aws_vpc" "main" {
  cidr_block = "10.42.0.0/16"
  enable_dns_hostnames = true
}

resource "aws_subnet" "public" {
  count = 2
  vpc_id = aws_vpc.main.id
  cidr_block = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index)
  availability_zone = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true
}

resource "aws_subnet" "private" {
  count = 2
  vpc_id = aws_vpc.main.id
  cidr_block = cidrsubnet(aws_vpc.main.cidr_block, 8, count.index + 10)
  availability_zone = data.aws_availability_zones.available.names[count.index]
}

resource "aws_ecs_cluster" "main" { name = "afterglow-${var.environment}" }
resource "aws_ecr_repository" "web" { name = "afterglow-web"; image_scanning_configuration { scan_on_push = true } }
resource "aws_ecr_repository" "api" { name = "afterglow-api"; image_scanning_configuration { scan_on_push = true } }

resource "aws_s3_bucket" "uploads" { bucket_prefix = "afterglow-uploads-" }
resource "aws_s3_bucket_public_access_block" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  block_public_acls = true
  block_public_policy = true
  ignore_public_acls = true
  restrict_public_buckets = true
}
resource "aws_s3_bucket_server_side_encryption_configuration" "uploads" {
  bucket = aws_s3_bucket.uploads.id
  rule { apply_server_side_encryption_by_default { sse_algorithm = "AES256" } }
}

resource "aws_db_subnet_group" "main" { name = "afterglow"; subnet_ids = aws_subnet.private[*].id }
resource "aws_elasticache_subnet_group" "main" { name = "afterglow"; subnet_ids = aws_subnet.private[*].id }
resource "aws_security_group" "data" { name = "afterglow-data"; vpc_id = aws_vpc.main.id }

resource "aws_db_instance" "postgres" {
  identifier = "afterglow-${var.environment}"
  engine = "postgres"
  engine_version = "16.3"
  instance_class = "db.t4g.micro"
  allocated_storage = 20
  db_name = var.database_name
  username = var.database_username
  password = var.database_password
  db_subnet_group_name = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.data.id]
  backup_retention_period = 7
  storage_encrypted = true
  publicly_accessible = false
  skip_final_snapshot = false
  final_snapshot_identifier = "afterglow-${var.environment}-final"
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "afterglow-${var.environment}"
  description = "Afterglow forecast cache and job queue"
  node_type = "cache.t4g.micro"
  port = 6379
  num_cache_clusters = 1
  subnet_group_name = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.data.id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
}

