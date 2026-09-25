"""Password hashing primitives."""
import os
import hashlib
import hmac
PBKDF2_ITERATIONS = 100_000

def hash_password(password: str, salt: str = None):
    if salt is None:
        salt = os.urandom(16).hex()
    digest = hashlib.pbkdf2_hmac(
        "sha256", password.encode("utf-8"), bytes.fromhex(salt), PBKDF2_ITERATIONS
    ).hex()
    return salt, digest


def verify_password(password: str, salt: str, expected_hash: str) -> bool:
    try:
        _, check = hash_password(password, salt)
        return hmac.compare_digest(check, expected_hash)
    except Exception:
        return False
