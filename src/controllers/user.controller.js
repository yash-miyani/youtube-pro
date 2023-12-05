import { asyncHandller } from "../utils/asyncHandller.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.models.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const registerUser = asyncHandller(async (req, res) => {
  //01 👉  get user details from frontend
  const { fileName, userName, email, password } = req.body;

  //02 👉  validation - not empty
  if (
    [fileName, userName, email, password].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All fileds are required");
  }

  //03 👉  cheak if user already exists: username,email
  const exitedUser = User.findOne({
    $or: [{ userName }, { email }],
  });

  if (exitedUser) {
    throw new ApiError(409, "User with email or userName is already exists");
  }

  //04 👉  cheak for images, cheak for avatar
  const avatarLocalPath = req.files?.avatar[0]?.path;
  const coverImageLocalPath = req.files?.coverImage[0]?.path;

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
    fileName,
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

export { registerUser };
