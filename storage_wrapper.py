"""
Google Cloud Storage wrapper for SQLite database persistence.

This module provides transparent syncing of SQLite database files to/from GCS.
It downloads the DB from GCS on startup and uploads after each transaction.
"""

import os
import logging
import time
from pathlib import Path
from threading import Lock
from typing import Optional

logger = logging.getLogger(__name__)

# Try to import GCS client, fall back gracefully if not available
try:
    from google.cloud import storage
    GCS_AVAILABLE = True
except ImportError:
    GCS_AVAILABLE = False
    logger.warning("google-cloud-storage not installed. GCS sync disabled.")


class StorageWrapper:
    """
    Wraps SQLite database operations with Google Cloud Storage syncing.
    
    Usage:
        wrapper = StorageWrapper(
            local_path="data/ledger.db",
            gcs_bucket="bitcoin-bank-data",
            gcs_path="ledger.db"
        )
        wrapper.download()  # Download from GCS on startup
        # ... perform SQLite operations on local_path ...
        wrapper.upload()    # Upload to GCS after writes
    """
    
    def __init__(
        self,
        local_path: str,
        gcs_bucket: Optional[str] = None,
        gcs_path: Optional[str] = None,
    ):
        """
        Initialize the storage wrapper.
        
        Args:
            local_path: Local filesystem path for SQLite DB
            gcs_bucket: GCS bucket name (e.g., "bitcoin-bank-data")
            gcs_path: Path within bucket (e.g., "ledger.db")
        """
        self.local_path = Path(local_path)
        self.gcs_bucket_name = gcs_bucket or os.getenv("GCS_BUCKET")
        self.gcs_path = gcs_path or os.getenv("GCS_DB_PATH", "ledger.db")
        self._upload_lock = Lock()
        self._client: Optional[storage.Client] = None
        self._bucket: Optional[storage.Bucket] = None
        
        # GCS is enabled if bucket is specified and library is available
        self.enabled = bool(self.gcs_bucket_name and GCS_AVAILABLE)
        
        if self.enabled:
            try:
                self._client = storage.Client()
                self._bucket = self._client.bucket(self.gcs_bucket_name)
                logger.info(f"GCS sync enabled: gs://{self.gcs_bucket_name}/{self.gcs_path}")
            except Exception as e:
                logger.error(f"Failed to initialize GCS client: {e}")
                self.enabled = False
        else:
            if self.gcs_bucket_name and not GCS_AVAILABLE:
                logger.warning("GCS_BUCKET set but google-cloud-storage not installed")
            logger.info("GCS sync disabled - using local storage only")
    
    def download(self) -> bool:
        """
        Download database from GCS to local path.
        
        Returns:
            True if downloaded successfully, False if file doesn't exist or on error.
        """
        if not self.enabled:
            logger.debug("GCS sync disabled, skipping download")
            return False
        
        try:
            blob = self._bucket.blob(self.gcs_path)
            
            if not blob.exists():
                logger.info(f"No existing DB in GCS at gs://{self.gcs_bucket_name}/{self.gcs_path}")
                return False
            
            # Ensure local directory exists
            self.local_path.parent.mkdir(parents=True, exist_ok=True)
            
            # Download to local path
            blob.download_to_filename(str(self.local_path))
            size_kb = self.local_path.stat().st_size / 1024
            logger.info(f"Downloaded DB from GCS: {size_kb:.1f} KB")
            return True
            
        except Exception as e:
            logger.error(f"Failed to download from GCS: {e}")
            return False
    
    def upload(self, force: bool = False) -> bool:
        """
        Upload database from local path to GCS.
        
        Args:
            force: If True, upload even if file hasn't changed recently
            
        Returns:
            True if uploaded successfully, False otherwise.
        """
        if not self.enabled:
            return False
        
        if not self.local_path.exists():
            logger.warning(f"Local DB does not exist: {self.local_path}")
            return False
        
        # Prevent concurrent uploads
        if not self._upload_lock.acquire(blocking=False):
            logger.debug("Upload already in progress, skipping")
            return False
        
        try:
            blob = self._bucket.blob(self.gcs_path)
            
            # Upload to GCS
            start = time.time()
            blob.upload_from_filename(str(self.local_path))
            duration = time.time() - start
            
            size_kb = self.local_path.stat().st_size / 1024
            logger.info(f"Uploaded DB to GCS: {size_kb:.1f} KB in {duration:.2f}s")
            return True
            
        except Exception as e:
            logger.error(f"Failed to upload to GCS: {e}")
            return False
        finally:
            self._upload_lock.release()
    
    def ensure_local(self) -> str:
        """
        Ensure local DB exists, downloading from GCS if necessary.
        
        Returns:
            Local path to the database file.
        """
        if not self.local_path.exists():
            logger.info("Local DB not found, attempting download from GCS")
            self.download()
            
            # Create parent directory if still doesn't exist
            if not self.local_path.exists():
                self.local_path.parent.mkdir(parents=True, exist_ok=True)
        
        return str(self.local_path)


# Global singleton instance
_storage_wrapper: Optional[StorageWrapper] = None


def get_storage_wrapper(
    local_path: Optional[str] = None,
    gcs_bucket: Optional[str] = None,
    gcs_path: Optional[str] = None,
) -> StorageWrapper:
    """
    Get or create the global storage wrapper instance.
    
    Args:
        local_path: Local path for SQLite DB (defaults from config)
        gcs_bucket: GCS bucket name (defaults from env/config)
        gcs_path: GCS object path (defaults from env/config)
    
    Returns:
        StorageWrapper instance
    """
    global _storage_wrapper
    
    if _storage_wrapper is None:
        # Import config here to avoid circular imports
        try:
            import config
            local_path = local_path or config.LEDGER_DB_PATH
        except (ImportError, AttributeError):
            local_path = local_path or "data/ledger.db"
        
        _storage_wrapper = StorageWrapper(
            local_path=local_path,
            gcs_bucket=gcs_bucket,
            gcs_path=gcs_path,
        )
        
        # Download DB from GCS on first access
        _storage_wrapper.ensure_local()
    
    return _storage_wrapper


def sync_after_write():
    """
    Upload database to GCS after a write operation.
    Call this after any database modification (INSERT, UPDATE, DELETE).
    """
    wrapper = get_storage_wrapper()
    if wrapper.enabled:
        wrapper.upload()
