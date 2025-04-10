import { IncomingForm } from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { MongoClient } from "mongodb";
import fs from "fs";

// Disable body parser for file uploads
export const config = {
  api: {
    bodyParser: false,
  },
};

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// MongoDB URI
const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);
const dbName = "issuePortal";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  try {
    // Parse form
    const data = await new Promise((resolve, reject) => {
      const form = new IncomingForm({ multiples: true, keepExtensions: true });

      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const { description, userId } = data.fields;

    if (!description || !userId) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    await client.connect();
    const db = client.db(dbName);
    const blocked = await db.collection("blockedUsers").findOne({ userId });

    if (blocked) {
      return res.status(403).json({ message: "You are blocked from posting." });
    }

    // Count previous issues to determine the folder name
    const userPostCount = await db.collection("issues").countDocuments({ userId });
    const currentFolder = `issue-portal/${userId}/${userPostCount + 1}`;

    // Upload files to Cloudinary
    const media = [];
    const fileArray = Array.isArray(data.files.media)
      ? data.files.media
      : data.files.media
      ? [data.files.media]
      : [];

    for (const file of fileArray) {
      const result = await cloudinary.uploader.upload(file.filepath, {
        resource_type: "auto",
        folder: currentFolder,
      });
      media.push({
        url: result.secure_url,
        type: result.resource_type,
      });

      fs.unlinkSync(file.filepath); // Delete temp file
    }

    // Save issue
    await db.collection("issues").insertOne({
      description,
      media,
      userId,
      timestamp: new Date(),
    });

    return res.status(200).json({ message: "Issue submitted successfully." });
  } catch (error) {
    console.error("Submit error:", error);
    return res.status(500).json({ message: "Server error. Try again later." });
  }
}
