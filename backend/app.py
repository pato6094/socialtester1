import os
from flask import Flask, jsonify, request, session, current_app, g
from flask_sqlalchemy import SQLAlchemy
from passlib.hash import sha256_crypt
from datetime import datetime, timedelta
from sqlalchemy import or_
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)

# Configuration
project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
db_path = os.path.join(project_root, 'social_network.db')
app.config['SQLALCHEMY_DATABASE_URI'] = f'sqlite:///{db_path}'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.environ.get('FLASK_SECRET_KEY', 'a_default_strong_secret_key_for_development')

db = SQLAlchemy(app)

# Import models after db is initialized
from models import User, Post, Friendship, Group, GroupMember, Message, PasswordResetToken, Like, Comment
import auth as auth_logic
from auth import login_required, admin_required

# Upload folder configuration
UPLOAD_FOLDER_BASE = os.path.join(project_root, 'backend', 'static', 'uploads')
app.config['UPLOAD_FOLDER_POSTS'] = os.path.join(UPLOAD_FOLDER_BASE, 'posts')
app.config['UPLOAD_FOLDER_AVATARS'] = os.path.join(UPLOAD_FOLDER_BASE, 'avatars')

# Ensure upload folders exist
os.makedirs(app.config['UPLOAD_FOLDER_POSTS'], exist_ok=True)
os.makedirs(app.config['UPLOAD_FOLDER_AVATARS'], exist_ok=True)

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route('/api/hello')
def hello():
    return jsonify(message="Hello from Flask!"), 200

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password') or not data.get('full_name'):
        return jsonify(error="Missing required fields (email, password, full_name)."), 400

    user, error = auth_logic.register_user(
        full_name=data['full_name'],
        email=data['email'],
        password=data['password']
    )
    if error:
        return jsonify(error=error), 409
    return jsonify(message="User registered successfully.", user_id=user.id), 201


@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json()
    if not data or not data.get('email') or not data.get('password'):
        return jsonify(error="Missing email or password."), 400

    email = data['email']
    password = data['password']

    # Special admin login case
    if email == 'admin@example.com' and password == '6094':
        admin_user = User.query.filter_by(email='admin@example.com').first()
        if admin_user and sha256_crypt.verify(password, admin_user.password_hash):
            session['user_id'] = admin_user.id
            session['is_admin'] = True
            serializer = auth_logic.URLSafeTimedSerializer(app.config['SECRET_KEY'])
            token = serializer.dumps(admin_user.id, salt='session-token')
            return jsonify(message="Admin login successful.", token=token, user_id=admin_user.id, is_admin=True), 200
        elif not admin_user:
             return jsonify(error="Admin account not initialized. Please run init_db.py or seed_admin.py."), 401
        else:
            return jsonify(error="Invalid admin credentials."), 401

    user, token, error = auth_logic.login_user(email, password)
    if error:
        return jsonify(error=error), 401
    
    session['user_id'] = user.id
    session['is_admin'] = False
    return jsonify(message="Login successful.", token=token, user_id=user.id), 200


@app.route('/api/logout', methods=['POST'])
def logout():
    session.pop('user_id', None)
    session.pop('is_admin', None)
    success, message = auth_logic.logout_user()
    if success:
        return jsonify(message=message), 200
    else:
        return jsonify(error=message), 400


@app.route('/api/request-password-reset', methods=['POST'])
def request_password_reset():
    data = request.get_json()
    if not data or not data.get('email'):
        return jsonify(error="Email is required."), 400

    token, error = auth_logic.request_password_reset_token(email=data['email'])
    if error:
        return jsonify(error=error), 404
    
    return jsonify(message="Password reset token generated.", reset_token=token), 200


@app.route('/api/reset-password', methods=['POST'])
def reset_password_route():
    data = request.get_json()
    token = data.get('token')
    new_password = data.get('new_password')

    if not token or not new_password:
        return jsonify(error="Token and new password are required."), 400

    success, error = auth_logic.reset_password(token, new_password)
    if not success:
        return jsonify(error=error), 400
    
    return jsonify(message="Password has been reset successfully."), 200


if __name__ == '__main__':
    app.run(debug=True, port=5000)


@app.route('/api/me', methods=['GET'])
@login_required
def get_current_user_details():
    if not g.current_user:
        return jsonify(error="No user is currently logged in."), 401
    
    user_data = {
        "id": g.current_user.id,
        "full_name": g.current_user.full_name,
        "email": g.current_user.email,
        "profile_picture": g.current_user.profile_picture,
        "bio": g.current_user.bio,
        "is_admin": session.get('is_admin', False)
    }
    return jsonify(user_data), 200


@app.route('/api/users', methods=['GET'])
@login_required
def search_users():
    query = request.args.get('q', '')
    if not query:
        return jsonify(error="Search query parameter 'q' is required."), 400
    
    users = User.query.filter(
        or_(
            User.full_name.ilike(f"%{query}%"),
            User.email.ilike(f"%{query}%")
        )
    ).all()
    
    users_data = [{
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "profile_picture": user.profile_picture
    } for user in users]
    
    return jsonify(users_data), 200

@app.route('/api/friend-request', methods=['POST'])
@login_required
def send_friend_request():
    data = request.get_json()
    target_user_id = data.get('user_id')

    if not target_user_id:
        return jsonify(error="Target user_id is required."), 400

    if target_user_id == g.current_user.id:
        return jsonify(error="Cannot send a friend request to yourself."), 400

    target_user = User.query.get(target_user_id)
    if not target_user:
        return jsonify(error="Target user not found."), 404

    existing_friendship = Friendship.query.filter(
        or_(
            (Friendship.user1_id == g.current_user.id) & (Friendship.user2_id == target_user_id),
            (Friendship.user1_id == target_user_id) & (Friendship.user2_id == g.current_user.id)
        )
    ).first()

    if existing_friendship:
        if existing_friendship.status == 'accepted':
            return jsonify(error="You are already friends with this user."), 400
        elif existing_friendship.status == 'pending':
            return jsonify(error="A friend request is already pending or has been sent by this user."), 400
        elif existing_friendship.status == 'declined':
            db.session.delete(existing_friendship)
            db.session.commit()

    new_friendship = Friendship(
        user1_id=g.current_user.id,
        user2_id=target_user_id,
        status='pending'
    )
    db.session.add(new_friendship)
    try:
        db.session.commit()
        return jsonify(message="Friend request sent successfully.", request_id=new_friendship.id), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending friend request: {e}")
        return jsonify(error="Failed to send friend request."), 500


@app.route('/api/friend-request/<int:request_id>', methods=['PUT'])
@login_required
def respond_to_friend_request(request_id):
    data = request.get_json()
    action = data.get('action')

    if not action or action not in ['accept', 'decline']:
        return jsonify(error="Action ('accept' or 'decline') is required."), 400

    friend_request = Friendship.query.get(request_id)

    if not friend_request:
        return jsonify(error="Friend request not found."), 404

    if friend_request.user2_id != g.current_user.id:
        return jsonify(error="You are not authorized to respond to this friend request."), 403

    if friend_request.status != 'pending':
        return jsonify(error=f"This friend request is already '{friend_request.status}'."), 400

    if action == 'accept':
        friend_request.status = 'accepted'
    elif action == 'decline':
        friend_request.status = 'declined'

    try:
        db.session.commit()
        return jsonify(message=f"Friend request {action}ed successfully."), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error responding to friend request: {e}")
        return jsonify(error=f"Failed to {action} friend request."), 500


@app.route('/api/friends', methods=['GET'])
@login_required
def list_friends():
    current_user_id = g.current_user.id
    
    friends_as_user1 = db.session.query(User).join(Friendship, Friendship.user2_id == User.id)\
        .filter(Friendship.user1_id == current_user_id, Friendship.status == 'accepted').all()
    
    friends_as_user2 = db.session.query(User).join(Friendship, Friendship.user1_id == User.id)\
        .filter(Friendship.user2_id == current_user_id, Friendship.status == 'accepted').all()
        
    all_friends = list(set(friends_as_user1 + friends_as_user2))

    friends_data = [{
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "profile_picture": user.profile_picture
    } for user in all_friends]
    
    return jsonify(friends_data), 200


@app.route('/api/posts', methods=['POST'])
@login_required
def create_post():
    if 'image' in request.files:
        file = request.files['image']
        if file.filename == '':
            image_db_path = None
        elif file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4()) + "_" + filename
            file_path = os.path.join(app.config['UPLOAD_FOLDER_POSTS'], unique_filename)
            file.save(file_path)
            image_db_path = f"/static/uploads/posts/{unique_filename}"
        else:
            return jsonify(error="Invalid image file type."), 400
    else:
        image_db_path = request.form.get('image_url')
        if not image_db_path and request.is_json:
             data_json = request.get_json()
             image_db_path = data_json.get('image_url')

    content = request.form.get('content')
    if content is None and request.is_json:
        data_json = request.get_json()
        content = data_json.get('content')

    if not content and not image_db_path:
        return jsonify(error="Content or an image is required for a post."), 400
    
    if content is None:
        content = ""

    new_post = Post(
        user_id=g.current_user.id,
        content=content,
        image_url=image_db_path
    )
    db.session.add(new_post)
    try:
        db.session.commit()
        return jsonify({
            "message": "Post created successfully.",
            "post": {
                "id": new_post.id,
                "user_id": new_post.user_id,
                "content": new_post.content,
                "image_url": new_post.image_url,
                "created_at": new_post.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating post: {e}")
        return jsonify(error="Failed to create post."), 500

@app.route('/api/feed', methods=['GET'])
@login_required
def get_feed():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 10, type=int)

    current_user_id = g.current_user.id

    friend_ids = []
    for friendship in g.current_user.friendships1:
        if friendship.status == 'accepted' and friendship.user2:
            friend_ids.append(friendship.user2_id)
    for friendship in g.current_user.friendships2:
        if friendship.status == 'accepted' and friendship.user1:
            friend_ids.append(friendship.user1_id)
    
    from sqlalchemy.orm import joinedload

    user_ids_for_feed = list(set(friend_ids + [current_user_id]))
    
    posts_query = Post.query.options(joinedload(Post.author))\
                            .filter(Post.user_id.in_(user_ids_for_feed))\
                            .order_by(Post.created_at.desc())
    
    paginated_posts = posts_query.paginate(page=page, per_page=limit, error_out=False)
    
    posts_data = [{
        "id": post.id,
        "user_id": post.user_id,
        "author_full_name": post.author.full_name,
        "author_profile_picture": post.author.profile_picture,
        "content": post.content,
        "image_url": post.image_url,
        "created_at": post.created_at.isoformat(),
        "likes_count": len(post.likes),
        "comments_count": len(post.comments)
    } for post in paginated_posts.items]

    return jsonify({
        "page": paginated_posts.page,
        "per_page": paginated_posts.per_page,
        "total_pages": paginated_posts.pages,
        "total_items": paginated_posts.total,
        "items": posts_data
    }), 200


@app.route('/api/profile/<int:user_id>', methods=['GET'])
@login_required
def get_user_profile(user_id):
    user = User.query.get(user_id)
    if not user:
        return jsonify(error="User not found."), 404

    user_posts = Post.query.filter_by(user_id=user.id).order_by(Post.created_at.desc()).limit(10).all()
    posts_data = [{
        "id": post.id,
        "content": post.content,
        "image_url": post.image_url,
        "created_at": post.created_at.isoformat(),
        "likes_count": len(post.likes),
        "comments_count": len(post.comments)
    } for post in user_posts]

    friends_data = []
    friendships_as_user1 = Friendship.query.filter_by(user1_id=user.id, status='accepted').all()
    for fs in friendships_as_user1:
        if fs.user2:
            friends_data.append({"id": fs.user2.id, "full_name": fs.user2.full_name})
    
    friendships_as_user2 = Friendship.query.filter_by(user2_id=user.id, status='accepted').all()
    for fs in friendships_as_user2:
        if fs.user1:
            friends_data.append({"id": fs.user1.id, "full_name": fs.user1.full_name})
    
    unique_friends_data = [dict(t) for t in {tuple(d.items()) for d in friends_data}]

    friendship_status = 'none'
    if g.current_user.id == user.id:
        friendship_status = 'self'
    else:
        existing_friendship = Friendship.query.filter(
            or_(
                (Friendship.user1_id == g.current_user.id) & (Friendship.user2_id == user.id),
                (Friendship.user1_id == user.id) & (Friendship.user2_id == g.current_user.id)
            )
        ).first()
        if existing_friendship:
            if existing_friendship.status == 'accepted':
                friendship_status = 'friends'
            elif existing_friendship.status == 'pending':
                if existing_friendship.user1_id == g.current_user.id:
                    friendship_status = 'pending_sent'
                else:
                    friendship_status = 'pending_received'

    profile_data = {
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "posts": posts_data,
        "friends": unique_friends_data,
        "friendship_status_with_current_user": friendship_status,
        "created_at": user.created_at.isoformat() if user.created_at else None
    }
    return jsonify(profile_data), 200

@app.route('/api/profile', methods=['PUT'])
@login_required
def update_user_profile():
    user_to_update = g.current_user
    updated_fields = False

    if 'profile_picture_file' in request.files:
        file = request.files['profile_picture_file']
        if file.filename == '':
            pass
        elif file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            unique_filename = str(uuid.uuid4()) + "_" + filename
            file_path = os.path.join(app.config['UPLOAD_FOLDER_AVATARS'], unique_filename)
            file.save(file_path)
            user_to_update.profile_picture = f"/static/uploads/avatars/{unique_filename}"
            updated_fields = True
        else:
            return jsonify(error="Invalid profile picture file type."), 400

    data_source = request.form if request.form else request.get_json()
    
    if not data_source and not updated_fields:
         return jsonify(error="No data provided for update."), 400

    if data_source:
        if 'full_name' in data_source and data_source['full_name'] != user_to_update.full_name:
            user_to_update.full_name = data_source['full_name']
            updated_fields = True
        
        if 'bio' in data_source and data_source['bio'] != user_to_update.bio:
            user_to_update.bio = data_source['bio']
            updated_fields = True
        
        if 'profile_picture' in data_source and data_source['profile_picture'] != user_to_update.profile_picture and 'profile_picture_file' not in request.files:
            user_to_update.profile_picture = data_source['profile_picture']
            updated_fields = True

    if not updated_fields:
        return jsonify(message="No changes detected or no valid fields provided for update."), 200

    try:
        db.session.commit()
        return jsonify({
            "message": "Profile updated successfully.",
            "user": {
                "id": user_to_update.id,
                "full_name": user_to_update.full_name,
                "email": user_to_update.email,
                "profile_picture": user_to_update.profile_picture,
                "bio": user_to_update.bio
            }
        }), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error updating profile: {e}")
        return jsonify(error="Failed to update profile."), 500


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def admin_list_users():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    users_query = User.query.order_by(User.id.asc())
    paginated_users = users_query.paginate(page=page, per_page=limit, error_out=False)

    users_data = [{
        "id": user.id,
        "full_name": user.full_name,
        "email": user.email,
        "profile_picture": user.profile_picture,
        "bio": user.bio,
        "created_at": user.created_at.isoformat() if user.created_at else None
    } for user in paginated_users.items]

    return jsonify({
        "page": paginated_users.page,
        "per_page": paginated_users.per_page,
        "total_pages": paginated_users.pages,
        "total_items": paginated_users.total,
        "items": users_data
    }), 200

@app.route('/api/admin/users/<int:user_id>', methods=['DELETE'])
@admin_required
def admin_delete_user(user_id):
    user_to_delete = User.query.get(user_id)
    if not user_to_delete:
        return jsonify(error="User not found."), 404

    if user_to_delete.email == 'admin@example.com':
        return jsonify(error="Cannot delete the primary admin account."), 403

    try:
        Post.query.filter_by(user_id=user_id).delete()
        Like.query.filter_by(user_id=user_id).delete()
        Comment.query.filter_by(user_id=user_id).delete()
        GroupMember.query.filter_by(user_id=user_id).delete()
        Friendship.query.filter(or_(Friendship.user1_id == user_id, Friendship.user2_id == user_id)).delete()
        PasswordResetToken.query.filter_by(user_id=user_id).delete()
        
        db.session.delete(user_to_delete)
        db.session.commit()
        return jsonify(message=f"User {user_id} and their basic associated data deleted successfully."), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting user: {e}")
        return jsonify(error="Failed to delete user."), 500

@app.route('/api/admin/posts', methods=['GET'])
@admin_required
def admin_list_posts():
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    posts_query = Post.query.order_by(Post.created_at.desc())
    paginated_posts = posts_query.paginate(page=page, per_page=limit, error_out=False)
    
    posts_data = [{
        "id": post.id,
        "user_id": post.user_id,
        "author_full_name": post.author.full_name,
        "content": post.content,
        "image_url": post.image_url,
        "created_at": post.created_at.isoformat(),
        "likes_count": len(post.likes),
        "comments_count": len(post.comments)
    } for post in paginated_posts.items]

    return jsonify({
        "page": paginated_posts.page,
        "per_page": paginated_posts.per_page,
        "total_pages": paginated_posts.pages,
        "total_items": paginated_posts.total,
        "items": posts_data
    }), 200

@app.route('/api/admin/posts/<int:post_id>', methods=['DELETE'])
@admin_required
def admin_delete_post(post_id):
    post_to_delete = Post.query.get(post_id)
    if not post_to_delete:
        return jsonify(error="Post not found."), 404

    try:
        db.session.delete(post_to_delete)
        db.session.commit()
        return jsonify(message=f"Post {post_id} deleted successfully."), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error deleting post: {e}")
        return jsonify(error="Failed to delete post."), 500

@app.route('/api/admin/dashboard-stats', methods=['GET'])
@admin_required
def admin_dashboard_stats():
    total_users = User.query.count()
    total_posts = Post.query.count()
    
    days_ago_7 = datetime.utcnow() - timedelta(days=7)
    new_users_last_7_days = User.query.filter(User.created_at >= days_ago_7).count()

    total_groups = Group.query.count()
    total_messages = Message.query.count()

    stats = {
        "total_users": total_users,
        "total_posts": total_posts,
        "new_users_last_7_days": new_users_last_7_days,
        "total_groups": total_groups,
        "total_messages": total_messages,
        "active_users_today": "N/A (requires activity tracking)",
        "most_active_group": "N/A (requires complex query)"
    }
    return jsonify(stats), 200

@app.route('/api/posts/<int:post_id>/like', methods=['POST'])
@login_required
def toggle_like_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return jsonify(error="Post not found."), 404

    existing_like = Like.query.filter_by(user_id=g.current_user.id, post_id=post_id).first()

    if existing_like:
        db.session.delete(existing_like)
        message = "Post unliked successfully."
    else:
        new_like = Like(user_id=g.current_user.id, post_id=post_id)
        db.session.add(new_like)
        message = "Post liked successfully."
    
    try:
        db.session.commit()
        return jsonify(message=message), 200
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error toggling like: {e}")
        return jsonify(error="Failed to update like status."), 500

@app.route('/api/posts/<int:post_id>/comments', methods=['POST'])
@login_required
def create_comment_on_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return jsonify(error="Post not found."), 404

    data = request.get_json()
    content = data.get('content')
    if not content:
        return jsonify(error="Content is required for a comment."), 400

    new_comment = Comment(
        user_id=g.current_user.id,
        post_id=post_id,
        content=content
    )
    db.session.add(new_comment)
    try:
        db.session.commit()
        return jsonify({
            "message": "Comment posted successfully.",
            "comment": {
                "id": new_comment.id,
                "user_id": new_comment.user_id,
                "author_full_name": new_comment.user.full_name,
                "post_id": new_comment.post_id,
                "content": new_comment.content,
                "created_at": new_comment.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating comment: {e}")
        return jsonify(error="Failed to post comment."), 500

@app.route('/api/posts/<int:post_id>/comments', methods=['GET'])
@login_required
def get_comments_for_post(post_id):
    post = Post.query.get(post_id)
    if not post:
        return jsonify(error="Post not found."), 404

    comments = sorted(post.comments, key=lambda c: c.created_at)

    comments_data = [{
        "id": comment.id,
        "user_id": comment.user_id,
        "author_full_name": comment.user.full_name,
        "author_profile_picture": comment.user.profile_picture,
        "post_id": comment.post_id,
        "content": comment.content,
        "created_at": comment.created_at.isoformat()
    } for comment in comments]
    
    return jsonify(comments_data), 200


@app.route('/api/groups', methods=['POST'])
@login_required
def create_group():
    data = request.get_json()
    name = data.get('name')
    description = data.get('description')

    if not name:
        return jsonify(error="Group name is required."), 400

    new_group = Group(
        name=name,
        description=description,
        created_by_user_id=g.current_user.id
    )
    db.session.add(new_group)
    try:
        db.session.commit()

        new_member = GroupMember(
            group_id=new_group.id,
            user_id=g.current_user.id
        )
        db.session.add(new_member)
        db.session.commit()
        
        return jsonify({
            "message": "Group created successfully and creator added as member.",
            "group": {
                "id": new_group.id,
                "name": new_group.name,
                "description": new_group.description,
                "created_by_user_id": new_group.created_by_user_id,
                "created_at": new_group.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error creating group: {e}")
        return jsonify(error="Failed to create group."), 500

@app.route('/api/groups', methods=['GET'])
@login_required
def list_user_groups():
    user_groups = Group.query.join(GroupMember).filter(GroupMember.user_id == g.current_user.id).all()
    
    groups_data = [{
        "id": group.id,
        "name": group.name,
        "description": group.description,
        "created_by_user_id": group.created_by_user_id,
        "owner_name": group.owner.full_name,
        "created_at": group.created_at.isoformat()
    } for group in user_groups]
    
    return jsonify(groups_data), 200

@app.route('/api/groups/<int:group_id>/join', methods=['POST'])
@login_required
def join_group(group_id):
    group = Group.query.get(group_id)
    if not group:
        return jsonify(error="Group not found."), 404

    existing_membership = GroupMember.query.filter_by(group_id=group_id, user_id=g.current_user.id).first()
    if existing_membership:
        return jsonify(error="You are already a member of this group."), 400

    new_member = GroupMember(
        group_id=group_id,
        user_id=g.current_user.id
    )
    db.session.add(new_member)
    try:
        db.session.commit()
        return jsonify(message="Successfully joined the group.", membership_id=new_member.id), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error joining group: {e}")
        return jsonify(error="Failed to join group."), 500

@app.route('/api/groups/<int:group_id>/members', methods=['GET'])
@login_required
def list_group_members(group_id):
    group = Group.query.get(group_id)
    if not group:
        return jsonify(error="Group not found."), 404

    members = User.query.join(GroupMember).filter(GroupMember.group_id == group_id).all()
    
    members_data = [{
        "id": member.id,
        "full_name": member.full_name,
        "profile_picture": member.profile_picture
    } for member in members]
    
    return jsonify(members_data), 200


@app.route('/api/messages', methods=['POST'])
@login_required
def send_message():
    data = request.get_json()
    content = data.get('content')
    receiver_id = data.get('receiver_id')
    group_id = data.get('group_id')

    if not content:
        return jsonify(error="Message content is required."), 400
    
    if not receiver_id and not group_id:
        return jsonify(error="Either receiver_id or group_id must be provided."), 400
    
    if receiver_id and group_id:
        return jsonify(error="Cannot specify both receiver_id and group_id."), 400

    if receiver_id:
        target_user = User.query.get(receiver_id)
        if not target_user:
            return jsonify(error="Receiver user not found."), 404
        if receiver_id == g.current_user.id:
            return jsonify(error="Cannot send a message to yourself this way."), 400
    
    if group_id:
        group = Group.query.get(group_id)
        if not group:
            return jsonify(error="Group not found."), 404
        is_member = GroupMember.query.filter_by(group_id=group_id, user_id=g.current_user.id).first()
        if not is_member:
            return jsonify(error="You are not a member of this group."), 403

    new_message = Message(
        sender_id=g.current_user.id,
        receiver_id=receiver_id,
        group_id=group_id,
        content=content
    )
    db.session.add(new_message)
    try:
        db.session.commit()
        return jsonify({
            "message": "Message sent successfully.",
            "message_details": {
                "id": new_message.id,
                "sender_id": new_message.sender_id,
                "receiver_id": new_message.receiver_id,
                "group_id": new_message.group_id,
                "content": new_message.content,
                "created_at": new_message.created_at.isoformat()
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        current_app.logger.error(f"Error sending message: {e}")
        return jsonify(error="Failed to send message."), 500

@app.route('/api/messages/user/<int:user_id>', methods=['GET'])
@login_required
def get_direct_messages(user_id):
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    other_user = User.query.get(user_id)
    if not other_user:
        return jsonify(error="User not found."), 404

    current_user_id = g.current_user.id

    messages_query = Message.query.options(joinedload(Message.sender), joinedload(Message.receiver))\
        .filter(
            Message.group_id == None,
            or_(
                (Message.sender_id == current_user_id) & (Message.receiver_id == user_id),
                (Message.sender_id == user_id) & (Message.receiver_id == current_user_id)
            )
        ).order_by(Message.created_at.desc())

    paginated_messages = messages_query.paginate(page=page, per_page=limit, error_out=False)
    
    messages_data = [{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender.full_name,
        "sender_profile_picture": msg.sender.profile_picture,
        "receiver_id": msg.receiver_id,
        "receiver_name": msg.receiver.full_name if msg.receiver else None,
        "receiver_profile_picture": msg.receiver.profile_picture if msg.receiver else None,
        "content": msg.content,
        "created_at": msg.created_at.isoformat()
    } for msg in reversed(paginated_messages.items)]

    return jsonify({
        "page": paginated_messages.page,
        "per_page": paginated_messages.per_page,
        "total_pages": paginated_messages.pages,
        "total_items": paginated_messages.total,
        "items": messages_data
    }), 200

@app.route('/api/messages/group/<int:group_id>', methods=['GET'])
@login_required
def get_group_messages(group_id):
    page = request.args.get('page', 1, type=int)
    limit = request.args.get('limit', 20, type=int)

    group = Group.query.get(group_id)
    if not group:
        return jsonify(error="Group not found."), 404

    is_member = GroupMember.query.filter_by(group_id=group_id, user_id=g.current_user.id).first()
    if not is_member:
        return jsonify(error="You must be a member of this group to view its messages."), 403

    messages_query = Message.query.options(joinedload(Message.sender))\
                                .filter_by(group_id=group_id)\
                                .order_by(Message.created_at.desc())

    paginated_messages = messages_query.paginate(page=page, per_page=limit, error_out=False)

    messages_data = [{
        "id": msg.id,
        "sender_id": msg.sender_id,
        "sender_name": msg.sender.full_name,
        "sender_profile_picture": msg.sender.profile_picture,
        "group_id": msg.group_id,
        "content": msg.content,
        "created_at": msg.created_at.isoformat()
    } for msg in reversed(paginated_messages.items)]

    return jsonify({
        "page": paginated_messages.page,
        "per_page": paginated_messages.per_page,
        "total_pages": paginated_messages.pages,
        "total_items": paginated_messages.total,
        "items": messages_data
    }), 200