import logging

from redis import Redis
from rq import Queue, Worker

from services.api.app.config import get_settings


def main() -> None:
    settings = get_settings()
    logging.basicConfig(level=settings.log_level)
    connection = Redis.from_url(settings.redis_url)
    worker = Worker([Queue("forecast", connection=connection)], connection=connection)
    worker.work(with_scheduler=True)


if __name__ == "__main__":
    main()

