from functools import lru_cache
from pathlib import Path
from typing import Protocol

from .config import get_settings


class ObjectStorage(Protocol):
    def put(self, key: str, content: bytes, content_type: str) -> None: ...


class LocalObjectStorage:
    def __init__(self, root: Path) -> None:
        self.root = root

    def put(self, key: str, content: bytes, content_type: str) -> None:
        destination = self.root / key
        destination.parent.mkdir(parents=True, exist_ok=True)
        destination.write_bytes(content)


class S3ObjectStorage:
    def __init__(self, bucket: str, endpoint_url: str | None = None) -> None:
        import boto3

        self.bucket = bucket
        self.client = boto3.client("s3", endpoint_url=endpoint_url)

    def put(self, key: str, content: bytes, content_type: str) -> None:
        self.client.put_object(
            Bucket=self.bucket,
            Key=key,
            Body=content,
            ContentType=content_type,
            ServerSideEncryption="AES256",
            Metadata={"visibility": "private", "purpose": "forecast-evaluation"},
        )


@lru_cache
def get_storage() -> ObjectStorage:
    settings = get_settings()
    if settings.s3_bucket:
        return S3ObjectStorage(settings.s3_bucket, settings.s3_endpoint_url)
    return LocalObjectStorage(settings.upload_directory)
