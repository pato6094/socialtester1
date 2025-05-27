from datetime import datetime, timedelta
from flask import current_app # To access app.config for SECRET_KEY
from itsdangerous import URLSafeTimedSerializer
from passlib.hash import sha256_crypt
from .models import db, User, PasswordResetToken # Import db and models

def register_user(full_name, email, password):
    """Registers a new user."""
    if User.query.filter_by(email=email).first():
        return None, "Email already exists."

    new_user = User(full_name=full_name, email=email)
    new_user.set_password(password) # Hashing is done within the User model's method

    db.session.add(new_user)
    try:
        db.session.commit()
        return new_user, None
    except Exception as e:
        db.session.rollback()
        return None, f"Database error: {str(e)}"


def login_user(email, password):
    """Logs in an existing user."""
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(password):
        # Generate a token (e.g., JWT-like using itsdangerous)
        serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        token = serializer.dumps(user.id, salt='session-token')
        return user, token, None
    return None, None, "Invalid email or password."


def request_password_reset_token(email):
    """Generates a password reset token for a user."""
    user = User.query.filter_by(email=email).first()
    if not user:
        return None, "User not found."

    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    token_value = serializer.dumps(user.email, salt='password-reset-salt')
    
    expires_at = datetime.utcnow() + timedelta(hours=1) # Token valid for 1 hour

    # Invalidate any existing tokens for this user
    PasswordResetToken.query.filter_by(user_id=user.id).delete()

    new_token = PasswordResetToken(
        user_id=user.id, 
        token=token_value, 
        expires_at=expires_at
    )
    db.session.add(new_token)
    try:
        db.session.commit()
        return token_value, None
    except Exception as e:
        db.session.rollback()
        return None, f"Database error: {str(e)}"


def verify_password_reset_token(token):
    """Verifies a password reset token."""
    serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
    try:
        email = serializer.loads(
            token, 
            salt='password-reset-salt', 
            max_age=3600 # 1 hour in seconds
        )
    except Exception: # Covers SignatureExpired, BadTimeSignature, BadSignature
        return None, "Token is invalid or has expired."

    token_entry = PasswordResetToken.query.filter_by(token=token).first()
    if not token_entry or token_entry.expires_at < datetime.utcnow():
        return None, "Token is invalid or has expired."
    
    user = User.query.filter_by(email=email).first()
    if not user or user.id != token_entry.user_id:
        return None, "Token is invalid."
        
    return user, None


def reset_password(token, new_password):
    """Resets a user's password using a valid token."""
    user, error = verify_password_reset_token(token)
    if error:
        return False, error

    user.set_password(new_password)
    
    # Invalidate the used token
    token_entry = PasswordResetToken.query.filter_by(token=token).first()
    if token_entry:
        db.session.delete(token_entry)
    
    try:
        db.session.commit()
        return True, None
    except Exception as e:
        db.session.rollback()
        return False, f"Database error: {str(e)}"

# Note: logout_user is typically handled client-side by deleting the token,
# or server-side if using server sessions or a token blacklist.
# For token-based auth, a server-side logout might involve a token blacklist,
# which is more complex. For now, we'll assume client-side token removal.
# A simple placeholder if needed:
def logout_user():
    """Logs out a user (conceptual for token-based auth)."""
    # In a real JWT scenario, the client would discard the token.
    # If using a blacklist, the token would be added to it here.
    return True, "Logged out successfully (client should discard token)."

# --- Decorators for Route Protection ---
from functools import wraps
from flask import request, jsonify, session, g, current_app # Added g and current_app

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        # This is a simplified check. Production apps would validate a token (e.g., JWT)
        # from the Authorization header or a secure cookie.
        if 'user_id' not in session: # Check Flask session
            return jsonify(error="Authentication required."), 401
        
        # Optionally, re-verify token if using token-based session
        # token = session.get('token') or request.headers.get('Authorization')
        # if not token:
        #     return jsonify(error="Authentication token missing."), 401
        # try:
        #     serializer = URLSafeTimedSerializer(current_app.config['SECRET_KEY'])
        #     user_id_from_token = serializer.loads(token.replace('Bearer ', ''), salt='session-token', max_age=...) # max_age if needed
        #     if session.get('user_id') != user_id_from_token:
        #         return jsonify(error="Invalid session or token."), 401
        # except: # Broad exception for expired/invalid token
        #     return jsonify(error="Invalid or expired token."), 401

        g.current_user = User.query.get(session['user_id']) # Store user in g for easy access
        if not g.current_user:
            return jsonify(error="User not found."), 401 # Should not happen if session user_id is valid
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    @login_required # Admin must also be logged in
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin', False):
            return jsonify(error="Administrator access required."), 403
        # Further check if g.current_user also has an admin role if roles are in DB
        # if not g.current_user.is_admin_role: # Assuming User model has an is_admin_role property/column
        #     return jsonify(error="Administrator role check failed."), 403
        return f(*args, **kwargs)
    return decorated_function
