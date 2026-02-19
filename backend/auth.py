"""
Authentication module - hardcoded users with bcrypt-hashed passwords.
Users: aaron, vijval, daksha, sharan, admin
Default password for all: Crypto@2024
"""
import bcrypt

# Pre-hashed passwords for: aaron, vijval, daksha, sharan, admin
# All use default password: Crypto@2024
USERS = {
    "aaron": "$2b$12$bmq7lx7SWOQSyDPYCbTMIuA.Sg/P/41rzss7UWqCLW/BS48BJdSU2",
    "vijval": "$2b$12$bmq7lx7SWOQSyDPYCbTMIuA.Sg/P/41rzss7UWqCLW/BS48BJdSU2",
    "daksha": "$2b$12$bmq7lx7SWOQSyDPYCbTMIuA.Sg/P/41rzss7UWqCLW/BS48BJdSU2",
    "sharan": "$2b$12$bmq7lx7SWOQSyDPYCbTMIuA.Sg/P/41rzss7UWqCLW/BS48BJdSU2",
    "admin": "$2b$12$bmq7lx7SWOQSyDPYCbTMIuA.Sg/P/41rzss7UWqCLW/BS48BJdSU2",
}


def verify_user(username: str, password: str) -> bool:
    """Verify username and password against stored hashes."""
    username = username.strip().lower()
    if username not in USERS:
        return False
    return bcrypt.checkpw(password.encode("utf-8"), USERS[username].encode("utf-8"))
