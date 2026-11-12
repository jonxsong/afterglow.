variable "aws_region" { type = string; default = "us-west-2" }
variable "environment" { type = string; default = "production" }
variable "database_name" { type = string; default = "afterglow" }
variable "database_username" { type = string; default = "afterglow" }
variable "database_password" { type = string; sensitive = true }

