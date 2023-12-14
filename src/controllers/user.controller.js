import { asyncHandller } from "../utils/asyncHandller.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (err) {
    throw new ApiError(
      500,
      "Something went wrong while generating refresh and access token"
    );
  }
};

const registerUser = asyncHandller(async (req, res) => {
  //01 👉  get user details from frontend
  const { fullName, userName, email, password } = req.body;

  //02 👉  validation - not empty
  if (
    [fullName, userName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fileds are required");
  }

  //03 👉  cheak if user already exists: username,email
  const exitedUser = await User.findOne({
    $or: [{ userName }, { email }],
  });

  if (exitedUser) {
    throw new ApiError(409, "User with email or userName is already exists");
  }

  //04 👉  cheak for images, cheak for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  // const coverImageLocalPath = req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  //05 👉  upload them to cloudinary, avatar
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(400, "Avatar file is required");
  }

  //06 👉  create user object - create entry in db
  const user = await User.create({
    fullName,
    avatar: avatar.url,
    coverImage: coverImage?.url || "",
    email,
    password,
    userName: userName.toLowerCase(),
  });

  //07 👉  remove password and refesh token field from response
  const createdUser = await User.findById(user._id).select(
    "-password -refreshTokan"
  );

  //08 👉  check for user creation
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong while registring the user");
  }

  //09 👉  return res
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User registered Successfully"));
});

const loginUser = asyncHandller(async (req, res) => {
  //1)👉 req.body = data
  const { userName, email, password } = req.body;

  //2)👉 username or email
  if (!(userName || email)) {
    throw new ApiError(400, "username and password is required");
  }

  //3)👉 find the user
  const user = await User.findOne({
    $or: [{ userName }, { email }],
  });
  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  //4)👉 Password Cheak
  const isPasswordValid = await user.isPasswordCorrect(password);
  if (!isPasswordValid) {
    throw new ApiError(404, "Invalid User credentials");
  }

  //5)👉 Access & Refesh Token
  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const logedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  //6)👉 Send cookiess
  return res
    .status(200)
    .cookie("accessToken", accessToken, option)
    .cookie("refreshToken", refreshToken, option)
    .json(
      new ApiResponse(
        200,
        {
          user: logedInUser,
          accessToken,
          refreshToken,
        },
        "User Logged In Successfully!"
      )
    );
});

const logoutUser = asyncHandller(async (req, res) => {
  awaitUser.findByIdAndUpdate(
    req.user._id,
    {
      $set: {
        refreshToken: undefined,
      },
    },
    {
      new: true,
    }
  );

  const option = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", option)
    .cookie("refreshToken", option)
    .json(new ApiResponse(200, {}, "User Logged Out Successfully!"));
});

export { registerUser, loginUser, logoutUser };
