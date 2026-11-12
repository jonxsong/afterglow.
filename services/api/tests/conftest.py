import os


# Test configuration must not inherit Docker-only hostnames from a developer .env.
os.environ["ENVIRONMENT"] = "test"
os.environ["DATABASE_URL"] = "sqlite:///./afterglow-test.sqlite3"
os.environ["REDIS_URL"] = "redis://127.0.0.1:6399/15"
os.environ["UPLOAD_DIRECTORY"] = "data/uploads/test"
