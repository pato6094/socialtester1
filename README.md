# ConnectU - Social Network Platform

ConnectU is a web-based social networking application designed to help users connect with friends, share updates, join groups, and interact with content. It provides core social media functionalities including user registration, a main feed, posting capabilities (text and images), liking and commenting on posts, user profiles, friend requests, basic group creation, and an admin dashboard for platform management.

## Directory Structure Overview

*   **`backend/`**: Contains all the server-side Python code for the Flask application.
    *   `app.py`: The main Flask application file, defining routes and API endpoints.
    *   `auth.py`: Handles user authentication logic (registration, login, password reset).
    *   `models.py`: Defines SQLAlchemy database models.
    *   `init_db.py`: Script to initialize the database schema and create a default admin user.
    *   `schema.sql`: SQL script defining the database table structure.
    *   `requirements.txt`: Lists Python dependencies for the backend.
    *   `static/`: Contains static files served by the backend, including:
        *   `uploads/`: Default directory for user-uploaded images (posts, avatars).
            *   `posts/`: Stores images uploaded with posts.
            *   `avatars/`: Stores user profile pictures.
*   **`static/`**: Contains client-side static assets (JavaScript).
    *   `js/`: Contains JavaScript files for frontend logic.
        *   `main.js`: Core utility functions (API calls, token management, etc.).
        *   `landing.js`, `login.js`, `registration.js`, `feed.js`, `profile.js`, `admin_dashboard.js`, `password_reset_request.js`, `password_reset_form.js`: Page-specific JavaScript.
*   **HTML Files (Root Directory)**:
    *   `landing_page.html`: The main entry point for new or logged-out users.
    *   `login_page.html`, `registration_page.html`: User authentication pages.
    *   `password_reset_request.html`, `password_reset_form.html`: Password reset pages.
    *   `main_feed.html`: The main social feed page for logged-in users.
    *   `profile_page.html`: User profile page.
    *   `admin_dashboard.html`: Dashboard for administrators.
*   **`social_network.db`**: SQLite database file, created at the project root after initialization.

## Prerequisites

*   Python 3.x (tested with Python 3.8+)
*   pip (Python package installer, usually comes with Python)
*   (Optional but Recommended) A virtual environment tool like `venv` or `conda`.

## Setup Instructions

1.  **Clone the Repository**:
    (If you're running this from a provided environment, the files are already here.)
    ```bash
    git clone <repository_url>
    cd <repository_directory>
    ```

2.  **Navigate to the Backend Directory**:
    ```bash
    cd backend
    ```

3.  **Create and Activate a Virtual Environment** (Recommended):
    *   Create the virtual environment:
        ```bash
        python -m venv venv
        ```
    *   Activate it:
        *   On Linux/macOS: `source venv/bin/activate`
        *   On Windows: `venv\Scripts\activate`

4.  **Install Backend Dependencies**:
    Ensure your virtual environment is activated.
    ```bash
    pip install -r requirements.txt
    ```

5.  **Initialize/Update the Database**:
    This script will create the `social_network.db` file at the project root (i.e., outside the `backend` directory) and create an admin user. Run this from the `backend` directory.
    ```bash
    python init_db.py
    ```
    You should see messages indicating successful database schema initialization and admin user creation (or a message if the admin already exists).

## Running the Application

1.  **Navigate to the Backend Directory** (if not already there):
    ```bash
    cd backend
    ```
    Ensure your virtual environment is activated if you are using one.

2.  **Run the Flask Development Server**:
    You can run the application using either:
    ```bash
    flask run
    ```
    Or, if `app.run()` is configured in `app.py` (which it is for this project):
    ```bash
    python app.py
    ```

3.  **Access the Application**:
    *   The Flask backend API will typically be running at `http://127.0.0.1:5000/`.
    *   To use the application, open one of the HTML files from the **project root directory** (not the `backend` directory) directly in your web browser. For example:
        *   Open `landing_page.html` to start.
        *   Or, if you already have an account, you can open `login_page.html`.
    *   The HTML pages are designed to make API calls to the backend server running at `http://127.0.0.1:5000/api/...`.

## Admin Credentials

*   **Default Admin Email**: `admin@example.com`
*   **Default Admin Password**: `6094`

## Features Implemented

*   User Registration, Login, and Logout
*   Secure Password Hashing and Password Reset functionality
*   Main Social Feed: View posts from self and friends, with pagination.
*   Post Management: Create text and image posts, like/unlike posts, comment on posts, delete own posts.
*   User Profiles: View user information, posts, and friends list. Edit own profile (name, bio, avatar).
*   Friendship Management: Search for users, send friend requests, accept/decline requests.
*   Basic Group Creation: Users can create new groups (name and description).
*   Admin Dashboard:
    *   View platform statistics (total users, posts, etc.).
    *   Manage users (list, delete).
    *   Manage posts (list, delete).

## Notes on Image Uploads

*   Uploaded images (profile pictures and post images) are currently stored locally in the `backend/static/uploads/` directory.
    *   Profile pictures: `backend/static/uploads/avatars/`
    *   Post images: `backend/static/uploads/posts/`
*   These directories are served as static content by the Flask development server.
*   **Important**: For a production environment, this local file storage approach is not recommended due to limitations in scalability, persistence (if using ephemeral storage), and potentially inefficient serving. In a production setting, consider using:
    *   A dedicated cloud file storage solution (e.g., AWS S3, Google Cloud Storage, Azure Blob Storage).
    *   A more robust strategy for serving static files, such as using a dedicated web server (like Nginx or Apache) or a Content Delivery Network (CDN).

This README provides a comprehensive guide to setting up and running the ConnectU social network application.
