# Deployment

## Local Docker Compose

Copy `.env.example` to `.env`, then run:

```bash
docker compose up --build
```

The web app is at `http://localhost:3000`, the API at `http://localhost:8000`, and
OpenAPI documentation at `http://localhost:8000/docs`.

## AWS production shape

The Terraform starter creates a VPC, public/private subnet layout, ECS cluster,
RDS PostgreSQL, ElastiCache Redis, private S3 bucket, and ECR repositories. A real
deployment still requires an ACM certificate, domain, load balancer listener, ECS
task definitions, secrets, autoscaling policy, and a reviewed remote Terraform backend.

1. Push `web` and `api` images to the generated ECR repositories.
2. Store database credentials in Secrets Manager; never put them in Terraform variables or Git.
3. Run Alembic as a one-off ECS task before rolling out the API service.
4. Deploy API and worker in private subnets; expose only the ALB and web service.
5. Set S3 CORS and lifecycle rules to the final product policy.
6. Enable CloudWatch log retention, RDS backups, deletion protection, and AWS Budgets alerts.

## Rough monthly cost (us-west-2, low traffic)

These are planning ranges, not quotes. Confirm current AWS pricing before provisioning.

| Component | Small production estimate |
| --- | ---: |
| Two small Fargate services + worker | $45–100 |
| RDS PostgreSQL db.t4g.micro/small | $20–55 |
| ElastiCache smallest node | $13–30 |
| ALB, logs, S3, transfer | $25–60 |
| Total | roughly $103–245/month |

A lower-cost launch can use one $10–25/month VM with Docker Compose, managed Postgres
from a low-cost provider, and Cloudflare R2/S3 for images. This sacrifices some isolation
and automatic scaling but is usually appropriate before sustained traffic.

