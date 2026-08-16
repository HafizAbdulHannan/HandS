// This middleware strictly limits queries to the user and their partner.
// It ensures that when fetching posts, comments, or gallery items,
// the query only returns data created by these two specific users.

const requirePairing = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: 'Not authorized' });
  }

  // If paired, allow both authors. If not, just allow the user themselves.
  if (req.user.partner) {
    req.allowedAuthors = [req.user._id, req.user.partner];
  } else {
    req.allowedAuthors = [req.user._id];
  }
  
  next();
};

module.exports = { requirePairing };
