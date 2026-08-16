const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { Expo } = require('expo-server-sdk');
const expo = new Expo();

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private (Requires Pairing)
const createPost = async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    
    if (!content && !mediaUrl) {
      return res.status(400).json({ message: 'Post must contain text or media' });
    }

    const post = await Post.create({
      author: req.user._id,
      content,
      mediaUrl,
      mediaType: mediaType || 'none'
    });

    // Populate author so frontend can show username/avatar instantly
    await post.populate('author', 'username avatar');

    // Send Push Notification to partner
    if (req.user.partner) {
      // Save notification to DB
      let notifTitle = 'New Memory Added! 💖';
      let notifMessage = `${req.user.username} just posted a new memory.`;
      let notifType = mediaType === 'image' || mediaType === 'video' ? 'gallery' : 'post';

      if (mediaType === 'drawing') {
        notifTitle = 'New Drawing! 🎨';
        notifMessage = `${req.user.username} has drawn something for you.`;
        notifType = 'drawing';
      }

      await Notification.create({
        recipient: req.user.partner,
        sender: req.user._id,
        title: notifTitle,
        message: notifMessage,
        type: notifType,
        referenceId: post._id
      });

      try {
        const partnerUser = await User.findById(req.user.partner);
        if (partnerUser && partnerUser.pushToken && Expo.isExpoPushToken(partnerUser.pushToken)) {
          const messages = [{
            to: partnerUser.pushToken,
            sound: 'default',
            title: notifTitle,
            body: notifMessage,
            data: { postId: post._id, type: notifType },
          }];
          
          const chunks = expo.chunkPushNotifications(messages);
          for (const chunk of chunks) {
            await expo.sendPushNotificationsAsync(chunk);
          }
        }
      } catch (pushError) {
        console.error('Error sending push notification:', pushError);
      }
    }

    res.status(201).json(post);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all posts for the paired users (The Private Feed)
// @route   GET /api/posts
// @access  Private (Requires Pairing)
const getFeed = async (req, res) => {
  try {
    // req.allowedAuthors is injected by pairMiddleware
    const posts = await Post.find({ author: { $in: req.allowedAuthors } })
      .sort({ createdAt: -1 })
      .populate('author', 'username avatar')
      .populate('comments.user', 'username avatar');
      
    res.status(200).json(posts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Get all media posts (Shared Gallery)
// @route   GET /api/posts/gallery
// @access  Private (Requires Pairing)
const getGallery = async (req, res) => {
  try {
    const mediaPosts = await Post.find({
      author: { $in: req.allowedAuthors },
      mediaType: { $in: ['image', 'video'] }
    })
    .sort({ createdAt: -1 })
    .select('mediaUrl mediaType createdAt author')
    .populate('author', 'username');

    res.status(200).json(mediaPosts);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Like or Unlike a post
// @route   PUT /api/posts/:id/like
// @access  Private (Requires Pairing)
const toggleLike = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Ensure the post belongs to the pair
    if (!req.allowedAuthors.map(id => id.toString()).includes(post.author.toString())) {
      return res.status(403).json({ message: 'Not authorized to like this post' });
    }

    const isLiked = post.likes.includes(req.user._id);

    if (isLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);

      // Create notification for like if the liker is not the author
      if (post.author.toString() !== req.user._id.toString()) {
        await Notification.create({
          recipient: post.author,
          sender: req.user._id,
          title: 'New Like! ❤️',
          message: `${req.user.username} liked your post.`,
          type: 'like',
          referenceId: post._id
        });
      }
    }

    await post.save();
    res.status(200).json({ likes: post.likes });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Add a comment to a post
// @route   POST /api/posts/:id/comment
// @access  Private (Requires Pairing)
const addComment = async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Ensure the post belongs to the pair
    if (!req.allowedAuthors.map(id => id.toString()).includes(post.author.toString())) {
      return res.status(403).json({ message: 'Not authorized to comment on this post' });
    }

    const newComment = {
      user: req.user._id,
      text
    };

    post.comments.push(newComment);
    await post.save();

    // Create notification for comment if the commenter is not the author
    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        title: 'New Comment! 💬',
        message: `${req.user.username} commented: "${text}"`,
        type: 'comment',
        referenceId: post._id
      });
    }

    // Re-fetch post and populate to return the full comment details
    const populatedPost = await Post.findById(req.params.id).populate('comments.user', 'username avatar');
    
    res.status(201).json(populatedPost.comments);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Delete a post
// @route   DELETE /api/posts/:id
// @access  Private (Requires Pairing)
const deletePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Ensure the current user is the author of the post
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this post' });
    }

    await post.deleteOne();
    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Server error' });
  }
};

// @desc    Update a post
// @route   PUT /api/posts/:id
// @access  Private
const updatePost = async (req, res) => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    // Check if the user is the author
    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized to update this post' });
    }

    const { content } = req.body;
    post.content = content !== undefined ? content : post.content;

    const updatedPost = await post.save();
    
    // Populate the author data before returning
    await updatedPost.populate('author', 'username avatar');
    await updatedPost.populate('comments.user', 'username avatar');

    res.json(updatedPost);
  } catch (error) {
    console.error('Error updating post:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

module.exports = {
  createPost,
  getFeed,
  getGallery,
  toggleLike,
  addComment,
  deletePost,
  updatePost
};
