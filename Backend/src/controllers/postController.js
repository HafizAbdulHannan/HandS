const Post = require('../models/Post');
const User = require('../models/User');
const Notification = require('../models/Notification');
const { sendPushNotification } = require('../utils/pushNotification');

// @desc    Create a new post
// @route   POST /api/posts
// @access  Private (Requires Pairing)
const createPost = async (req, res) => {
  try {
    const { content, mediaUrl, mediaType } = req.body;
    
    if ((!content || !String(content).trim()) && !mediaUrl) {
      return res.status(400).json({ message: 'Post must contain text or media' });
    }

    const post = await Post.create({
      author: req.user._id,
      content: content ? String(content).trim() : '',
      mediaUrl: mediaUrl || '',
      mediaType: mediaType || 'none'
    });

    await post.populate('author', 'fullName username avatar');

    // Send Push Notification to partner
    if (req.user.partner) {
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
        if (partnerUser && partnerUser.pushToken) {
          await sendPushNotification(partnerUser.pushToken, notifTitle, notifMessage, {
            postId: post._id,
            type: notifType
          });
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
const getFeed = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 25;
    const startIndex = (page - 1) * limit;
    
    const query = { author: { $in: req.allowedAuthors } };
    if (req.query.date === 'today') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      query.createdAt = { $gte: today, $lt: tomorrow };
    }

    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .populate('author', 'fullName username avatar')
      .populate('comments.user', 'fullName username avatar');
      
    res.status(200).json(posts);
  } catch (error) {
    next(error);
  }
};

// @desc    Get all media posts (Shared Gallery)
// @route   GET /api/posts/gallery
// @access  Private (Requires Pairing)
const getGallery = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 15;
    const startIndex = (page - 1) * limit;

    const mediaPosts = await Post.find({
      author: { $in: req.allowedAuthors },
      mediaType: { $in: ['image', 'video', 'drawing'] }
    })
      .sort({ createdAt: -1 })
      .skip(startIndex)
      .limit(limit)
      .select('mediaUrl mediaType createdAt author content')
      .populate('author', 'fullName username avatar');

    res.status(200).json(mediaPosts);
  } catch (error) {
    next(error);
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

    if (!req.allowedAuthors.map(id => id.toString()).includes(post.author.toString())) {
      return res.status(403).json({ message: 'Not authorized to like this post' });
    }

    const isLiked = post.likes.some(id => id.toString() === req.user._id.toString());

    if (isLiked) {
      post.likes = post.likes.filter(id => id.toString() !== req.user._id.toString());
    } else {
      post.likes.push(req.user._id);

      if (post.author.toString() !== req.user._id.toString()) {
        const existingNotif = await Notification.findOne({
          recipient: post.author,
          sender: req.user._id,
          type: 'like',
          referenceId: post._id
        });
        if (!existingNotif) {
          await Notification.create({
            recipient: post.author,
            sender: req.user._id,
            title: 'New Like! ❤️',
            message: `${req.user.username} liked your post.`,
            type: 'like',
            referenceId: post._id
          });
          const partnerUser = await User.findById(post.author);
          if (partnerUser && partnerUser.pushToken) {
            sendPushNotification(partnerUser.pushToken, 'New Like! ❤️', `${req.user.username} liked your post.`).catch(() => {});
          }
        }
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
    
    if (!text || !String(text).trim()) {
      return res.status(400).json({ message: 'Comment text is required' });
    }

    const post = await Post.findById(req.params.id);
    
    if (!post) {
      return res.status(404).json({ message: 'Post not found' });
    }

    if (!req.allowedAuthors.map(id => id.toString()).includes(post.author.toString())) {
      return res.status(403).json({ message: 'Not authorized to comment on this post' });
    }

    const trimmedText = String(text).trim();
    post.comments.push({
      user: req.user._id,
      text: trimmedText
    });
    await post.save();

    if (post.author.toString() !== req.user._id.toString()) {
      await Notification.create({
        recipient: post.author,
        sender: req.user._id,
        title: 'New Comment! 💬',
        message: `${req.user.username} commented: "${trimmedText}"`,
        type: 'comment',
        referenceId: post._id
      });
      const partnerUser = await User.findById(post.author);
      if (partnerUser && partnerUser.pushToken) {
        sendPushNotification(partnerUser.pushToken, 'New Comment! 💬', `${req.user.username} commented: "${trimmedText}"`).catch(() => {});
      }
    }

    const populatedPost = await Post.findById(req.params.id).populate('comments.user', 'fullName username avatar');
    
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

    if (post.author.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'User not authorized to update this post' });
    }

    const { content } = req.body;
    const trimmedContent = content !== undefined ? String(content).trim() : post.content;

    if (!trimmedContent && !post.mediaUrl) {
      return res.status(400).json({ message: 'Post cannot be empty' });
    }

    post.content = trimmedContent;

    const updatedPost = await post.save();
    await updatedPost.populate('author', 'fullName username avatar');
    await updatedPost.populate('comments.user', 'fullName username avatar');

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
