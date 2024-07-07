const express = require("express");
const User = require("../model/user");
const router = express.Router();
const cloudinary = require("cloudinary").v2;
const ErrorHandler = require("../utils/ErrorHandler");
const catchAsyncErrors = require("../middleware/catchAsyncErrors");
const jwt = require("jsonwebtoken");
const sendMail = require("../utils/sendMail");
const sendToken = require("../utils/jwtToken");
const { isAuthenticated, isAdmin } = require("../middleware/auth");

// Create user
router.post("/create-user", catchAsyncErrors(async (req, res, next) => {
  const { name, email, password, avatar } = req.body;

  // Check if user already exists
  const userEmail = await User.findOne({ email });
  if (userEmail) {
    return next(new ErrorHandler("User already exists", 400));
  }

  let user;
  if (avatar) {
    // Upload avatar to cloudinary
    const myCloud = await cloudinary.uploader.upload(avatar, {
      folder: "avatars",
    });

    user = new User({
      name,
      email,
      password,
      avatar: {
        public_id: myCloud.public_id,
        url: myCloud.secure_url,
      },
    });
  } else {
    // Create user without avatar
    user = new User({ name, email, password });
  }

  // Save user to database
  await user.save();

  // Generate activation token
  const activationToken = createActivationToken(user);

  // Send activation email
  const activationUrl = `http://localhost:3000/api/v2/activation/${activationToken}`;
  await sendMail({
    email: user.email,
    subject: "Activate your account",
    message: `Hello ${user.name}, please click on the link to activate your account: ${activationUrl}`,
  });

  // Respond with success message
  res.status(201).json({
    success: true,
    message: `Please check your email (${user.email}) to activate your account!`,
  });
}));

// Create activation token
const createActivationToken = (user) => {
  return jwt.sign({ user }, process.env.ACTIVATION_SECRET, {
    expiresIn: "5m",
  });
};

// Activate user
router.post("/activation", catchAsyncErrors(async (req, res, next) => {
  const { activation_token } = req.body;

  // Verify activation token
  const decoded = jwt.verify(activation_token, process.env.ACTIVATION_SECRET);
  if (!decoded) {
    return next(new ErrorHandler("Invalid activation token", 400));
  }

  const { user } = decoded;

  // Check if user already exists
  const existingUser = await User.findOne({ email: user.email });
  if (existingUser) {
    return next(new ErrorHandler("User already activated", 400));
  }

  // Create new user
  const newUser = await User.create(user);

  // Respond with token
  sendToken(newUser, 201, res);
}));

// Login user
router.post("/login-user", catchAsyncErrors(async (req, res, next) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password", 400));
  }

  // Find user by email
  const user = await User.findOne({ email }).select("+password");

  // Check if user exists
  if (!user) {
    return next(new ErrorHandler("Invalid credentials", 401));
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ErrorHandler("Invalid credentials", 401));
  }

  // Respond with token
  sendToken(user, 200, res);
}));

// Get user information
router.get("/get-user", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // Check if user exists
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Respond with user information
  res.status(200).json({
    success: true,
    user,
  });
}));

// Logout user
router.get("/logout", (req, res) => {
  // Clear token cookie
  res.clearCookie("token");
  res.status(200).json({
    success: true,
    message: "Logged out successfully",
  });
});

// Update user info
router.put("/update-user-info", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const { email, password, phoneNumber, name } = req.body;

  // Find user by email
  const user = await User.findOne({ email }).select("+password");

  // Check if user exists
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Verify password
  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    return next(new ErrorHandler("Invalid credentials", 401));
  }

  // Update user information
  user.name = name;
  user.email = email;
  user.phoneNumber = phoneNumber;

  await user.save();

  // Respond with updated user information
  res.status(200).json({
    success: true,
    user,
  });
}));

// Update user avatar
router.put("/update-avatar", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const existsUser = await User.findById(req.user.id);

  if (req.body.avatar !== "") {
    // Delete current avatar from cloudinary
    const imageId = existsUser.avatar.public_id;
    await cloudinary.uploader.destroy(imageId);

    // Upload new avatar to cloudinary
    const myCloud = await cloudinary.uploader.upload(req.body.avatar, {
      folder: "avatars",
      width: 150,
    });

    // Update user's avatar
    existsUser.avatar = {
      public_id: myCloud.public_id,
      url: myCloud.secure_url,
    };
  }

  await existsUser.save();

  // Respond with updated user information
  res.status(200).json({
    success: true,
    user: existsUser,
  });
}));

// Update user addresses
router.put("/update-user-addresses", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id);

  // Check if address with same type already exists
  const sameTypeAddress = user.addresses.find(address => address.addressType === req.body.addressType);
  if (sameTypeAddress) {
    return next(new ErrorHandler(`${req.body.addressType} address already exists`, 400));
  }

  // Find existing address or add new address
  const existsAddress = user.addresses.find(address => address._id === req.body._id);
  if (existsAddress) {
    Object.assign(existsAddress, req.body);
  } else {
    user.addresses.push(req.body);
  }

  await user.save();

  // Respond with updated user information
  res.status(200).json({
    success: true,
    user,
  });
}));

// Delete user address
router.delete("/delete-user-address/:id", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const userId = req.user._id;
  const addressId = req.params.id;

  // Remove address from user's addresses array
  await User.updateOne({ _id: userId }, { $pull: { addresses: { _id: addressId } } });

  // Fetch updated user information
  const user = await User.findById(userId);

  // Respond with updated user information
  res.status(200).json({
    success: true,
    user,
  });
}));

// Update user password
router.put("/update-user-password", isAuthenticated, catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.user.id).select("+password");

  // Verify old password
  const isPasswordMatched = await user.comparePassword(req.body.oldPassword);
  if (!isPasswordMatched) {
    return next(new ErrorHandler("Old password is incorrect", 400));
  }

  // Check if new password matches confirm password
  if (req.body.newPassword !== req.body.confirmPassword) {
    return next(new ErrorHandler("Passwords do not match", 400));
  }

  // Update user's password
  user.password = req.body.newPassword;
  await user.save();

  // Respond with success message
  res.status(200).json({
    success: true,
    message: "Password updated successfully",
  });
}));

// Get user information by ID
router.get("/user-info/:id", catchAsyncErrors(async (req, res, next) => {
  const user = await User.findById(req.params.id);

  // Check if user exists
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Respond with user information
  res.status(200).json({
    success: true,
    user,
  });
}));

// Get all users (admin only)
router.get("/admin-all-users", isAuthenticated, isAdmin, catchAsyncErrors(async (req, res, next) => {
  // Fetch all users sorted by creation date
  const users = await User.find().sort({ createdAt: -1 });

  // Respond with users information
  res.status(200).json({
    success: true,
    users,
  });
}));

// Delete user by ID (admin only)
router.delete("/delete-user/:id", isAuthenticated, isAdmin, catchAsyncErrors(async (req, res, next) => {
  const { id } = req.params;

  // Find user by ID and delete
  const user = await User.findById(id);
  if (!user) {
    return next(new ErrorHandler("User not found", 404));
  }

  // Delete user's avatar from cloudinary
  const imageId = user.avatar.public_id;
  await cloudinary.uploader.destroy(imageId);

  // Delete user from database
  await User.findByIdAndDelete(id);

  // Respond with success message
  res.status(200).json({
    success: true,
    message: "User deleted successfully",
  });
}));

module.exports = router;
