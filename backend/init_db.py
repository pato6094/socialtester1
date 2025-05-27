import sqlite3
import os
from passlib.hash import sha256_crypt # For hashing admin password

# Determine the absolute path to the project root directory
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
DATABASE_NAME = os.path.join(PROJECT_ROOT, "social_network.db")
SCHEMA_FILE = os.path.join(os.path.dirname(__file__), "schema.sql") # schema.sql is now in backend/

ADMIN_EMAIL = "admin@example.com"
ADMIN_FULL_NAME = "Admin User"
ADMIN_PASSWORD = "6094" # Plain text password

def initialize_database():
    """
    Initializes the database by creating tables from the schema.sql file
    and creates an admin user if one doesn't exist.
    """
    conn = None
    try:
        # Ensure the database directory exists (though for root, it always does)
        # db_dir = os.path.dirname(DATABASE_NAME)
        # if db_dir and not os.path.exists(db_dir):
        # os.makedirs(db_dir) # Not strictly needed if DB is in root

        conn = sqlite3.connect(DATABASE_NAME)
        cursor = conn.cursor()

        # Initialize schema
        with open(SCHEMA_FILE, "r") as f:
            schema_script = f.read()
        cursor.executescript(schema_script)
        conn.commit()
        print("Database schema initialized successfully.")

        # Check if admin user exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (ADMIN_EMAIL,))
        admin_exists = cursor.fetchone()

        if not admin_exists:
            print(f"Admin user '{ADMIN_EMAIL}' not found, creating...")
            from datetime import datetime # Import datetime for created_at
            hashed_password = sha256_crypt.hash(ADMIN_PASSWORD)
            current_timestamp = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S') # Format for SQLite
            cursor.execute(
                "INSERT INTO users (full_name, email, password_hash, bio, created_at) VALUES (?, ?, ?, ?, ?)",
                (ADMIN_FULL_NAME, ADMIN_EMAIL, hashed_password, "Default admin user account.", current_timestamp)
            )
            conn.commit()
            print(f"Admin user '{ADMIN_EMAIL}' created successfully.")
        else:
            print(f"Admin user '{ADMIN_EMAIL}' already exists.")

    except sqlite3.Error as e:
        print(f"Error initializing database: {e}")
    except FileNotFoundError:
        print(f"Error: Schema file not found at {SCHEMA_FILE}")
    except Exception as e:
        print(f"An unexpected error occurred: {e}")
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    initialize_database()
